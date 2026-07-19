/**
 * FIREBASE CLIENT & AUTH
 *
 * Handles connection to Firebase services (Auth, Firestore) and anonymous
 * sign-in. Uses a singleton pattern to prevent re-initialization in
 * environments like Next.js where Hot Module Replacement (HMR) occurs.
 */
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

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
 * Ensures the user is authenticated.
 * If no user exists, it performs an anonymous sign-in.
 * @returns {Promise<User>}
 */
let authReadyPromise = null;

export const initializeAuth = () => {
  if (authReadyPromise) return authReadyPromise;

  authReadyPromise = new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe(); // only ever resolve once per attempt
      if (user) {
        resolve(user);
      } else {
        signInAnonymously(auth)
          .then(({ user }) => resolve(user))
          .catch((error) => {
            console.error('[signInAnonymously] failed:', error.code, error.message);
            authReadyPromise = null; // allow a retry on next call
            reject(error);
          });
      }

      console.warn('[authState]', user ? `signed in as ${user.uid}` : 'null — no user', new Date().toISOString());
    }, (error) => {
      console.error('[authState] listener error:', error.code, error.message);
    });
  });

  return authReadyPromise;
};

/**
 * Requests the browser to change storage status from 'Best-Effort' to 'Persistent'.
 * This prevents modern browsers from clearing IndexedDB during long periods of inactivity.
 * @returns {Promise<boolean>} True if storage is successfully marked persistent.
 */
export const requestPersistentStorage = async () => {
  // Guard clause for SSR (Next.js server-side rendering environments)
  if (typeof window === 'undefined' || !navigator.storage || !navigator.storage.persist) {
    return false;
  }

  try {
    // Check if it's already persistent
    const isAlreadyPersisted = await navigator.storage.persisted();
    if (isAlreadyPersisted) {
      return true;
    }
    // Request persistent storage allocation
    const granted = await navigator.storage.persist();

    console.log(`[Storage] Persistent storage permission: ${granted ? 'GRANTED' : 'DENIED'}`);
    return granted;
  } catch (error) {
    console.error('[Storage] Failed to negotiate storage persistence:', error);
    return false;
  }
};
