import { NextResponse } from 'next/server';

// Gates the DB introspection/seeding routes behind either a static admin key
// or verified per-user Firebase authentication tokens.
const PROTECTED_PREFIX = '/api/db';
const KEY_HEADER = 'x-recode-admin-key';

// Constant-time string comparison for static keys.
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

// Helper to fix Base64URL and add strict padding required by Edge runtime
function base64UrlDecode(str) {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4;
  if (pad) {
    b64 += '='.repeat(4 - pad);
  }
  return atob(b64);
}

// Edge-safe cryptographic validation of the Firebase ID token using native Web Crypto APIs.
async function verifyFirebaseToken(token, projectId) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;

    // 1. Use the new helper here
    const payload = JSON.parse(base64UrlDecode(payloadB64));

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return null;
    if (payload.aud !== projectId) return null;
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) return null;

    // 2. Use the new helper here
    const header = JSON.parse(base64UrlDecode(headerB64));
    const kid = header.kid;

    const res = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com', {
      next: { revalidate: 3600 }
    });
    const { keys } = await res.json();
    const jwk = keys.find(k => k.kid === kid);
    if (!jwk) return null;

    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const encoder = new TextEncoder();
    const data = encoder.encode(`${headerB64}.${payloadB64}`);

    // 3. Rebuild the signature binary string safely using the helper
    const binaryStr = base64UrlDecode(signatureB64);
    const signature = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      signature[i] = binaryStr.charCodeAt(i);
    }

    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      signature,
      data
    );

    return valid ? payload : null;
  } catch (err) {
    console.error('Firebase token verification failed in proxy middleware:', err);
    return null;
  }
}

async function isAuthorized(request) {
  // Option A: Fall back onto standard secret admin key validation
  const expectedKey = process.env.RECODE_ADMIN_KEY;
  const suppliedKey = request.headers.get(KEY_HEADER) || '';
  if (expectedKey && suppliedKey && timingSafeEqual(suppliedKey, expectedKey)) {
    return true;
  }

  // Option B: Validate incoming Bearer Tokens from Frontend Firebase Session
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (token) {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    if (!projectId) {
      console.warn("Middleware missing NEXT_PUBLIC_FIREBASE_PROJECT_ID environment configuration.");
      return false;
    }
    const decoded = await verifyFirebaseToken(token, projectId);
    if (decoded) return true;
  }

  return false;
}

function hasValidOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === request.nextUrl.host;
  } catch {
    return false;
  }
}

export async function proxy(request) {
  if (!request.nextUrl.pathname.startsWith(PROTECTED_PREFIX)) {
    return NextResponse.next();
  }

  if (!hasValidOrigin(request)) {
    return NextResponse.json({ error: 'Cross-site request rejected.' }, { status: 403 });
  }

  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Missing or invalid authentication.' }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/db/:path*'],
};