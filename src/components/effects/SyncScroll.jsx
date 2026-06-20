import { useRef, useState, useEffect } from 'react';

/**
 * Attach returned refs to the wrapper divs around <CodeEditor> and <CodeOutput>.
 * The hook queries for `.editor-container` inside each ref — the actual scrollable
 * element rendered by those components.
 */
export function useSyncScroll({ deps = [] } = {}) {
  const sourceScrollRef = useRef(null);
  const targetScrollRef = useRef(null);
  const [syncScroll, setSyncScroll] = useState(false);
  const isSyncingRef = useRef(false);

  useEffect(() => {
    const src = sourceScrollRef.current?.querySelector('.editor-container');
    const tgt = targetScrollRef.current?.querySelector('.editor-container');
    if (!src || !tgt) return;

    const syncFrom = (source, target) => () => {
      if (!syncScroll || isSyncingRef.current) return;
      isSyncingRef.current = true;

      const maxSrcTop = source.scrollHeight - source.clientHeight;
      const maxTgtTop = target.scrollHeight - target.clientHeight;

      if (maxSrcTop > 0 && maxTgtTop > 0) {
        target.scrollTop = Math.round((source.scrollTop / maxSrcTop) * maxTgtTop);
      } else if (maxTgtTop > 0) {
        target.scrollTop = 0;
      }

      requestAnimationFrame(() => { isSyncingRef.current = false; });
    };

    const srcHandler = syncFrom(src, tgt);
    const tgtHandler = syncFrom(tgt, src);

    src.addEventListener('scroll', srcHandler, { passive: true });
    tgt.addEventListener('scroll', tgtHandler, { passive: true });

    return () => {
      src.removeEventListener('scroll', srcHandler);
      tgt.removeEventListener('scroll', tgtHandler);
    };
  // syncScroll + whatever causes the panels to remount (e.g. activeTabId, outputFiles)
  }, [syncScroll, ...deps]);

  return { sourceScrollRef, targetScrollRef, syncScroll, setSyncScroll };
}