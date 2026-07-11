'use client';

import { useEffect } from 'react';
import { initializeAuth } from '@/lib/firebase';

/**
 * Mount once at the app root. Its only job is to kick off Firebase auth
 * (anonymous sign-in if needed) as early as possible, so auth.currentUser
 * is populated well before the user interacts with anything that needs it
 * (save history, convert, etc). Without this, auth only initializes lazily
 * on first API call, which causes silent no-op failures for anything that
 * runs before that (e.g. ModuleHeader's save-on-mount / autosave).
 *
 * Renders nothing.
 */
export function AuthBootstrap() {
  useEffect(() => {
    initializeAuth().catch((err) => {
      console.error('Auth bootstrap failed:', err);
    });
  }, []);

  return null;
}