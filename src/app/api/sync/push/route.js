import { NextResponse } from 'next/server';
import admin from 'firebase-admin';
import { getRedisClient } from '@/lib/redis';

function initializeFirebase() {
  if (admin.apps.length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return;
  try {
    const serviceAccount = JSON.parse(raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf-8'));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } catch (error) {
    console.error("Firebase Init Error:", error);
  }
}
initializeFirebase();

// Matches the 15-minute lifetime of the Firestore syncCodes doc — this Redis
// key should never outlive (or meaningfully outlast) the code it's tied to.
const SYNC_DRAFT_TTL_SECONDS = 15 * 60;

// Sanity guard so a runaway payload can't get shoved into Redis.
const MAX_PAYLOAD_CHARS = 2 * 1024 * 1024; // ~2MB of JSON

export async function POST(request) {
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await admin.auth().verifyIdToken(token);
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  try {
    const { code, payload } = await request.json();

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Missing sync code' }, { status: 400 });
    }
    if (!payload || typeof payload !== 'object') {
      return NextResponse.json({ error: 'Missing payload' }, { status: 400 });
    }

    const serialized = JSON.stringify(payload);
    if (serialized.length > MAX_PAYLOAD_CHARS) {
      return NextResponse.json({ error: 'Payload too large to sync' }, { status: 413 });
    }

    const redis = await getRedisClient();

    // Namespaced under "syncdraft:" so it can never collide with "mock:*" or
    // any other key family already living in the same Redis instance. Only
    // this exact key is ever written, read, or deleted by the sync feature.
    await redis.set(`syncdraft:${code.toUpperCase()}`, serialized, { EX: SYNC_DRAFT_TTL_SECONDS });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Sync push error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}