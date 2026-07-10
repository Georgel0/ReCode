import { NextResponse } from 'next/server';
import { Client } from 'pg';

// Server-side safety ceilings. The client does its own dynamic chunking
// (see chunkTableRows in useDatabaseSeeding.jsx), but the server never
// trusts the client — these limits are enforced independently so a bad
// or malicious payload can't open a giant transaction or blow past
// Postgres's bound-parameter limit (65535).
const MAX_ROWS_PER_REQUEST = 2000;
const MAX_PARAMS_PER_REQUEST = 65000;

// Only allow plain SQL identifiers for table/column names. These values
// come from client-generated schema data, so they're untrusted — and
// since they're interpolated into the query string (Postgres can't
// parametrize identifiers), we validate them ourselves instead of just
// wrapping them in quotes.
const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

function assertValidIdentifier(name, kind) {
  if (typeof name !== 'string' || !IDENTIFIER_RE.test(name)) {
    throw new Error(`Invalid ${kind} name: ${JSON.stringify(name)}`);
  }
}

export async function POST(request) {
  let client;

  try {
    const { connectionString, tableName, columns, rows } = await request.json();

    // --- Validation -------------------------------------------------
    if (!connectionString || typeof connectionString !== 'string' || !connectionString.startsWith('postgres')) {
      return NextResponse.json({ error: 'A valid Postgres connection string is required.' }, { status: 400 });
    }
    if (!Array.isArray(columns) || columns.length === 0) {
      return NextResponse.json({ error: 'columns must be a non-empty array.' }, { status: 400 });
    }

    assertValidIdentifier(tableName, 'table');
    columns.forEach(col => assertValidIdentifier(col, 'column'));

    if (!Array.isArray(rows)) {
      return NextResponse.json({ error: 'rows must be an array.' }, { status: 400 });
    }
    // An empty chunk is a legitimate no-op (e.g. a table with 0 generated rows) — not an error.
    if (rows.length === 0) {
      return NextResponse.json({ success: true, inserted: 0 });
    }
    if (rows.length > MAX_ROWS_PER_REQUEST) {
      return NextResponse.json({
        error: `Chunk too large: ${rows.length} rows exceeds the ${MAX_ROWS_PER_REQUEST}-row limit per request. Reduce the client-side chunk size.`,
      }, { status: 400 });
    }
    if (columns.length * rows.length > MAX_PARAMS_PER_REQUEST) {
      return NextResponse.json({
        error: `Chunk has too many bound parameters (${columns.length * rows.length}). Reduce rows per chunk.`,
      }, { status: 400 });
    }

    // --- Insert -------------------------------------------------------
    client = new Client({ connectionString });
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
    return NextResponse.json({ error: error.message }, { status: 500 });
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