import { NextResponse } from 'next/server';
import { Client } from 'pg';
import {
  assertValidIdentifier,
  assertLooksLikePostgresUri,
  assertPublicHost,
  assertBodyWithinLimit,
  toClientError,
  safeError,
} from '@/lib/server/db-security';

// Server-side safety ceilings. The client does its own dynamic chunking
// (see chunkTableRows in useDatabaseSeeding.jsx), but the server never
// trusts the client — these limits are enforced independently so a bad
// or malicious payload can't open a giant transaction or blow past
// Postgres's bound-parameter limit (65535).
const MAX_ROWS_PER_REQUEST = 2000;
const MAX_PARAMS_PER_REQUEST = 65000;
// Generous ceiling for a JSON body carrying up to MAX_ROWS_PER_REQUEST rows.
const MAX_BODY_BYTES = 5 * 1024 * 1024;

export async function POST(request) {
  let client;

  try {
    assertBodyWithinLimit(request, MAX_BODY_BYTES);

    const { connectionString, tableName, columns, rows } = await request.json();

    // Validation 
    assertLooksLikePostgresUri(connectionString);
    await assertPublicHost(connectionString);

    if (!Array.isArray(columns) || columns.length === 0) {
      throw safeError('columns must be a non-empty array.');
    }

    assertValidIdentifier(tableName, 'table');
    columns.forEach(col => assertValidIdentifier(col, 'column'));

    if (!Array.isArray(rows)) {
      throw safeError('rows must be an array.');
    }
    // An empty chunk is a legitimate no-op (e.g. a table with 0 generated rows) — not an error.
    if (rows.length === 0) {
      return NextResponse.json({ success: true, inserted: 0 });
    }
    if (rows.length > MAX_ROWS_PER_REQUEST) {
      throw safeError(
        `Chunk too large: ${rows.length} rows exceeds the ${MAX_ROWS_PER_REQUEST}-row limit per request. Reduce the client-side chunk size.`
      );
    }
    if (columns.length * rows.length > MAX_PARAMS_PER_REQUEST) {
      throw safeError(
        `Chunk has too many bound parameters (${columns.length * rows.length}). Reduce rows per chunk.`
      );
    }

    // Insert
    client = new Client({
      connectionString,
      // Bound how long a bad/unreachable host, or a stuck transaction, can
      // tie up this request instead of hanging until the platform's own
      // (often much longer) function timeout kicks in.
      connectionTimeoutMillis: 5000,
      query_timeout: 30000,
      statement_timeout: 30000,
    });
    await client.connect();

    await client.query('BEGIN');

    // One bulk multi-row INSERT for the whole chunk, e.g.:
    //   INSERT INTO "users" ("id","name") VALUES ($1,$2),($3,$4),...
    // This is a big win over inserting row-by-row: a 500-row chunk is
    // one round trip instead of 500.
    const values = [];
    const valueGroups = rows.map((row, rowIdx) => {
      const placeholders = columns.map((col, colIdx) => {
        values.push(row[col]);
        return `$${rowIdx * columns.length + colIdx + 1}`;
      });
      return `(${placeholders.join(', ')})`;
    });

    const query = `INSERT INTO "${tableName}" ("${columns.join('", "')}") VALUES ${valueGroups.join(', ')}`;
    await client.query(query, values);

    await client.query('COMMIT');

    return NextResponse.json({ success: true, inserted: rows.length });
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (_) {
        // Connection may already be dead — nothing more we can do here.
      }
    }
    const status = error?.__safeForClient ? 400 : 500;
    return NextResponse.json({ error: toClientError(error) }, { status });
  } finally {
    if (client) {
      try {
        await client.end();
      } catch (_) {
        // Already closed/errored — ignore.
      }
    }
  }
}