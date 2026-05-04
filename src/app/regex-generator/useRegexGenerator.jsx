import { useState, useEffect } from 'react';
import { convertCode } from '@/lib/api';
import { useApp } from '@/context/AppContext';

export const CHEATSHEET = {
  "Anchors": [
    { token: "^", desc: "Start of string" },
    { token: "$", desc: "End of string" },
    { token: "\\b", desc: "Word boundary" },
    { token: "\\B", desc: "Non-word boundary" }
  ],
  "Quantifiers": [
    { token: "*", desc: "0 or more" },
    { token: "+", desc: "1 or more" },
    { token: "?", desc: "0 or 1 (Optional)" },
    { token: "{3}", desc: "Exactly 3" },
    { token: "{3,}", desc: "3 or more" },
    { token: "{3,5}", desc: "Between 3 and 5" },
    { token: "*?", desc: "Lazy quantifier (matches as little as possible)" }
  ],
  "Character Classes": [
    { token: "\\d", desc: "Digit [0-9]" },
    { token: "\\D", desc: "Not a digit" },
    { token: "\\w", desc: "Word char [A-Za-z0-9_]" },
    { token: "\\W", desc: "Not a word char" },
    { token: "\\s", desc: "Whitespace (space, tab, newline)" },
    { token: "\\S", desc: "Not whitespace" },
    { token: ".", desc: "Any character except newline" },
    { token: "[aeiou]", desc: "Custom set (any vowel)" },
    { token: "[^aeiou]", desc: "Negated set (any non-vowel)" }
  ],
  "Groups & Logic": [
    { token: "|", desc: "OR operator" },
    { token: "(...)", desc: "Capturing group" },
    { token: "(?:...)", desc: "Non-capturing group" },
    { token: "\\1", desc: "Backreference to group #1" }
  ],
  "Lookarounds": [
    { token: "(?=...)", desc: "Positive Lookahead (followed by...)" },
    { token: "(?!...)", desc: "Negative Lookahead (not followed by...)" },
    { token: "(?<=...)", desc: "Positive Lookbehind (preceded by...)" },
    { token: "(?<!...)", desc: "Negative Lookbehind (not preceded by...)" }
  ],
  "Flags": [
    { token: "g", desc: "Global search" },
    { token: "i", desc: "Case-insensitive" },
    { token: "m", desc: "Multiline" },
    { token: "s", desc: "Dotall (dot matches newlines)" }
  ]
};

export function useRegexGenerator() {
  const { moduleData, qualityMode } = useApp();
  
  const [input, setInput] = useState('');
  const [refineMode, setRefineMode] = useState(false);
  const [flavor, setFlavor] = useState('JavaScript');
  const [flags, setFlags] = useState({ g: true, i: true, m: false, s: false });
  
  const [outputCode, setOutputCode] = useState('');
  const [summary, setSummary] = useState('');
  const [breakdown, setBreakdown] = useState([]);
  
  const [testCases, setTestCases] = useState([
    { id: 1, text: 'example@email.com', shouldMatch: true },
    { id: 2, text: 'invalid-email', shouldMatch: false }
  ]);
  
  const [loading, setLoading] = useState(false);
  const [showCheatsheet, setShowCheatsheet] = useState(false);
  const [showTestInfo, setShowTestInfo] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  useEffect(() => {
    if (moduleData && moduleData.type === 'regex') {
      setInput(moduleData.input || '');
      handleResponseParsing(moduleData.fullOutput);
    }
  }, [moduleData]);

  const handleResponseParsing = (raw) => {
    const data = typeof raw === 'string' ? parseFallback(raw) : raw;
    setOutputCode(data.pattern || '');
    setSummary(data.summary || data.explanation || 'Generated pattern');
    setBreakdown(data.breakdown || []);
    if (data.pattern) setRefineMode(true);
  };

  const parseFallback = (text) => {
    try {
      const clean = text.replace(/```json|```/g, '').trim();
      return JSON.parse(clean);
    } catch (e) {
      return { pattern: text, summary: "Raw output generated." };
    }
  };

  const handleGenerate = async () => {
    if (!input.trim()) return;
    setLoading(true);
    try {
      const promptText = refineMode ?
        `Current Pattern: ${outputCode}\nRequest: Refine this to ${input}` :
        input;
      
      const result = await convertCode('regex', promptText, { qualityMode, targetLang: flavor });
      handleResponseParsing(result);
      if (result) {
        setLastResult({ type: "regex", input: promptText, output: result });
        if (refineMode) setInput('');
      }
    } catch (error) {
      alert(`Generation failed: ${error.message}`);
    }
    setLoading(false);
  };

  const getRegexObject = () => {
    try {
      const activeFlags = Object.keys(flags).filter(k => flags[k]).join('');
      return new RegExp(outputCode, activeFlags);
    } catch (e) {
      return null;
    }
  };

  const addTestCase = () => {
    const newId = Math.max(...testCases.map(t => t.id), 0) + 1;
    setTestCases([...testCases, { id: newId, text: '', shouldMatch: true }]);
  };

  const removeTestCase = (id) => {
    setTestCases(testCases.filter(t => t.id !== id));
  };

  const updateTestCase = (id, field, value) => {
    setTestCases(testCases.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const checkMatch = (text) => {
    const regex = getRegexObject();
    if (!regex) return { error: true };
    return { isMatch: regex.test(text) };
  };

  const fullString = `/${outputCode}/${Object.keys(flags).filter(k => flags[k]).join('')}` || "";

  return {
    input, setInput, refineMode, setRefineMode, flavor, setFlavor, flags, setFlags,
    outputCode, setOutputCode, summary, breakdown, testCases, loading,
    showCheatsheet, setShowCheatsheet, showTestInfo, setShowTestInfo, lastResult,
    handleGenerate, addTestCase, removeTestCase, updateTestCase, checkMatch, fullString
  };
}