'use client';

import { keys, getMany, setMany } from 'idb-keyval';

/**
 * DEVICE-SYNC: LOCAL DATA (IndexedDB drafts + localStorage settings)
 *
 * Used alongside history.js's generateSyncCode / consumeSyncCode to also
 * transfer draft data (see useDraft.js) and app settings (autosave, theme,
 * etc.) between devices during a sync, not just Firestore history.
 */

// useDraft.js keys all follow the "<tool>-draft-data" convention
// (see the JSDoc example in useDraft.js: 'converter-draft-data').
// Only sync keys matching this pattern — never the whole IDB store blindly.
const IDB_KEY_PATTERN = /-draft-data$/;

// Only sync our own app's localStorage keys (recode-theme, recode_autoSave, etc),
// never arbitrary localStorage contents from other scripts/extensions on the page.
const LOCAL_STORAGE_PREFIX = 'recode';

/**
 * Reads this device's drafts (IndexedDB) and settings (localStorage) into a
 * plain JSON-serializable payload, ready to be pushed to the sync endpoint.
 */
export async function collectLocalSyncPayload() {
  const idb = {};
  try {
    const allKeys = await keys();
    const relevantKeys = allKeys.filter(
      (k) => typeof k === 'string' && IDB_KEY_PATTERN.test(k)
    );
    if (relevantKeys.length) {
      const values = await getMany(relevantKeys);
      relevantKeys.forEach((k, i) => {
        if (values[i] !== undefined) idb[k] = values[i];
      });
    }
  } catch (e) {
    console.error('[localSync] failed to read IndexedDB drafts:', e);
  }

  const localStorageData = {};
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(LOCAL_STORAGE_PREFIX)) {
        localStorageData[key] = window.localStorage.getItem(key);
      }
    }
  } catch (e) {
    console.error('[localSync] failed to read localStorage:', e);
  }

  return { idb, localStorage: localStorageData };
}

/**
 * Writes a payload received from the sync endpoint back into this device's
 * IndexedDB and localStorage. Best-effort per key — one bad key shouldn't
 * block the rest from applying.
 */
export async function applyLocalSyncPayload(payload) {
  if (!payload) return;
  const { idb, localStorage: ls } = payload;

  if (idb && Object.keys(idb).length) {
    try {
      await setMany(Object.entries(idb));
    } catch (e) {
      console.error('[localSync] failed to write IndexedDB drafts:', e);
    }
  }

  if (ls) {
    Object.entries(ls).forEach(([key, value]) => {
      try {
        window.localStorage.setItem(key, value);
      } catch (e) {
        console.error(`[localSync] failed to write localStorage key "${key}":`, e);
      }
    });
  }
}