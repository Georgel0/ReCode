import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './client';

/**
 * Logs a real usage event (not a page view) tied to the current anon UID.
 * Call this ONLY on meaningful actions — e.g. seed run completed, mock server
 * started — never on page load/mount, or you'll conflate visits with usage.
 */
export async function logGenerationEvent(toolName, metadata = {}) {
  const uid = auth.currentUser?.uid;
  if (!uid) return; // anon auth not ready yet, skip silently

  try {
    await addDoc(collection(db, 'usage_events'), {
      uid,
      tool: toolName,       // e.g. 'database-seeding', 'api-mocks', 'streaming-events'
      timestamp: serverTimestamp(),
      ...metadata,
    });
  } catch (err) {
    console.error('usage log failed', err); // fail silently, never block the real feature
  }
}