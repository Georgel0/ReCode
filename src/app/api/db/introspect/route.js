import { NextResponse } from 'next/server';
import { Client } from 'pg'; // Add mysql2 logic later based on the URI prefix

export async function POST(request) {
  try {
    const { connectionString } = await request.json();
    
    // Quick validation
    if (!connectionString.startsWith('postgres')) {
      return NextResponse.json({ error: 'Currently only Postgres is supported in this example.' }, { status: 400 });
    }

    const client = new Client({ connectionString });
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

    await client.end();

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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}