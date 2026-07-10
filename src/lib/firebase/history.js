/**
 * FIRESTORE HISTORY
 *
 * CRUD and real-time subscription helpers for the user's saved tool-run
 * history, stored at users/{uid}/history.
 */
import {
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  getDocs,
  deleteDoc,
  doc,
  setDoc,
  writeBatch,
  Timestamp,
  where,
  serverTimestamp,
  onSnapshot
} from "firebase/firestore";
import { onAuthStateChanged, signInWithCustomToken } from "firebase/auth";
import { auth, db } from "./client";

/**
 * DEVICE A: Generates a code and saves it to Firestore
 */
export const generateSyncCode = async () => {
  if (!auth.currentUser) throw new Error("Not authenticated");

  // Generate a random 6-character alphanumeric code
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  
  await setDoc(doc(db, "syncCodes", code), {
    uid: auth.currentUser.uid,
    expiresAt: Date.now() + 15 * 60 * 1000 // Expires in 15 minutes
  });

  return code; 
};

/**
 * DEVICE B: Verifies the code via your API and signs in
 */
export const consumeSyncCode = async (code) => {
  const response = await fetch('/api/auth/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Failed to sync devices");
  }

  // Swap out the current anonymous session for the synced one!
  await signInWithCustomToken(auth, data.token);
  
  return true;
};

/**
 * HELPER: Gets a reference to the 'history' sub-collection for the current user.
 * Pattern: users/{uid}/history
 * @returns {CollectionReference|null}
 */
const getHistoryRef = () => {
  if (!auth.currentUser) return null;
  return collection(db, "users", auth.currentUser.uid, "history");
};

/**
 * UTILITY: Handles Firestore's 500-operation limit for write batches.
 * Splits an array of documents into chunks and commits them sequentially.
 * @param {QueryDocumentSnapshot[]} docs - Array of documents to delete.
 */
const commitBatchInChunks = async (docs) => {
  const CHUNK_SIZE = 500;
  for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
    const chunk = docs.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
};

/**
 * Real-time listener for the user's history.
 * 1. Waits for Authentication state.
 * 2. Sets up a Firestore snapshot listener.
 * 3. Handles cleanup of both listeners to prevent memory leaks.
 * @param {Function} callback - Function called with the updated list of items.
 * @returns {Function} Cleanup function to unsubscribe.
 */
export const subscribeToHistory = (callback) => {
  let unsubscribeSnapshot = null;

  const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
    // Kill the previous Firestore listener if the user ID changed
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot();
      unsubscribeSnapshot = null;
    }

    if (user) {
      const historyRef = collection(db, "users", user.uid, "history");
      const q = query(historyRef, orderBy("createdAt", "desc"), limit(50));

      unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
        const items = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        callback(items);
      }, (error) => {
        console.error("Error subscribing to history:", error);
      });
    } else {
      callback([]); // Reset UI if logged out
    }
  });

  return () => {
    if (unsubscribeSnapshot) unsubscribeSnapshot();
    unsubscribeAuth();
  };
};

export const cleanupOldHistory = async () => {
  const historyRef = getHistoryRef();
  if (!historyRef) return;

  try {
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 30);

    const q = query(historyRef, where("createdAt", "<", Timestamp.fromDate(tenDaysAgo)));
    const snapshot = await getDocs(q);

    if (snapshot.empty) return;

    await commitBatchInChunks(snapshot.docs);
    console.log(`Cleanup: Deleted ${snapshot.size} items.`);
  } catch (error) {
    console.error("Cleanup failed:", error);
  }
};

export const clearAllHistory = async () => {
  const historyRef = getHistoryRef();
  if (!historyRef) return;

  try {
    const snapshot = await getDocs(query(historyRef));
    if (snapshot.empty) return;

    await commitBatchInChunks(snapshot.docs);
    console.log(`Clear All: Deleted ${snapshot.size} items.`);
  } catch (error) {
    console.error("Error clearing history:", error);
    throw error;
  }
};

export const deleteHistoryItem = async (docId) => {
  if (!auth.currentUser) return;
  try {
    const docRef = doc(db, "users", auth.currentUser.uid, "history", docId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting item:", error);
    throw error;
  }
};

/**
 * Saves a new interaction to the database.
 * @param {string} type - The category of history (e.g., 'analysis', 'generation').
 * @param {string} input - User input.
 * @param {string} output - System response.
 * @param {string} [sourceLang] - Optional source language code.
 * @param {string} [targetLang] - Optional target language code.
 */
export const saveHistory = async (type, input, output, sourceLang = null, targetLang = null) => {
  const historyRef = getHistoryRef();
  if (!historyRef) return;

  try {
    const sanitize = (obj) => JSON.parse(JSON.stringify(obj, (_, v) => v === undefined ? null : v));
    const data = {
      ...sanitize({
        type,
        input,
        fullOutput: output,
        sourceLang: sourceLang || null,
        targetLang: targetLang || null }),
      createdAt: serverTimestamp(),
    };
    await addDoc(historyRef, data);
  } catch (e) {
    console.error("Error adding document: ", e);
  }
};

export const getHistory = async () => {
  const historyRef = getHistoryRef();
  if (!historyRef) return [];

  const q = query(historyRef, orderBy("createdAt", "desc"), limit(50));

  try {
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error("Error fetching history:", error);
    return [];
  }
};
