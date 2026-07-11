import { NextResponse } from 'next/server';
import admin from "firebase-admin";
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

export async function POST(request) {
  try {
    const { code } = await request.json();
    if (!code) return NextResponse.json({ error: 'Code is required' }, { status: 400 });

    const normalizedCode = code.toUpperCase();
    const db = admin.firestore();
    const codeRef = db.collection('syncCodes').doc(normalizedCode);
    const doc = await codeRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 404 });
    }

    const data = doc.data();
    
    // Check expiration (e.g., 15 minutes)
    if (data.expiresAt < Date.now()) {
      await codeRef.delete(); // Clean up expired code
      return NextResponse.json({ error: 'Code has expired' }, { status: 400 });
    }

    // Mint a custom auth token for this exact UID
    const customToken = await admin.auth().createCustomToken(data.uid);

    // Burn the code so it's strictly single-use
    await codeRef.delete();

    // Best-effort: pick up any local draft/settings data the source device
    // pushed to Redis under this same code, and burn that too. If nothing
    // was pushed (or it already expired), localData just stays null — the
    // auth/history sync above still succeeds either way. Only this exact
    // key is ever touched, never a broader scan/flush of Redis.
    let localData = null;
    try {
      const redis = await getRedisClient();
      const redisKey = `syncdraft:${normalizedCode}`;
      const raw = await redis.get(redisKey);
      if (raw) {
        localData = JSON.parse(raw);
        await redis.del(redisKey);
      }
    } catch (redisError) {
      console.error("Sync: failed to fetch local draft data:", redisError);
    }

    return NextResponse.json({ token: customToken, localData });

  } catch (error) {
    console.error("Sync Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}