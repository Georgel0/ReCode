import { NextResponse } from 'next/server';

// Gates the DB introspection/seeding routes behind HTTP Basic Auth until
// real user accounts + per-user authorization exist. These routes let a
// caller open arbitrary Postgres connections and (for /seed) write rows,
// so they must never be reachable without credentials.
//
// This file runs on the Edge Runtime (Next.js middleware default), which
// only has Web APIs, not Node's standard library — so no `node:crypto` or
// `Buffer` here, only things like TextEncoder/TextDecoder and atob.
//
// Env vars required: BASIC_AUTH_USER, BASIC_AUTH_PASS
const PROTECTED_PREFIX = '/api/db';

// Constant-time string comparison without node:crypto. Walks the full
// length of the longer input regardless of where a mismatch occurs, so a
// wrong guess can't be narrowed down by measuring response time.
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

// atob (Web API, available on Edge) decodes base64 to a "binary string"
// (one char per byte) — re-encode as bytes and decode as UTF-8 so a
// multi-byte character in the password survives the round trip.
function decodeBase64(value) {
  try {
    const binary = atob(value);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

function isAuthorized(request) {
  const expectedUser = process.env.BASIC_AUTH_USER;
  const expectedPass = process.env.BASIC_AUTH_PASS;

  if (!expectedUser || !expectedPass) {
    // Fail closed: if credentials aren't configured (e.g. forgot to set
    // them in this environment), nobody gets in rather than silently
    // leaving the route open.
    return false;
  }

  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Basic ')) return false;

  const decoded = decodeBase64(header.slice(6));
  if (decoded === null) return false;

  const sepIndex = decoded.indexOf(':');
  if (sepIndex === -1) return false;

  const suppliedUser = decoded.slice(0, sepIndex);
  const suppliedPass = decoded.slice(sepIndex + 1);

  return (
    timingSafeEqual(suppliedUser, expectedUser) &&
    timingSafeEqual(suppliedPass, expectedPass)
  );
}

// Lightweight CSRF check. HTTP Basic credentials are cached by the browser
// and re-sent automatically on ANY request to this origin — including ones
// triggered by a form or fetch() on a completely different site the user
// happens to have open in another tab. Basic Auth alone doesn't stop that.
//
// Browsers send an Origin header on POST/PUT/DELETE requests. If it's
// present and doesn't match this app's own origin, reject the request.
// Non-browser clients (curl, server-to-server calls, Postman) typically
// don't send Origin at all, so legitimate direct/API usage is unaffected —
// this only blocks the case where a *browser* is making a cross-site call.
function hasValidOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === request.nextUrl.host;
  } catch {
    return false;
  }
}

export function middleware(request) {
  if (!request.nextUrl.pathname.startsWith(PROTECTED_PREFIX)) {
    return NextResponse.next();
  }

  if (!hasValidOrigin(request)) {
    return NextResponse.json({ error: 'Cross-site request rejected.' }, { status: 403 });
  }

  if (!isAuthorized(request)) {
    return new NextResponse('Authentication required.', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="db-tools", charset="UTF-8"' },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/db/:path*'],
};