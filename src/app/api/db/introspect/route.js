import { NextResponse } from 'next/server';
import { Client } from 'pg'; // Add mysql2 logic later based on the URI prefix
import {
  assertLooksLikePostgresUri,
  assertPublicHost,
  assertBodyWithinLimit,
  toClientError,
} from '@/lib/server/db-security';

// Just a connection string in the body — no reason for this request to be
// anything but tiny.
const MAX_BODY_BYTES = 16 * 1024;

export async function POST(request) {
  let client;

  try {
    assertBodyWithinLimit(request, MAX_BODY_BYTES);

    const { connectionString } = await request.json();

    assertLooksLikePostgresUri(connectionString);
    await assertPublicHost(connectionString);

    client = new Client({
      connectionString,
      connectionTimeoutMillis: 5000,
      query_timeout: 15000,
      statement_timeout: 15000,
    });
    await client.connect();

    // Get Tables & Columns
    const colsRes = await client.query(`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public'
    `);

    // Get Real Foreign Keys (The magic missing from the heuristic)
    const fkRes = await client.query(`
      SELECT
        tc.table_name, kcu.column_name, 
        ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY';
    `);

    // Format into a standard SQL DDL string for your LLM
    const tables = {};
    colsRes.rows.forEach(({ table_name, column_name, data_type }) => {
      if (!tables[table_name]) tables[table_name] = { columns: [], fks: [] };
      tables[table_name].columns.push(`${column_name} ${data_type}`);
    });

    fkRes.rows.forEach(({ table_name, column_name, foreign_table_name, foreign_column_name }) => {
      if (tables[table_name]) {
        tables[table_name].fks.push(`FOREIGN KEY (${column_name}) REFERENCES ${foreign_table_name}(${foreign_column_name})`);
      }
    });

    let schemaDDL = '';
    for (const [tableName, def] of Object.entries(tables)) {
      schemaDDL += `CREATE TABLE ${tableName} (\n  ${[...def.columns, ...def.fks].join(',\n  ')}\n);\n\n`;
    }

    return NextResponse.json({ schema: schemaDDL });
  } catch (error) {
    const status = error?.__safeForClient ? 400 : 500;
    return NextResponse.json({ error: toClientError(error) }, { status });
  } finally {
    // Previously this only ran on the success path — if any query threw,
    // the client was never closed and the connection leaked. Now it always
    // runs, success or failure.
    if (client) {
      try {
        await client.end();
      } catch (_) {
        // Already closed/errored — ignore.
      }
    }
  }
}