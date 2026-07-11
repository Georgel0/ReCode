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

// Body is just a connection string plus a short list of table names.
const MAX_BODY_BYTES = 16 * 1024;
// Defensive ceiling — a real schema won't have more tables than this in one seed run.
const MAX_TABLES_PER_REQUEST = 500;

// Used two ways from the client:
//  1. "Clear tables before seeding" — called once, before the seed loop starts.
//  2. "Rollback seeded tables" — called after a mid-run failure, passing only
//     the tables that actually received rows during that run.
// A single multi-table TRUNCATE ... CASCADE is used rather than looping
// per-table in FK order: CASCADE already pulls in any dependent rows
// (including tables outside our list) atomically, so there's no need to
// topologically sort the table list first, and either every table clears or
// none do.
export async function POST(request) {
  let client;

  try {
    assertBodyWithinLimit(request, MAX_BODY_BYTES);

    const { connectionString, tableNames } = await request.json();

    assertLooksLikePostgresUri(connectionString);
    await assertPublicHost(connectionString);

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

    const quotedList = tableNames.map(t => `"${t}"`).join(', ');
    // RESTART IDENTITY resets any SERIAL/IDENTITY sequences on these tables
    // back to their start value — a clean slate, not just an empty table.
    await client.query(`TRUNCATE TABLE ${quotedList} RESTART IDENTITY CASCADE`);

    return NextResponse.json({ success: true, truncated: tableNames });
  } catch (error) {
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