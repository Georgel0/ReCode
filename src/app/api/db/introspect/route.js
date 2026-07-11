import { NextResponse } from 'next/server';
import { Client } from 'pg';
import {
  assertLooksLikeDbUri,
  assertPublicHostAndPin,
  readJsonWithLimit,
  toClientError,
  safeError
} from '@/lib/server/db-security';

const MAX_BODY_BYTES = 16 * 1024;

export async function POST(request) {
  let client;

  try {
    const { connectionString } = await readJsonWithLimit(request, MAX_BODY_BYTES);

    assertLooksLikeDbUri(connectionString);
    await assertPublicHostAndPin(connectionString);

    if (connectionString.toLowerCase().startsWith('mysql')) {
      throw safeError('MySQL introspection is not yet implemented.');
    }

    // Extract target schema from URI (e.g. ?schema=auth), default to public
    const parsedUrl = new URL(connectionString);
    const targetSchema = parsedUrl.searchParams.get('schema') || 'public';

    client = new Client({
      connectionString,
      connectionTimeoutMillis: 5000,
      query_timeout: 15000,
      statement_timeout: 15000,
    });
    await client.connect();

    // 1. Enums scoped to target schema
    const enumsRes = await client.query(`
      SELECT t.typname, ARRAY_AGG(e.enumlabel::text ORDER BY e.enumsortorder) as enum_values
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = $1
      GROUP BY t.typname;
    `, [targetSchema]);

    // 2. Columns scoped to target schema
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
      WHERE table_schema = $1
      ORDER BY table_name, ordinal_position;
    `, [targetSchema]);

    // 3. Constraints scoped to target schema
    const constraintsRes = await client.query(`
      SELECT
        tc.table_name,
        tc.constraint_type,
        ARRAY_AGG(kcu.column_name::text ORDER BY kcu.ordinal_position) as columns
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = $1
        AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
      GROUP BY tc.table_name, tc.constraint_name, tc.constraint_type;
    `, [targetSchema]);

    // 4. Foreign Keys scoped to target schema
    const fkRes = await client.query(`
      SELECT
        tc.table_name, kcu.column_name, 
        ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = $1;
    `, [targetSchema]);

    let schemaDDL = '';

    enumsRes.rows.forEach(({ typname, enum_values }) => {
      const values = enum_values.map(v => `'${v.replace(/'/g, "''")}'`).join(', ');
      schemaDDL += `CREATE TYPE ${typname} AS ENUM (${values});\n\n`;
    });

    const tables = {};
    const serialColumns = {};

    colsRes.rows.forEach(({ table_name, column_name, data_type, column_default, is_identity, is_nullable }) => {
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

    constraintsRes.rows.forEach(({ table_name, constraint_type, columns }) => {
      if (tables[table_name]) {
        tables[table_name].constraints.push(`${constraint_type} (${columns.join(', ')})`);
      }
    });

    fkRes.rows.forEach(({ table_name, column_name, foreign_table_name, foreign_column_name }) => {
      if (tables[table_name]) {
        tables[table_name].constraints.push(`FOREIGN KEY (${column_name}) REFERENCES ${foreign_table_name}(${foreign_column_name})`);
      }
    });

    for (const [tableName, def] of Object.entries(tables)) {
      schemaDDL += `CREATE TABLE ${tableName} (\n  ${[...def.columns, ...def.constraints].join(',\n  ')}\n);\n\n`;
    }

    return NextResponse.json({ schema: schemaDDL, serialColumns });
  } catch (error) {
    const status = error?.__safeForClient ? 400 : 500;
    return NextResponse.json({ error: toClientError(error) }, { status });
  } finally {
    if (client) {
      try {
        await client.end();
      } catch (_) {}
    }
  }
}