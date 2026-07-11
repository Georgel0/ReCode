import { NextResponse } from 'next/server';
import { Pool } from 'pg';
import {
  assertValidIdentifier,
  assertLooksLikeDbUri,
  assertPublicHost,
  assertBodyWithinLimit,
  toClientError,
  safeError,
} from '@/lib/server/db-security';

const MAX_ROWS_PER_REQUEST = 2500;
const MAX_PARAMS_PER_REQUEST = 65000;
const MAX_BODY_BYTES = 5 * 1024 * 1024;
const ALLOWED_CONFLICT_MODES = new Set(['error', 'skip']);

// Global pool cache to prevent connection exhaustion during chunked seeding
const poolCache = new Map();

function getPool(connectionString) {
  if (!poolCache.has(connectionString)) {
    poolCache.set(connectionString, new Pool({
      connectionString,
      max: 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    }));
  }
  return poolCache.get(connectionString);
}

function castSuffixFor(columnTypes, col) {
  const t = columnTypes[col];
  if (!t) return '';
  if (t.data_type === 'json' || t.data_type === 'jsonb' || t.data_type === 'uuid') return `::${t.data_type}`;
  if (t.data_type === 'ARRAY') return `::${t.udt_name.replace(/^_/, '')}[]`;
  if (t.data_type === 'USER-DEFINED') return `::${t.udt_name}`;
  return '';
}

export async function POST(request) {
  let client;

  try {
    assertBodyWithinLimit(request, MAX_BODY_BYTES);

    const {
      connectionString, tableName, columns, rows,
      isFinalChunk = true, onConflict = 'error',
    } = await request.json();

    assertLooksLikeDbUri(connectionString);
    await assertPublicHost(connectionString);

    if (connectionString.toLowerCase().startsWith('mysql')) {
      throw safeError('MySQL seeding is not yet implemented.');
    }

    if (!Array.isArray(columns) || columns.length === 0) throw safeError('columns must be a non-empty array.');
    if (!ALLOWED_CONFLICT_MODES.has(onConflict)) throw safeError(`onConflict must be one of: ${[...ALLOWED_CONFLICT_MODES].join(', ')}.`);
    if (!Array.isArray(rows)) throw safeError('rows must be an array.');
    if (rows.length > MAX_ROWS_PER_REQUEST) throw safeError(`Chunk too large.`);
    if (columns.length * rows.length > MAX_PARAMS_PER_REQUEST) throw safeError(`Chunk has too many bound parameters.`);

    if (rows.length === 0 && !isFinalChunk) {
      return NextResponse.json({ success: true, inserted: 0 });
    }

    // Extract Schema Context
    const targetSchema = new URL(connectionString).searchParams.get('schema') || 'public';
    assertValidIdentifier(targetSchema, 'schema');
    assertValidIdentifier(tableName, 'table');
    columns.forEach(col => assertValidIdentifier(col, 'column'));

    const pool = getPool(connectionString);
    client = await pool.connect();
    await client.query('BEGIN');

    let inserted = 0;

    if (rows.length > 0) {
      const typesRes = await client.query(
        `SELECT column_name, data_type, udt_name
         FROM information_schema.columns
         WHERE table_schema = $1 AND table_name = $2 AND column_name = ANY($3::text[])`,
        [targetSchema, tableName, columns]
      );
      
      const columnTypes = {};
      typesRes.rows.forEach(({ column_name, data_type, udt_name }) => {
        columnTypes[column_name] = { data_type, udt_name };
      });

      const values = [];
      const valueGroups = rows.map((row, rowIdx) => {
        const placeholders = columns.map((col, colIdx) => {
          values.push(row[col]);
          return `$${rowIdx * columns.length + colIdx + 1}${castSuffixFor(columnTypes, col)}`;
        });
        return `(${placeholders.join(', ')})`;
      });

      const conflictClause = onConflict === 'skip' ? ' ON CONFLICT DO NOTHING' : '';
      
      // Interpolate BOTH schema and table securely
      const query = `INSERT INTO "${targetSchema}"."${tableName}" ("${columns.join('", "')}") VALUES ${valueGroups.join(', ')}${conflictClause}`;
      const insertRes = await client.query(query, values);
      inserted = insertRes.rowCount ?? rows.length;
    }

    if (isFinalChunk) {
      for (const col of columns) {
        // Fix for Sequence Desync edge cases with upper-case table names:
        // Use quote_ident to generate proper notation (e.g. "public"."UserTable") 
        // which pg_get_serial_sequence safely digests.
        const seqRes = await client.query(
          `SELECT pg_get_serial_sequence(quote_ident($1) || '.' || quote_ident($2), $3) as seq`, 
          [targetSchema, tableName, col]
        );
        const seqName = seqRes.rows[0]?.seq;
        if (!seqName) continue;
        
        await client.query(
          `SELECT setval($1::regclass, COALESCE((SELECT MAX("${col}") FROM "${targetSchema}"."${tableName}"), 0) + 1, false)`,
          [seqName]
        );
      }
    }

    await client.query('COMMIT');
    return NextResponse.json({ success: true, inserted });
  } catch (error) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch (_) {}
    }
    const status = error?.__safeForClient ? 400 : 500;
    return NextResponse.json({ error: toClientError(error) }, { status });
  } finally {
    if (client) {
      try { client.release(); } catch (_) {}
    }
  }
}