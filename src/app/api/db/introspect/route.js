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

    // Get Enums
    const enumsRes = await client.query(`
      SELECT t.typname, ARRAY_AGG(e.enumlabel::text ORDER BY e.enumsortorder) as enum_values
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
      GROUP BY t.typname;
    `);

    // Get Tables & Columns.
    // NOTE: information_schema.columns reports 'USER-DEFINED' for enum
    // columns and 'ARRAY' for array columns instead of the real type name —
    // the actual name lives in udt_name. Left uncorrected, every enum
    // column would render in the DDL as `status USER-DEFINED`, which is
    // meaningless to the LLM generating seed values. We also pull
    // column_default/is_identity so we can flag SERIAL/IDENTITY columns:
    // the LLM needs to know a column self-generates so it doesn't have to
    // treat it as a required input, and the seed route uses this same
    // signal (independently, via pg_get_serial_sequence) to resync the
    // sequence after explicit IDs are inserted.
    const colsRes = await client.query(`
      SELECT
        table_name,
        column_name,
        CASE
          WHEN data_type = 'USER-DEFINED' THEN udt_name
          WHEN data_type = 'ARRAY' THEN substring(udt_name from 2) || '[]'
          ELSE data_type
        END as data_type,
        column_default,
        is_identity,
        is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position;
    `);

    // Get Primary Keys & Unique Constraints
    // We group by constraint name and use ARRAY_AGG with an ORDER BY so that 
    // composite keys (e.g. PRIMARY KEY (user_id, role_id)) maintain exact column order.
    const constraintsRes = await client.query(`
      SELECT
        tc.table_name,
        tc.constraint_type,
        ARRAY_AGG(kcu.column_name::text ORDER BY kcu.ordinal_position) as columns
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = 'public'
        AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
      GROUP BY tc.table_name, tc.constraint_name, tc.constraint_type;
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

    // Format into a standard SQL DDL string for the LLM
    let schemaDDL = '';

    // A. Prepend Enum types (escape embedded quotes so a label like
    // "user's choice" can't break out of the string literal)
    enumsRes.rows.forEach(({ typname, enum_values }) => {
      const values = enum_values.map(v => `'${v.replace(/'/g, "''")}'`).join(', ');
      schemaDDL += `CREATE TYPE ${typname} AS ENUM (${values});\n\n`;
    });

    const tables = {};
    // Tracks which columns are SERIAL/IDENTITY per table so the caller
    // (and the seed route, independently) can know to resync sequences
    // after explicit IDs are inserted.
    const serialColumns = {};

    // B. Scaffold table columns
    colsRes.rows.forEach(({ table_name, column_name, data_type, column_default, is_identity, is_nullable }) => {
      // Note: replaced `fks` array with `constraints` to hold all table-level rules
      if (!tables[table_name]) tables[table_name] = { columns: [], constraints: [] };

      const isSerial = is_identity === 'YES' || /^nextval\(/.test(column_default || '');
      let columnType = data_type;
      if (isSerial) {
        if (!serialColumns[table_name]) serialColumns[table_name] = [];
        serialColumns[table_name].push(column_name);
        columnType = data_type === 'bigint' ? 'BIGSERIAL' : data_type === 'smallint' ? 'SMALLSERIAL' : 'SERIAL';
      }

      const notNull = is_nullable === 'NO' && !isSerial ? ' NOT NULL' : '';
      tables[table_name].columns.push(`${column_name} ${columnType}${notNull}`);
    });

    // C. Attach PKs & Unique Constraints
    constraintsRes.rows.forEach(({ table_name, constraint_type, columns }) => {
      if (tables[table_name]) {
        tables[table_name].constraints.push(`${constraint_type} (${columns.join(', ')})`);
      }
    });

    // D. Attach FKs
    fkRes.rows.forEach(({ table_name, column_name, foreign_table_name, foreign_column_name }) => {
      if (tables[table_name]) {
        tables[table_name].constraints.push(`FOREIGN KEY (${column_name}) REFERENCES ${foreign_table_name}(${foreign_column_name})`);
      }
    });

    // E. Compile final DDL
    for (const [tableName, def] of Object.entries(tables)) {
      schemaDDL += `CREATE TABLE ${tableName} (\n  ${[...def.columns, ...def.constraints].join(',\n  ')}\n);\n\n`;
    }

    return NextResponse.json({ schema: schemaDDL, serialColumns });
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