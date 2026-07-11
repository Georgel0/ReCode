import { NextResponse } from 'next/server';
import { Client } from 'pg';
import {
  assertValidIdentifier,
  assertLooksLikeDbUri,
  assertPublicHostAndPin,
  readJsonWithLimit,
  toClientError,
  safeError,
} from '@/lib/server/db-security';

const MAX_BODY_BYTES = 16 * 1024;
const MAX_TABLES_PER_REQUEST = 500;

export async function POST(request) {
  let client;

  try {
    const { connectionString, tableNames } = await readJsonWithLimit(request, MAX_BODY_BYTES);

    assertLooksLikeDbUri(connectionString);
    await assertPublicHostAndPin(connectionString);

    if (connectionString.toLowerCase().startsWith('mysql')) {
      throw safeError('MySQL truncation is not yet implemented.');
    }

    const targetSchema = new URL(connectionString).searchParams.get('schema') || 'public';
    assertValidIdentifier(targetSchema, 'schema');

    if (!Array.isArray(tableNames) || tableNames.length === 0) {
      throw safeError('tableNames must be a non-empty array.');
    }
    if (tableNames.length > MAX_TABLES_PER_REQUEST) {
      throw safeError(`Too many tables in one request (${tableNames.length}, max ${MAX_TABLES_PER_REQUEST}).`);
    }
    tableNames.forEach(name => assertValidIdentifier(name, 'table'));

    client = new Client({
      connectionString,
      connectionTimeoutMillis: 5000,
      query_timeout: 30000,
      statement_timeout: 30000,
    });
    await client.connect();

    // Map targets to their explicit schema namespaces
    const quotedList = tableNames.map(t => `"${targetSchema}"."${t}"`).join(', ');
    await client.query(`TRUNCATE TABLE ${quotedList} RESTART IDENTITY CASCADE`);

    return NextResponse.json({ success: true, truncated: tableNames });
  } catch (error) {
    const status = error?.__safeForClient ? 400 : 500;
    return NextResponse.json({ error: toClientError(error) }, { status });
  } finally {
    if (client) {
      try { await client.end(); } catch (_) {}
    }
  }
}