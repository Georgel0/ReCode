'use client';

import { useState, useCallback } from 'react';

const PARAM = 'share';

// TextEncoder/Decoder handles unicode correctly (no deprecated unescape/escape)
const encode = (data) => {
  try {
    const json = JSON.stringify(data);
    const bytes = new TextEncoder().encode(json);
    const binary = Array.from(bytes).map(b => String.fromCharCode(b)).join('');
    return btoa(binary);
  } catch {
    return null;
  }
};

const decode = (str) => {
  try {
    const binary = atob(str);
    const bytes = new Uint8Array(Array.from(binary).map(c => c.charCodeAt(0)));
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json);
  } catch {
    return null;
  }
};

/**
 * useShareState
 *
 * Encodes a tool's prompt + config into a ?share= URL param.
 * Intentionally excludes output — the recipient generates fresh.
 *
 * Usage in any tool hook:
 *
 *   const { share, readSharedState, shareCopied } = useShareState({
 *     toolId: 'my-tool',
 *     input,
 *     config,
 *   });
 *
 *   // Call once on mount to hydrate from a shared link:
 *   useEffect(() => {
 *     const shared = readSharedState();
 *     if (!shared) return;
 *     isRestoring.current  = true;
 *     historyLoaded.current = true;        // blocks draft from overwriting
 *     if (shared.input)  setInput(shared.input);
 *     if (shared.config) setConfig({ ...DEFAULT_CONFIG, ...shared.config });
 *     setTimeout(() => { isRestoring.current = false; }, 100);
 *   }, []); // eslint-disable-line react-hooks/exhaustive-deps
 *
 * Props to pass to ModuleHeader:
 *   onShare={share}
 *   shareCopied={shareCopied}
 *   shareDisabled={!input.trim()}
 *
 * @param {string} toolId   Unique key per tool ('code-generator', 'converter', …)
 * @param {string} input    Current prompt / input text
 * @param {object} config   Current config object
 */
export function useShareState({ toolId, input, config }) {
  const [shareCopied, setShareCopied] = useState(false);

  /**
   * Reads the ?share= param, validates the toolId, strips the param from
   * the URL (no navigation), and returns { input, config } or null.
   *
   * Call exactly once, inside a useEffect([]), before the draft restore runs.
   */
  const readSharedState = useCallback(() => {
    if (typeof window === 'undefined') return null;
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get(PARAM);
      if (!raw) return null;

      const data = decode(raw);
      if (!data || data.toolId !== toolId) return null;

      // Strip param silently — back button still works
      const url = new URL(window.location.href);
      url.searchParams.delete(PARAM);
      window.history.replaceState({}, '', url.toString());

      return {
        input: data.input ?? '',
        config: data.config ?? {},
      };
    } catch {
      return null;
    }
  }, [toolId]);

  /**
   * Builds the share URL and either:
   *  - calls navigator.share() on mobile (native sheet)
   *  - writes to clipboard on desktop (shows "Copied!" for 2s)
   */
  const share = useCallback(async () => {
    try {
      const encoded = encode({ toolId, input, config });
      if (!encoded) return;

      const url = new URL(window.location.href);
      url.searchParams.set(PARAM, encoded);
      const shareUrl = url.toString();

      const isMobile = /Mobi|Android/i.test(navigator.userAgent);
      if (isMobile && navigator.share) {
        await navigator.share({ title: document.title, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2000);
      }
    } catch (e) {
      // AbortError = user dismissed the native sheet — not a real error
      if (e?.name !== 'AbortError') console.warn('Share failed:', e);
    }
  }, [toolId, input, config]);

  return { share, readSharedState, shareCopied };
}