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
  // 1. Guard flag to prevent overwriting IDB before the initial load finishes
  const isReadyRef = useRef(false);

  const saveRef = useRef(
    debounce(async ({ key, data, isEmpty }) => {
      // Guard: Never save or delete if we haven't finished loading the existing draft!
      if (!isReadyRef.current) return; 
      
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

  // Load on mount
  useEffect(() => {
    if (skip) return;
    let cancelled = false;
    (async () => {
      try {
        const saved = await get(key);
        if (!cancelled && saved != null) onRestore(saved);
      } catch (e) {
        console.error(`[useDraft] load failed for "${key}":`, e);
      } finally {
        // Mark load as complete so saving is now allowed
        if (!cancelled) isReadyRef.current = true; 
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save whenever data changes (debounced)
  const dataString = JSON.stringify(data);
  
  useEffect(() => {
    if (skip) return;
    saveRef.current({ key, data, isEmpty });
    // NO cleanup here! We want the debounce to run undisturbed while typing.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataString, skip]);

  // Flush ONLY on actual component unmount (changing pages)
  useEffect(() => {
    const save = saveRef.current;
    return () => {
      if (isReadyRef.current) {
        // If they leave the page, instantly save whatever is pending
        save.flush(); 
      } else {
        // If they navigate away instantly before IDB even loads, cancel to protect the old draft
        save.cancel(); 
      }
    };
  }, []);
}