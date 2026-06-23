import { useState, useEffect, useRef, useCallback } from 'react';
import { convertCode, LANGUAGES } from '@/lib';
import { useApp } from '@/context';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import debounce from 'lodash/debounce';
import { get, set, del } from 'idb-keyval';

export const sanitizeFilename = (name) => {
  // Removes path traversal and dangerous characters
  return name.replace(/["<>:/\\|?*\x00-\x1F]/g, '_').substring(0, 100);
};

export const validateFile = (file) => {
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB
  if (file.size > MAX_SIZE) {
    return { valid: false, error: `File ${file.name} exceeds the 5MB limit.` };
  }
  return { valid: true };
};

export const REFACTOR_MODES = [
  { id: 'clean', label: 'Clean & Readability', desc: 'Improves naming, structure, and formatting.', icon: 'fa-solid fa-broom' },
  { id: 'perf', label: 'Performance', desc: 'Optimizes loops, memory usage, and complexity.', icon: 'fa-solid fa-gauge-high' },
  { id: 'modern', label: 'Modernize Syntax', desc: 'Updates legacy syntax to modern language features.', icon: 'fa-solid fa-rocket' },
  { id: 'comments', label: 'Add Comments', desc: 'Adds documentation and inline explanations.', icon: 'fa-solid fa-comment-dots' },
];

export const DEFAULT_REFACTOR_MODE = 'clean';

const VALID_MODE_IDS = new Set(REFACTOR_MODES.map((m) => m.id));

export const isValidRefactorMode = (modeId) => VALID_MODE_IDS.has(modeId);

export const resolveRefactorMode = (modeId) =>
  isValidRefactorMode(modeId) ? modeId : DEFAULT_REFACTOR_MODE;

// Map a filename's extension to a LANGUAGES[].value, falling back if unknown.
export const getLanguageFromFilename = (filename, fallback = 'plaintext') => {
  if (!filename || !filename.includes('.')) return fallback;
  const ext = '.' + filename.split('.').pop().toLowerCase();
  return LANGUAGES.find((l) => l.ext === ext)?.value ?? fallback;
};

// Refactor mode suggestion — scores the code against weighted signals per
// mode and returns the strongest one, or null if nothing stands out.
const countMatches = (str, re) => (str.match(re) ?? []).length;
const stripStrings = (code) => code.replace(/(['"`])(?:(?!\1)[^\\]|\\.)*\1/gs, '""');

const plural = (n, singular, pluralForm) =>
  `${n} ${n === 1 ? singular : (pluralForm ?? singular + 's')}`;
const maxLoopNestingDepth = (lines) => {
  let depth = 0, max = 0;
  for (const line of lines) {
    if (/\b(for|while|do)\b/.test(line)) depth++;
    max = Math.max(max, depth);
    if (/^\s*\}/.test(line)) depth = Math.max(0, depth - 1);
  }
  return max;
};

export const suggestRefactorMode = (code) => {
  if (!code?.trim()) return null;

  const lines = code.split('\n');
  const nonBlankLines = lines.filter((l) => l.trim().length > 0).length;
  if (nonBlankLines < 3) return null;

  const clean = code;
  const noStrings = stripStrings(code);

  const scores = { clean: 0, perf: 0, modern: 0, comments: 0 };
  const reasons = { clean: [], perf: [], modern: [], comments: [] };

  // Modern signals

  const varCount = countMatches(clean, /\bvar\s+/g);
  if (varCount > 0) {
    scores.modern += varCount * 2;
    reasons.modern.push(
      `Replace ${plural(varCount, 'var declaration')} with const/let to prevent hoisting surprises`
    );
  }

  const thenCount = countMatches(clean, /\.then\s*\(/g);
  if (thenCount > 0) {
    scores.modern += thenCount * 2;
    reasons.modern.push(
      `${plural(thenCount, '.then() chain')} — flatten with async/await for clearer control flow`
    );
  }

  const requireCount = countMatches(clean, /\brequire\s*\(/g);
  if (requireCount > 0) {
    scores.modern += requireCount * 1.5;
    reasons.modern.push(
      `${plural(requireCount, 'require() call')} — migrate to ESM import/export`
    );
  }

  const cjsExports = countMatches(clean, /module\.exports/g);
  if (cjsExports > 0) {
    scores.modern += cjsExports * 1.5;
    reasons.modern.push('module.exports found — replace with ESM export statements');
  }

  const errCbCount = countMatches(clean, /function\s*\(\s*err\s*,/g);
  if (errCbCount > 0) {
    scores.modern += errCbCount * 2.5;
    reasons.modern.push(
      `${plural(errCbCount, 'error-first callback')} — wrap in a promisify helper or rewrite with async/await`
    );
  }

  const looseEqCount = countMatches(clean, /==(?!=)|!=(?!=)/g);
  if (looseEqCount > 0) {
    scores.modern += looseEqCount;
    reasons.modern.push(
      `${plural(looseEqCount, 'loose equality check', 'loose equality checks')} (== / !=) — use === / !== to avoid type coercion bugs`
    );
  }

  // Perf signals

  const nesting = maxLoopNestingDepth(lines);
  if (nesting >= 2) {
    scores.perf += 3 * (nesting - 1);
    reasons.perf.push(
      `${nesting}-level nested loop → O(n^${nesting}) complexity — consider a Map/Set for O(n) lookup`
    );
  }

  const searchCount = countMatches(clean, /\.(indexOf|includes|find|findIndex)\s*\(/g);
  if (searchCount > 0) {
    scores.perf += searchCount * 0.4;
    reasons.perf.push(
      `${plural(searchCount, 'linear-search call', 'linear-search calls')} (.find/.includes etc.) inside loops — hoist to a Set/Map lookup`
    );
  }

  const cloneCount = countMatches(clean, /JSON\.parse\s*\(\s*JSON\.stringify/g);
  if (cloneCount > 0) {
    scores.perf += cloneCount * 2;
    reasons.perf.push(
      `${plural(cloneCount, 'JSON.parse(JSON.stringify()) clone')} — replace with structuredClone() or a targeted spread/slice`
    );
  }

  // Comments signals
  const commentLines = lines.filter((l) => /^\s*(\/\/|\/\*|\*)/.test(l)).length;
  const commentRatio = commentLines / nonBlankLines;
  const functionCount =
    countMatches(clean, /\bfunction\b/g) + countMatches(clean, /=>/g);

  if (nonBlankLines > 15 && commentRatio < 0.05) {
    scores.comments += 2;
    reasons.comments.push(
      `${Math.round(commentRatio * 100)}% comment coverage — add at least a one-liner above each exported function`
    );
  }

  if (functionCount > 2 && commentRatio < 0.1) {
    const bump = Math.min(functionCount * 0.5, 3);
    scores.comments += bump;
    reasons.comments.push(
      `${plural(functionCount, 'function', 'functions')} with <10% comment coverage — document parameters, return values, and edge cases`
    );
  }

  // Clean signals 
  const badNameCount = countMatches(
    clean,
    /\b(?:let|const|var)\s+(?:tmp\d*|temp\d*|foo|bar|baz|val\d*|data\d*|[a-z]\d?)\b/g
  );
  if (badNameCount > 0) {
    scores.clean += badNameCount;
    reasons.clean.push(
      `${plural(badNameCount, 'non-descriptive name', 'non-descriptive names')} (tmp, val, foo…) — rename to reflect the value's purpose`
    );
  }

  const deepIndentLines = lines.filter((l) => {
    const m = l.match(/^(\s+)/);
    return m && m[1].replace(/\t/g, '  ').length >= 8;
  }).length;

  if (deepIndentLines > 0) {
    scores.clean += (deepIndentLines / nonBlankLines) * 10;
    reasons.clean.push(
      `${plural(deepIndentLines, 'line', 'lines')} indented ≥4 levels — extract inner blocks into named functions`
    );
  }

  if (functionCount > 0 && nonBlankLines / functionCount > 40) {
    scores.clean += 2;
    reasons.clean.push(
      `Functions average ${Math.round(nonBlankLines / functionCount)} lines — split into smaller single-responsibility units`
    );
  }

  const magicNumCount = countMatches(
    noStrings,
    /[^\w.](?:[2-9]\d*|\d{2,})(?!\w)/g
  );
  if (magicNumCount > 0) {
    scores.clean += Math.min(magicNumCount * 0.25, 3);
    reasons.clean.push(
      `${plural(magicNumCount, 'magic number')} — extract into named constants (const MAX_RETRIES = 3)`
    );
  }

  // Rank all modes that clear the threshold
  const THRESHOLD = 2.5;

  const ranked = Object.entries(scores)
    .filter(([, score]) => score >= THRESHOLD)
    .sort(([modeA, scoreA], [modeB, scoreB]) => {
      if (scoreB !== scoreA) return scoreB - scoreA;
      // Tie-break: prefer the mode with more specific reasons
      return reasons[modeB].length - reasons[modeA].length;
    })
    .map(([mode]) => ({ mode, score: scores[mode], reasons: reasons[mode] }));

  return ranked.length ? ranked[0] : null;
};

const createEmptyFile = (overrides = {}) => ({
  id: crypto.randomUUID(),
  name: 'main.js',
  language: 'javascript',
  content: '',
  size: 0,
  ...overrides,
});

export function useCodeRefactor() {
  const { moduleData, qualityMode } = useApp();

  const initialFile = createEmptyFile();
  const [files, setFiles] = useState([initialFile]);
  const [activeTabId, setActiveTabId] = useState(initialFile.id);
  const [outputFiles, setOutputFiles] = useState([]);
  const [lastResult, setLastResult] = useState(null);

  const [loadingStage, setLoadingStage] = useState('idle');
  const [refactorMode, setRefactorMode] = useState(DEFAULT_REFACTOR_MODE);
  const [suggestedMode, setSuggestedMode] = useState(null); // { mode, reasons[] } | null
  const [errorMsg, setErrorMsg] = useState('');
  const [projectContext, setProjectContext] = useState('');

  const fileInputRef = useRef(null);
  const isRestoring = useRef(false);
  const historyLoaded = useRef(false);
  const latestDraftRef = useRef({});

  const activeFile = files.find((f) => f.id === activeTabId);

  const activeOutputFile = outputFiles.find(
    (out) => out.sourceId === activeFile?.id || out.fileName === activeFile?.name,
  );

  const targetLang = activeOutputFile
    ? getLanguageFromFilename(activeOutputFile.fileName, activeFile?.language || 'plaintext')
    : activeFile?.language || 'plaintext';

  // Restore a saved result from the history panel. Always wins over any
  // local draft, and re-applies whenever a different history entry is picked.
  useEffect(() => {
    if (!moduleData || moduleData.type !== 'refactor') return;

    isRestoring.current = true;
    historyLoaded.current = true;
    try {
      const savedInputs =
        typeof moduleData.input === 'string' ? JSON.parse(moduleData.input) : moduleData.input;
      const savedOutput =
        typeof moduleData.fullOutput === 'string' ? JSON.parse(moduleData.fullOutput) : moduleData.fullOutput;

      if (savedInputs?.length > 0) {
        setFiles(savedInputs);
        setActiveTabId(savedInputs[0].id);
      }
      setOutputFiles(savedOutput || []);
      setRefactorMode(resolveRefactorMode(moduleData.refactorMode));
    } catch (e) {
      console.error('Failed to restore history', e);
    }
    setTimeout(() => { isRestoring.current = false; }, 100);
  }, [moduleData]);

  // Auto-restore an autosaved draft on first load — no confirmation modal.
  // Skipped entirely if a history result is already loaded.
  useEffect(() => {
    if (moduleData?.type === 'refactor') return;

    let cancelled = false;
    (async () => {
      try {
        const saved = await get('refactor-draft-data');
        if (cancelled || historyLoaded.current) return;
        if (saved?.files?.length > 0 && saved.files.some((f) => f.content.trim())) {
          isRestoring.current = true;
          setFiles(saved.files);
          setActiveTabId(saved.files[0].id);
          if (saved.outputFiles?.length > 0) setOutputFiles(saved.outputFiles);
          if (saved.refactorMode) setRefactorMode(resolveRefactorMode(saved.refactorMode));
          if (saved.projectContext) setProjectContext(saved.projectContext);
          setTimeout(() => { isRestoring.current = false; }, 100);
        }
      } catch (err) {
        console.error('Failed to load IndexedDB draft', err);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (outputFiles.length > 0 && !isRestoring.current) {
      setLastResult({
        type: 'refactor',
        input: JSON.stringify(files),
        output: outputFiles,
        refactorMode,
        qualityMode,
      });
    }
  }, [outputFiles, files, refactorMode, qualityMode]);

  const saveDraft = useRef(
    debounce(async (draftData) => {
      try {
        if (draftData.files.some((f) => f.content.trim())) {
          await set('refactor-draft-data', draftData);
        } else {
          await del('refactor-draft-data');
        }
      } catch (e) {
        console.error('IndexedDB error:', e);
      }
    }, 1500)
  ).current;

  useEffect(() => {
    if (isRestoring.current) return; // don't overwrite the draft while restoring
    saveDraft({ files, outputFiles, refactorMode, projectContext });
    return () => saveDraft.cancel();
  }, [files, outputFiles, refactorMode, projectContext, saveDraft]);

  useEffect(() => {
    setSuggestedMode(activeFile?.content?.trim()
      ? suggestRefactorMode(activeFile.content)
      : null);
  }, [activeTabId, activeFile?.content]);

  const handleRefactor = useCallback(async () => {
    if (files.every((f) => !f.content.trim())) return;
    setLoadingStage('analyzing');
    setErrorMsg('');

    let optTimeout, valTimeout;
    try {
      optTimeout = setTimeout(() => setLoadingStage('optimizing'), 1500);
      valTimeout = setTimeout(() => setLoadingStage('validating'), 3000);

      const inputPayload = JSON.stringify(
        files.map((f) => ({ sourceId: f.id, name: f.name, content: f.content })),
      );
      const result = await convertCode('refactor', inputPayload, {
        mode: resolveRefactorMode(refactorMode),
        qualityMode,
        projectContext: projectContext.trim() || undefined,
      });

      if (result && Array.isArray(result.files)) {
        const inputSnapshot = JSON.stringify(files);
        setOutputFiles(result.files);
        setLastResult({
          input: inputSnapshot,
          output: result.files,
          type: 'refactor',
          refactorMode,
          qualityMode,
        });
      } else {
        setErrorMsg(result?.error || 'Invalid format returned from the API.');
      }
    } catch {
      setErrorMsg('Failed to refactor code. Please check your connection.');
    } finally {
      clearTimeout(optTimeout);
      clearTimeout(valTimeout);
      setLoadingStage('idle');
    }
  }, [files, refactorMode, qualityMode, projectContext]);

  const handleLanguageChange = useCallback((id, newLangValue) => {
    const selectedLang = LANGUAGES.find((l) => l.value === newLangValue);
    if (!selectedLang) return;
    setFiles((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f;
        const base = f.name.includes('.') ? f.name.substring(0, f.name.lastIndexOf('.')) : f.name;
        return { ...f, language: selectedLang.value, name: `${base}${selectedLang.ext}` };
      }),
    );
  }, []);

  const handleFileUpload = useCallback(async (e) => {
    setErrorMsg('');
    const uploadedFiles = Array.from(e.target.files);
    if (!uploadedFiles.length) return;

    const validFiles = [];
    for (const file of uploadedFiles) {
      const { valid, error } = validateFile(file);
      if (!valid) { setErrorMsg(error); continue; }
      validFiles.push(file);
    }

    const promises = validFiles.map(
      (file) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const name = sanitizeFilename(file.name);
            resolve({
              id: crypto.randomUUID(),
              name,
              language: getLanguageFromFilename(name, 'plaintext'),
              content: ev.target.result,
              size: file.size,
            });
          };
          reader.onerror = reject;
          reader.readAsText(file);
        }),
    );

    try {
      const newFiles = await Promise.all(promises);
      if (newFiles.length > 0) {
        setFiles((prev) =>
          prev.length === 1 && !prev[0].content.trim() ? newFiles : [...prev, ...newFiles],
        );
        setActiveTabId(newFiles[0].id);
      }
    } catch {
      setErrorMsg('Failed to read one or more files.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [setErrorMsg, setFiles, setActiveTabId]);

  const updateFile = useCallback(
    (id, content) => setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, content } : f))),
    [],
  );

  const removeFile = useCallback((idToRemove) => {
    setFiles((prev) => {
      const remaining = prev.filter((f) => f.id !== idToRemove);
      if (remaining.length === 0) {
        const fresh = createEmptyFile({ name: 'untitled.txt', language: 'plaintext' });
        setActiveTabId(fresh.id);
        return [fresh];
      }
      setActiveTabId((cur) => cur === idToRemove ? remaining[0].id : cur);
      return remaining;
    });
  }, []);

  const handleAddFile = useCallback(() => {
    setFiles((prev) => {
      const active = prev.find((f) => f.id === activeTabId) ?? prev[prev.length - 1];
      const ext = LANGUAGES.find((l) => l.value === active?.language)?.ext ?? '.js';
      const lang = active?.language || 'javascript';
      const newFile = createEmptyFile({ name: `new-file${ext}`, language: lang });
      setActiveTabId(newFile.id);
      return [...prev, newFile];
    });
  }, [activeTabId]);

  const downloadSingleFile = useCallback((file) => {
    const blob = new Blob([file.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = sanitizeFilename(file.fileName || file.name || 'refactored-file.txt');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const downloadZip = useCallback(async () => {
    const zip = new JSZip();
    outputFiles.forEach((f) =>
      zip.file(sanitizeFilename(f.fileName || f.name || 'file.txt'), f.content),
    );
    const blob = await zip.generateAsync({ type: 'blob' });
    saveAs(blob, 'refactored_project.zip');
  }, [outputFiles]);

  useEffect(() => {
    latestDraftRef.current = { files, outputFiles, refactorMode, projectContext };
  }, [files, outputFiles, refactorMode, projectContext]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        saveDraft(latestDraftRef.current);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveDraft, handleRefactor]);

  const renameFile = useCallback((id, newName) => {
    setFiles((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f;
        const sanitized = sanitizeFilename(newName);
        const lang = getLanguageFromFilename(sanitized, f.language);
        return { ...f, name: sanitized, language: lang };
      }),
    );
  }, []);

  const handleClearAll = useCallback(() => {
    const fresh = createEmptyFile();
    setFiles([fresh]);
    setActiveTabId(fresh.id);
    setOutputFiles([]);
    setProjectContext('');
    setRefactorMode(DEFAULT_REFACTOR_MODE);
    setErrorMsg('');
  }, []);

  return {
    files,
    activeFile,
    activeTabId,
    setActiveTabId,
    outputFiles,
    activeOutputFile,
    targetLang,
    lastResult,
    loadingStage,
    isLoading: loadingStage !== 'idle',
    hasContent: files.some((f) => f.content.trim()),
    refactorMode,
    setRefactorMode,
    suggestedMode,
    errorMsg,
    projectContext,
    setProjectContext,
    fileInputRef,
    handleRefactor,
    handleLanguageChange,
    handleFileUpload,
    handleClearAll,
    updateFile,
    removeFile,
    handleAddFile,
    downloadSingleFile,
    downloadZip,
    renameFile,
  };
}