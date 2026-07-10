import { NextResponse } from 'next/server';
import admin from "firebase-admin";

// Ensure Firebase Admin is initialized (same as your existing route.js)
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

    const db = admin.firestore();
    const codeRef = db.collection('syncCodes').doc(code.toUpperCase());
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

    return NextResponse.json({ token: customToken });

  } catch (error) {
    console.error("Sync Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}