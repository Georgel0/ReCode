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
