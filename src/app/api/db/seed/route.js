import { NextResponse } from 'next/server';
import { Client } from 'pg';

export async function POST(request) {
  try {
    const { connectionString, sortedTables } = await request.json();
    
    const client = new Client({ connectionString });
    await client.connect();

    // Use a transaction so if one table fails, everything rolls back
    await client.query('BEGIN');

    for (const table of sortedTables) {
      if (!table.rows || table.rows.length === 0) continue;
      
      const columns = Object.keys(table.rows[0]);
      
      for (const row of table.rows) {
        // Parametrized queries to prevent SQL injection and handle weird characters
        const values = columns.map(col => row[col]);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
        
        const query = `INSERT INTO "${table.tableName}" ("${columns.join('", "')}") VALUES (${placeholders})`;
        await client.query(query, values);
      }
    }

    await client.query('COMMIT');
    await client.end();

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}