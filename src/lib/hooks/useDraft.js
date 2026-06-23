'use client';

import { useEffect, useRef } from 'react';
import { get, set, del } from 'idb-keyval';
import debounce from 'lodash/debounce';

/**
 * Persists a state snapshot to IndexedDB on a debounce, and restores it on mount.
 *
 * @param {string}   key            - Unique IDB key per tool, e.g. 'converter-draft-data'
 * @param {any}      data           - Current state snapshot to watch and persist
 * @param {function} onRestore      - Called with the saved value when one exists on mount
 * @param {object}   [options]
 * @param {number}   [options.debounceMs=1500]  - Save debounce delay in ms
 * @param {function} [options.isEmpty]          - (data) => bool — deletes draft instead of saving when true
 * @param {boolean}  [options.skip]             - Disables both load and save (e.g. when a history entry is active)
 */
export function useDraft(key, data, onRestore, {
  debounceMs = 1500,
  isEmpty = () => false,
  skip = false,
} = {}) {
  const saveRef = useRef(
    debounce(async ({ key, data, isEmpty }) => {
      try {
        if (isEmpty(data)) {
          await del(key);
        } else {
          await set(key, data);
        }
      } catch (e) {
        console.error(`[useDraft] save failed for "${key}":`, e);
      }
    }, debounceMs)
  );

  // Load on mount — runs once, guarded by skip
  useEffect(() => {
    if (skip) return;
    let cancelled = false;
    (async () => {
      try {
        const saved = await get(key);
        if (!cancelled && saved != null) onRestore(saved);
      } catch (e) {
        console.error(`[useDraft] load failed for "${key}":`, e);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally mount-only

  // Save whenever data changes, cancel debounce on unmount
  useEffect(() => {
    if (skip) return;
    const save = saveRef.current;
    save({ key, data, isEmpty });
    return () => save.cancel();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, skip]);
}