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

const ALLOWED_CONFLICT_MODES = new Set(['error', 'skip']);

// Types that Postgres won't implicitly coerce a driver-supplied text/unknown
// parameter into. Without an explicit cast, inserting a JSON string into a
// jsonb column (or a plain string into an enum/uuid/array column) throws
// "column is of type X but expression is of type text" even though the
// value itself is perfectly valid.
function castSuffixFor(columnTypes, col) {
  const t = columnTypes[col];
  if (!t) return '';
  if (t.data_type === 'json' || t.data_type === 'jsonb' || t.data_type === 'uuid') {
    return `::${t.data_type}`;
  }
  if (t.data_type === 'ARRAY') {
    // udt_name for an array is the element type prefixed with an underscore
    // (e.g. _int4, _text) — strip it and append [] to get a valid cast target.
    return `::${t.udt_name.replace(/^_/, '')}[]`;
  }
  if (t.data_type === 'USER-DEFINED') {
    // Enums (and other user-defined base types) — udt_name is the type name itself.
    return `::${t.udt_name}`;
  }
  return '';
}

export async function POST(request) {
  let client;

  try {
    assertBodyWithinLimit(request, MAX_BODY_BYTES);

    const {
      connectionString,
      tableName,
      columns,
      rows,
      // Which chunk of this table's insert this request represents. The
      // client sends these because the sequence resync below only needs to
      // run once per table, after the last chunk — not after every chunk.
      isFinalChunk = true,
      // 'error' (default): behave exactly as before — a duplicate key blows
      // up the request. 'skip': translate to `ON CONFLICT DO NOTHING` so
      // re-running a seed (or seeding against a partially-populated
      // database) is idempotent instead of crashing.
      onConflict = 'error',
    } = await request.json();

    // Validation 
    assertLooksLikePostgresUri(connectionString);
    await assertPublicHost(connectionString);

    if (!Array.isArray(columns) || columns.length === 0) {
      throw safeError('columns must be a non-empty array.');
    }

    assertValidIdentifier(tableName, 'table');
    columns.forEach(col => assertValidIdentifier(col, 'column'));

    if (!ALLOWED_CONFLICT_MODES.has(onConflict)) {
      throw safeError(`onConflict must be one of: ${[...ALLOWED_CONFLICT_MODES].join(', ')}.`);
    }

    if (!Array.isArray(rows)) {
      throw safeError('rows must be an array.');
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
    // An empty chunk with no final-chunk work to do is a legitimate no-op
    // (e.g. a table with 0 generated rows) — not an error. If it IS the
    // final chunk we still fall through, since a serial column may need
    // resyncing even though this particular request has no rows.
    if (rows.length === 0 && !isFinalChunk) {
      return NextResponse.json({ success: true, inserted: 0 });
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

    let inserted = 0;

    if (rows.length > 0) {
      // Look up the real column types so we know which ones need an
      // explicit cast (jsonb/json/uuid/enum/array). One extra query per
      // chunk, scoped to just this table's requested columns — cheap
      // relative to already opening a fresh pg connection per request.
      const typesRes = await client.query(
        `SELECT column_name, data_type, udt_name
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1 AND column_name = ANY($2::text[])`,
        [tableName, columns]
      );
      const columnTypes = {};
      typesRes.rows.forEach(({ column_name, data_type, udt_name }) => {
        columnTypes[column_name] = { data_type, udt_name };
      });

      // One bulk multi-row INSERT for the whole chunk, e.g.:
      //   INSERT INTO "users" ("id","name") VALUES ($1,$2::jsonb),($3,$4::jsonb),...
      // This is a big win over inserting row-by-row: a 500-row chunk is
      // one round trip instead of 500.
      const values = [];
      const valueGroups = rows.map((row, rowIdx) => {
        const placeholders = columns.map((col, colIdx) => {
          values.push(row[col]);
          return `$${rowIdx * columns.length + colIdx + 1}${castSuffixFor(columnTypes, col)}`;
        });
        return `(${placeholders.join(', ')})`;
      });

      const conflictClause = onConflict === 'skip' ? ' ON CONFLICT DO NOTHING' : '';
      const query = `INSERT INTO "${tableName}" ("${columns.join('", "')}") VALUES ${valueGroups.join(', ')}${conflictClause}`;
      const insertRes = await client.query(query, values);
      inserted = insertRes.rowCount ?? rows.length;
    }

    if (isFinalChunk) {
      // SERIAL/IDENTITY desync fix: if we just inserted explicit values into
      // an auto-incrementing column, Postgres's internal sequence counter
      // does NOT advance to match. The very next unrelated app insert would
      // then collide with a row we just seeded. For every column touched by
      // this table's insert, check (via the catalog, not by guessing from
      // the schema text) whether it's backed by a sequence, and if so bump
      // the sequence past the current max. Safe to run even if no rows were
      // ever inserted with explicit values — COALESCE falls back to 1.
      for (const col of columns) {
        const seqRes = await client.query('SELECT pg_get_serial_sequence($1, $2) as seq', [tableName, col]);
        const seqName = seqRes.rows[0]?.seq;
        if (!seqName) continue;
        await client.query(
          `SELECT setval($1::regclass, COALESCE((SELECT MAX("${col}") FROM "${tableName}"), 0) + 1, false)`,
          [seqName]
        );
      }
    }

    await client.query('COMMIT');

    return NextResponse.json({ success: true, inserted });
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