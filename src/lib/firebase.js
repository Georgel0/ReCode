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

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

// Gets the reference to the current user's history collection
const getHistoryRef = () => {
  if (!auth.currentUser) return null;
  return collection(db, "users", auth.currentUser.uid, "history");
};

// Handle Firestore's 500-document limit for batches
const commitBatchInChunks = async (docs) => {
  const CHUNK_SIZE = 500;
  for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
    const chunk = docs.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
};

export const subscribeToHistory = (callback) => {
  const historyRef = getHistoryRef();
  if (!historyRef) return () => {};
  
  const q = query(historyRef, orderBy("createdAt", "desc"), limit(50));
  
  // onSnapshot listens for real-time updates
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    callback(items);
  }, (error) => {
    console.error("Error subscribing to history:", error);
  });
};

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

export const saveHistory = async (type, input, output, sourceLang = null, targetLang = null) => {
  const historyRef = getHistoryRef();
  if (!historyRef) return;
  
  try {
    const data = {
      type,
      input,
      fullOutput: output,
      createdAt: serverTimestamp(),
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