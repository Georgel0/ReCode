/**
 * FIREBASE CONFIGURATION & INITIALIZATION
 * * Handles connection to Firebase services (Auth, Firestore).
 * Uses a singleton pattern to prevent re-initialization in environments like Next.js where Hot Module Replacement (HMR) occurs.
 */
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  getDocs,
  deleteDoc,
  doc,
  writeBatch,
  Timestamp,
  where,
  serverTimestamp,
  onSnapshot
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Singleton: Initialize Firebase only if an instance doesn't already exist
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

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

/**
 * Ensures the user is authenticated. 
 * If no user exists, it performs an anonymous sign-in.
 * @returns {Promise<User>}
 */
export const initializeAuth = () => {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        resolve(user);
      } else {
        signInAnonymously(auth)
          .then(({ user }) => resolve(user))
          .catch((error) => {
            console.error("Auth Error:", error);
            reject(error);
          });
      }
    });
  });
};


export const cleanupOldHistory = async () => {
  const historyRef = getHistoryRef();
  if (!historyRef) return;
  
  try {
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    
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
    const data = {
      type,
      input,
      fullOutput: output,
      createdAt: serverTimestamp(), // Use server time for consistency
      ...(sourceLang && { sourceLang }),
      ...(targetLang && { targetLang })
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