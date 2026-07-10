// Shared server-side hardening for the /api/db/* routes. These routes take
// a live Postgres connection string from the client and either read schema
// (introspect) or bulk-insert rows (seed), so they get extra scrutiny:
// SSRF protection, identifier validation, body-size limits, and
// error-message sanitization.
//
// Errors thrown by helpers in this file are pre-approved to show to the
// client (they describe what's wrong with the request, not internals) —
// see `safeError` / `toClientError` below.

import dns from 'node:dns/promises';

// Marking errors as safe to return to the client
export function safeError(message) {
  const err = new Error(message);
  err.__safeForClient = true;
  return err;
}

// Real pg/connection errors can include internal detail (hostnames, ports,
// driver internals, sometimes even part of the connection string) that's
// fine to log server-side but shouldn't go back to the client verbatim.
// Anything not explicitly marked safe gets genericized here; the original
// is still logged for your own debugging.
export function toClientError(error) {
  console.error(error);
  if (error && error.__safeForClient) {
    return error.message;
  }
  return 'The request could not be completed. Check your connection string and try again.';
}

// SQL identifier validation
// ---------------------------------------------------------------------------
// Table/column names come from client-generated schema data and are
// interpolated directly into SQL (Postgres can't bind-parameter
// identifiers), so they're validated against a strict allowlist pattern
// rather than just quoted.
const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function assertValidIdentifier(name, kind) {
  if (typeof name !== 'string' || !IDENTIFIER_RE.test(name)) {
    throw safeError(`Invalid ${kind} name.`);
  }
}

// ---------------------------------------------------------------------------
// Connection-string sanity check
export function assertLooksLikePostgresUri(connectionString) {
  if (
    typeof connectionString !== 'string' ||
    !/^postgres(ql)?:\/\//i.test(connectionString)
  ) {
    throw safeError('A valid Postgres connection string is required.');
  }
}

// ---------------------------------------------------------------------------
// SSRF guard
// ---------------------------------------------------------------------------
// Even once these routes require auth, an authorized-but-malicious or just
// mistaken connection string could point this server at its own internal
// network (a VPC-internal database, an RDS instance behind a security
// group, or a cloud metadata endpoint like 169.254.169.254). Resolve the
// host and reject anything in a private/internal range.
//
// Caveat: this checks the address at request time, not the moment `pg`
// actually opens the socket, so it doesn't fully close a DNS-rebinding
// style race (attacker's DNS returns a public IP for this check, then a
// private one moments later for the real connection). If you reach a point
// where you know your legitimate DB hosts in advance, an allowlist of
// hostnames is strictly stronger than this denylist — worth revisiting
// once this isn't just "whatever Postgres URL a developer types in."
const BLOCKED_V4_RANGES = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

function ipv4ToInt(ip) {
  return ip.split('.').reduce((acc, oct) => (acc << 8) + Number(oct), 0) >>> 0;
}

function isBlockedV4(ip) {
  const target = ipv4ToInt(ip);
  return BLOCKED_V4_RANGES.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (target & mask) === (ipv4ToInt(base) & mask);
  });
}

function isBlockedV6(ip) {
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  if (lower.startsWith('fe80:')) return true; // link-local
  if (/^f[cd][0-9a-f]{2}:/.test(lower)) return true; // unique local fc00::/7
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedV4(mapped[1]);
  return false;
}

export async function assertPublicHost(connectionString) {
  let hostname;
  try {
    hostname = new URL(connectionString).hostname;
  } catch {
    throw safeError('Malformed connection string.');
  }

  if (!hostname) throw safeError('Connection string is missing a host.');
  if (hostname.toLowerCase() === 'localhost') {
    throw safeError('Connections to localhost are not allowed.');
  }

  let addresses;
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    throw safeError('Could not resolve database host.');
  }

  for (const { address, family } of addresses) {
    const blocked = family === 4 ? isBlockedV4(address) : isBlockedV6(address);
    if (blocked) {
      throw safeError('Connections to private or internal network addresses are not allowed.');
    }
  }
}

// ---------------------------------------------------------------------------
// Request body size guard
// ---------------------------------------------------------------------------
// A cheap first line of defense against oversized payloads before we ever
// call request.json(). Relies on Content-Length, which fetch() always sets
// for a JSON body — not a hard guarantee against a hand-crafted request
// that omits or lies about it, just a fast rejection for the common case.
export function assertBodyWithinLimit(request, maxBytes) {
  const len = Number(request.headers.get('content-length') || 0);
  if (len > maxBytes) {
    throw safeError(`Request body too large (max ${Math.floor(maxBytes / 1024)}KB).`);
  }
}