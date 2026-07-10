import { NextResponse } from 'next/server';

// Gates the DB introspection/seeding routes behind a single static key
// until real user accounts + per-user authorization exist. These routes
// let a caller open arbitrary Postgres connections and (for /seed) write
// rows, so they must never be reachable without a check.
//
// This is a dev/admin-only surface for 1-2 known people (not the public
// Mock Data Factory flow), so a shared secret checked via a plain header
// is enough — no interactive login prompt, no per-user accounts needed
// yet. Send it as:
//   x-recode-admin-key: <value of RECODE_ADMIN_KEY>
//
// Env var required: RECODE_ADMIN_KEY
const PROTECTED_PREFIX = '/api/db';
const KEY_HEADER = 'x-recode-admin-key';

// Constant-time string comparison. Walks the full length of the longer
// input regardless of where a mismatch occurs, so a wrong guess can't be
// narrowed down by measuring response time.
function timingSafeEqual(a, b) {
  const bufA = new TextEncoder().encode(a);
  const bufB = new TextEncoder().encode(b);
  const maxLen = Math.max(bufA.length, bufB.length, 1);
  let diff = bufA.length === bufB.length ? 0 : 1;
  for (let i = 0; i < maxLen; i++) {
    diff |= (bufA[i] ?? 0) ^ (bufB[i] ?? 0);
  }
  return diff === 0;
}

function isAuthorized(request) {
  const expectedKey = process.env.RECODE_ADMIN_KEY;

  if (!expectedKey) {
    // Fail closed: if the key isn't configured (e.g. forgot to set it in
    // this environment), nobody gets in rather than silently leaving the
    // route open.
    return false;
  }

  const suppliedKey = request.headers.get(KEY_HEADER) || '';
  if (!suppliedKey) return false;

  return timingSafeEqual(suppliedKey, expectedKey);
}

// Defense-in-depth: reject cross-site browser requests even though a
// custom header (unlike Basic Auth) isn't auto-attached by the browser on
// cross-site calls, so this mainly guards against future changes that
// might read the key from a cookie instead.
function hasValidOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === request.nextUrl.host;
  } catch {
    return false;
  }
}

export function proxy(request) {
  if (!request.nextUrl.pathname.startsWith(PROTECTED_PREFIX)) {
    return NextResponse.next();
  }

  if (!hasValidOrigin(request)) {
    return NextResponse.json({ error: 'Cross-site request rejected.' }, { status: 403 });
  }

  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Missing or invalid key.' }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/db/:path*'],
};