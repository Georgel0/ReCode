'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import JSON5 from 'json5';

export const MAX_FILE_SIZE_BYTES = 3 * 1024 * 1024; // 3 MB
const TREE_DEBOUNCE_MS = 150;
const HISTORY_KEY = 'jf_history_v1';
const INDENT_KEY = 'jf_indent_v1';
const AUTO_FMT_KEY = 'jf_autofmt_v1';
const MAX_HISTORY = 10;
const CHARS_PER_TOKEN = 4;

/**
 * Sort all object keys recursively in alphabetical order.
 * @param {unknown} value
 * @returns {unknown}
 */
export const sortKeysDeep = (value) => {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value !== null && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortKeysDeep(value[key]);
        return acc;
      }, {});
  }
  return value;
};

/**
 * Strip markdown code-fence wrappers from an AI response.
 * @param {string} raw
 * @returns {string}
 */
export const extractJsonFromMarkdown = (raw) => {
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  return raw.replace(/```json|```/g, '').trim();
};

/**
 * Trigger a browser file download.
 * @param {string} content
 * @param {string} filename
 * @param {string} [mimeType]
 */
export const downloadFile = (content, filename, mimeType = 'application/json') => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * Resolve indent value → number or string used by JSON.stringify.
 * @param {'2'|'4'|'tab'} setting
 * @returns {number|string}
 */
export const resolveIndent = (setting) =>
  setting === 'tab' ? '\t' : parseInt(setting, 10);

/**
 * Parse AI / structured output response for the `json` task.
 * @param {unknown} rawOutput
 * @returns {{ code: string, info: string }}
 */
export const parseJsonResponse = (rawOutput) => {
  if (typeof rawOutput === 'object' && rawOutput !== null) {
    return {
      code: rawOutput.formattedJson || '',
      info: rawOutput.explanation || 'JSON formatted successfully.',
    };
  }
  try {
    const clean = extractJsonFromMarkdown(rawOutput || '');
    const parsed = JSON.parse(clean);
    return {
      code: parsed.formattedJson || rawOutput,
      info: parsed.explanation || 'JSON formatted and repaired.',
    };
  } catch {
    return { code: rawOutput || '', info: 'AI formatted the JSON.' };
  }
};

/**
 * Minimal synchronous JSON → YAML converter (no external library needed).
 * Only handles plain objects / arrays / primitives — suitable for API payloads.
 * @param {unknown} obj
 * @param {number} [depth]
 * @returns {string}
 */
export const jsonToYaml = (obj, depth = 0) => {
  const indent = '  '.repeat(depth);
  if (obj === null) return 'null';
  if (typeof obj === 'boolean') return obj ? 'true' : 'false';
  if (typeof obj === 'number') return String(obj);
  if (typeof obj === 'string') {
    // Quote strings that could be misinterpreted as YAML scalars.
    const needsQuotes = /[:#\[\]{}|>&*!,]/.test(obj) || obj.trim() !== obj || obj === '';
    return needsQuotes ? `"${obj.replace(/"/g, '\\"')}"` : obj;
  }
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    return obj.map((item) => {
      if (typeof item === 'object' && item !== null) {
        const inner = jsonToYaml(item, depth + 1);
        const firstLine = inner.split('\n')[0];
        const rest = inner.split('\n').slice(1).join('\n');
        return `${indent}- ${firstLine}${rest ? '\n' + rest : ''}`;
      }
      return `${indent}- ${jsonToYaml(item, depth)}`;
    }).join('\n');
  }
  if (typeof obj === 'object') {
    const entries = Object.entries(obj);
    if (entries.length === 0) return '{}';
    return entries.map(([k, v]) => {
      const key = /[:#\[\]{}|>&*!,\s]/.test(k) ? `"${k}"` : k;
      if (typeof v === 'object' && v !== null) {
        return `${indent}${key}:\n${jsonToYaml(v, depth + 1)}`;
      }
      return `${indent}${key}: ${jsonToYaml(v, depth)}`;
    }).join('\n');
  }
  return String(obj);
};

/**
 * Minimal JSON → TOML converter.
 * Only handles a single top-level object with flat or one-level-nested values.
 * Nested objects become [sections], nested arrays of objects become [[array sections]].
 * @param {object} obj
 * @returns {string}
 */
export const jsonToToml = (obj) => {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    throw new Error('TOML root must be an object.');
  }

  const tomlVal = (v) => {
    if (v === null) return '""';
    if (typeof v === 'boolean') return v ? 'true' : 'false';
    if (typeof v === 'number') return String(v);
    if (typeof v === 'string') return `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    if (Array.isArray(v)) {
      if (v.length === 0) return '[]';
      if (typeof v[0] !== 'object') return `[${v.map(tomlVal).join(', ')}]`;
      return null; // handled as [[section]]
    }
    return null; // handled as [section]
  };

  const lines = [];
  const sections = [];

  for (const [key, value] of Object.entries(obj)) {
    const val = tomlVal(value);
    if (val !== null) {
      lines.push(`${key} = ${val}`);
    } else if (Array.isArray(value)) {
      sections.push({ key, value, isArray: true });
    } else if (typeof value === 'object' && value !== null) {
      sections.push({ key, value, isArray: false });
    }
  }

  const sectionLines = sections.flatMap(({ key, value, isArray }) => {
    if (isArray) {
      return value.flatMap((item) => [
        `\n[[${key}]]`,
        ...Object.entries(item).map(([k, v]) => `${k} = ${tomlVal(v) ?? '"[complex]"'}`),
      ]);
    }
    return [
      `\n[${key}]`,
      ...Object.entries(value).map(([k, v]) => `${k} = ${tomlVal(v) ?? '"[complex]"'}`),
    ];
  });

  return [...lines, ...sectionLines].join('\n').trim();
};

/**
 * JSON → CSV.  Flattens the first level of an array-of-objects.
 * @param {unknown} data
 * @returns {string}
 */
export const jsonToCsv = (data) => {
  const rows = Array.isArray(data) ? data : [data];
  if (rows.length === 0) throw new Error('Empty array.');
  const headers = [...new Set(rows.flatMap((r) => Object.keys(r || {})))];
  const escape = (v) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const csvRows = [headers.join(',')];
  for (const row of rows) {
    csvRows.push(headers.map((h) => escape(row?.[h])).join(','));
  }
  return csvRows.join('\n');
};

/**
 * Walk a parsed JSON value and emit a Zod schema string.
 * @param {unknown} value
 * @param {number} [depth]
 * @returns {string}
 */
export const inferZodSchema = (value, depth = 0) => {
  const pad = '  '.repeat(depth + 1);
  const closePad = '  '.repeat(depth);

  if (value === null) return 'z.null()';
  if (typeof value === 'boolean') return 'z.boolean()';
  if (typeof value === 'number') {
    return Number.isInteger(value) ? 'z.number().int()' : 'z.number()';
  }
  if (typeof value === 'string') return 'z.string()';

  if (Array.isArray(value)) {
    if (value.length === 0) return 'z.array(z.unknown())';
    // Detect enum: all string items from a small distinct set
    const allStrings = value.every((v) => typeof v === 'string');
    const distinct = [...new Set(value)];
    if (allStrings && distinct.length <= 8 && distinct.length < value.length) {
      const literals = distinct.map((s) => `z.literal(${JSON.stringify(s)})`).join(', ');
      return `z.array(z.union([${literals}]))`;
    }
    // Merge shapes if array of objects
    const firstObj = value.find((v) => v !== null && typeof v === 'object' && !Array.isArray(v));
    if (firstObj) {
      // Collect all keys, mark missing across items as optional
      const allKeys = [...new Set(value.flatMap((v) => (v && typeof v === 'object' ? Object.keys(v) : [])))];
      const mergedShape = allKeys.map((key) => {
        const samples = value.map((v) => v?.[key]);
        const hasUndefined = samples.some((s) => s === undefined);
        const nonNull = samples.find((s) => s !== undefined && s !== null);
        const inferred = nonNull !== undefined ? inferZodSchema(nonNull, depth + 1) : 'z.unknown()';
        const hasNull = samples.some((s) => s === null);
        const schema = hasNull ? `${inferred}.nullable()` : inferred;
        return `${pad}${key}: ${hasUndefined ? `${schema}.optional()` : schema},`;
      });
      return `z.array(z.object({\n${mergedShape.join('\n')}\n${closePad}}))`;
    }
    return `z.array(${inferZodSchema(value[0], depth)})`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length === 0) return 'z.object({})';
    const fields = entries.map(([k, v]) => {
      const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) ? k : JSON.stringify(k);
      return `${pad}${safeKey}: ${inferZodSchema(v, depth + 1)},`;
    });
    return `z.object({\n${fields.join('\n')}\n${closePad}})`;
  }

  return 'z.unknown()';
};

/**
 * Build a full Zod module string from a parsed JSON value.
 * @param {unknown} parsed
 * @returns {string}
 */
export const buildZodModule = (parsed) => {
  const schema = inferZodSchema(parsed, 0);
  return `import { z } from 'zod';\n\nexport const schema = ${schema};\n\nexport type Schema = z.infer<typeof schema>;\n`;
};

/**
 * Generate a sample JSON object from a Zod schema string.
 * Uses a heuristic pattern-match approach (no eval).
 * @param {string} zodCode  - Full Zod module string or bare schema string.
 * @returns {unknown}
 */
export const zodToExample = (zodCode) => {
  // Very lightweight recursive descent parser for Zod DSL.
  const src = zodCode;

  const parseSchema = (str) => {
    str = str.trim();

    if (str.startsWith('z.string()')) return 'example_string';
    if (str.startsWith('z.number().int()')) return 42;
    if (str.startsWith('z.number()')) return 3.14;
    if (str.startsWith('z.boolean()')) return true;
    if (str.startsWith('z.null()')) return null;
    if (str.startsWith('z.unknown()')) return null;
    if (str.startsWith('z.any()')) return null;
    if (str.startsWith('z.date()')) return new Date().toISOString();
    if (str.startsWith('z.enum(')) {
      const m = str.match(/z\.enum\(\[([^\]]+)\]/);
      if (m) {
        const vals = m[1].split(',').map((s) => s.trim().replace(/['"]/g, ''));
        return vals[0] || 'VALUE';
      }
    }
    if (str.startsWith('z.literal(')) {
      const m = str.match(/z\.literal\(([^)]+)\)/);
      if (m) {
        try { return JSON.parse(m[1]); } catch { return m[1]; }
      }
    }
    if (str.startsWith('z.array(')) {
      const inner = extractBracketContent(str, 'z.array(');
      return [parseSchema(inner)];
    }
    if (str.startsWith('z.object(')) {
      return parseObject(str);
    }
    if (str.startsWith('z.union(')) {
      const inner = extractBracketContent(str, 'z.union(');
      // take first option
      const firstComma = findTopLevelComma(inner);
      const first = firstComma >= 0 ? inner.slice(1, firstComma) : inner.slice(1, -1);
      return parseSchema(first.trim());
    }
    return null;
  };

  const extractBracketContent = (str, prefix) => {
    const start = str.indexOf('(', prefix.length - 1);
    let depth = 0;
    for (let i = start; i < str.length; i++) {
      if (str[i] === '(') depth++;
      else if (str[i] === ')') {
        depth--;
        if (depth === 0) return str.slice(start + 1, i);
      }
    }
    return str.slice(start + 1);
  };

  const findTopLevelComma = (str) => {
    let depth = 0;
    for (let i = 0; i < str.length; i++) {
      const c = str[i];
      if (c === '(' || c === '[' || c === '{') depth++;
      else if (c === ')' || c === ']' || c === '}') depth--;
      else if (c === ',' && depth === 0) return i;
    }
    return -1;
  };

  const parseObject = (str) => {
    // Extract content between { and }
    const braceStart = str.indexOf('{');
    if (braceStart < 0) return {};
    let depth = 0;
    let braceEnd = -1;
    for (let i = braceStart; i < str.length; i++) {
      if (str[i] === '{') depth++;
      else if (str[i] === '}') {
        depth--;
        if (depth === 0) { braceEnd = i; break; }
      }
    }
    const body = str.slice(braceStart + 1, braceEnd);
    const result = {};
    // Split on top-level commas
    const parts = [];
    let cur = '';
    let d = 0;
    for (let i = 0; i < body.length; i++) {
      const c = body[i];
      if (c === '(' || c === '[' || c === '{') d++;
      else if (c === ')' || c === ']' || c === '}') d--;
      else if (c === ',' && d === 0) {
        parts.push(cur.trim());
        cur = '';
        continue;
      }
      cur += c;
    }
    if (cur.trim()) parts.push(cur.trim());

    for (const part of parts) {
      const colonIdx = part.indexOf(':');
      if (colonIdx < 0) continue;
      const rawKey = part.slice(0, colonIdx).trim().replace(/^["']|["']$/g, '');
      const rawVal = part.slice(colonIdx + 1).trim();
      result[rawKey] = parseSchema(rawVal);
    }
    return result;
  };

  // Find the schema= assignment or parse entire string
  const schemaMatch = src.match(/=\s*(z\.[^;]+)/s);
  const schemaPart = schemaMatch ? schemaMatch[1].trim() : src.trim();
  return parseSchema(schemaPart);
};

/**
 * Very basic JSONPath evaluator supporting $, .key, [n], [*], ..key, [?(@.key)].
 * Returns an array of matched values and an array of dotted paths.
 * @param {unknown} root
 * @param {string} path
 * @returns {{ values: unknown[], paths: string[] }}
 */
export const evaluateJsonPath = (root, path) => {
  if (!path || !path.startsWith('$')) return { values: [], paths: [] };

  const values = [];
  const paths = [];

  const traverse = (node, remaining, currentPath) => {
    if (!remaining) {
      values.push(node);
      paths.push(currentPath);
      return;
    }

    // Dot notation: .key
    const dotKey = remaining.match(/^\.([a-zA-Z_$][a-zA-Z0-9_$]*)(.*)/s);
    if (dotKey) {
      const [, key, rest] = dotKey;
      if (node && typeof node === 'object' && !Array.isArray(node) && key in node) {
        traverse(node[key], rest, `${currentPath}.${key}`);
      }
      return;
    }

    // Recursive descent: ..key
    const recursive = remaining.match(/^\.\.(.*)/s);
    if (recursive) {
      const rest = recursive[1];
      const descend = (n, p) => {
        traverse(n, `.${rest}`, p);
        if (n && typeof n === 'object') {
          for (const [k, v] of Object.entries(n)) {
            descend(v, `${p}.${k}`);
          }
        }
      };
      descend(node, currentPath);
      return;
    }

    // Bracket notation: [n], [*], ["key"]
    const bracket = remaining.match(/^\[([^\]]+)\](.*)/s);
    if (bracket) {
      const [, expr, rest] = bracket;
      if (expr === '*') {
        if (Array.isArray(node)) {
          node.forEach((item, i) => traverse(item, rest, `${currentPath}[${i}]`));
        } else if (node && typeof node === 'object') {
          Object.entries(node).forEach(([k, v]) => traverse(v, rest, `${currentPath}.${k}`));
        }
      } else if (/^\d+$/.test(expr)) {
        const idx = parseInt(expr, 10);
        if (Array.isArray(node) && idx < node.length) {
          traverse(node[idx], rest, `${currentPath}[${idx}]`);
        }
      } else {
        const key = expr.replace(/^['"]|['"]$/g, '');
        if (node && typeof node === 'object' && key in node) {
          traverse(node[key], rest, `${currentPath}.${key}`);
        }
      }
    }
  };

  const strippedPath = path.slice(1); // Remove leading $
  traverse(root, strippedPath, '$');
  return { values, paths };
};

/**
 * Validate a parsed JSON value against a JSON Schema object.
 * Returns an array of { path, message } error objects.
 * Only handles type/required/properties/items — covers 90% of API schemas.
 * @param {unknown} data
 * @param {object} schema
 * @param {string} [path]
 * @returns {{ path: string, message: string }[]}
 */
export const validateAgainstJsonSchema = (data, schema, path = '$') => {
  const errors = [];

  if (!schema || typeof schema !== 'object') return errors;

  // type check
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actualType = data === null ? 'null'
      : Array.isArray(data) ? 'array'
      : typeof data;
    if (!types.includes(actualType)) {
      errors.push({ path, message: `Expected type "${types.join('|')}", got "${actualType}"` });
      return errors; // further validation pointless
    }
  }

  // object
  if (schema.properties && typeof data === 'object' && data !== null && !Array.isArray(data)) {
    // required
    if (Array.isArray(schema.required)) {
      for (const key of schema.required) {
        if (!(key in data)) {
          errors.push({ path: `${path}.${key}`, message: `Required field "${key}" is missing` });
        }
      }
    }
    for (const [key, subSchema] of Object.entries(schema.properties)) {
      if (key in data) {
        errors.push(...validateAgainstJsonSchema(data[key], subSchema, `${path}.${key}`));
      }
    }
    // additionalProperties: false
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(data)) {
        if (!(key in schema.properties)) {
          errors.push({ path: `${path}.${key}`, message: `Unexpected additional property "${key}"` });
        }
      }
    }
  }

  // array
  if (schema.items && Array.isArray(data)) {
    data.forEach((item, i) => {
      errors.push(...validateAgainstJsonSchema(item, schema.items, `${path}[${i}]`));
    });
    if (schema.minItems !== undefined && data.length < schema.minItems) {
      errors.push({ path, message: `Array has ${data.length} items; minimum is ${schema.minItems}` });
    }
    if (schema.maxItems !== undefined && data.length > schema.maxItems) {
      errors.push({ path, message: `Array has ${data.length} items; maximum is ${schema.maxItems}` });
    }
  }

  // string constraints
  if (typeof data === 'string') {
    if (schema.minLength !== undefined && data.length < schema.minLength) {
      errors.push({ path, message: `String length ${data.length} is below minimum ${schema.minLength}` });
    }
    if (schema.maxLength !== undefined && data.length > schema.maxLength) {
      errors.push({ path, message: `String length ${data.length} exceeds maximum ${schema.maxLength}` });
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(data)) {
      errors.push({ path, message: `Value does not match pattern /${schema.pattern}/` });
    }
    if (schema.enum && !schema.enum.includes(data)) {
      errors.push({ path, message: `Value "${data}" is not one of [${schema.enum.map(JSON.stringify).join(', ')}]` });
    }
  }

  // number constraints
  if (typeof data === 'number') {
    if (schema.minimum !== undefined && data < schema.minimum) {
      errors.push({ path, message: `Value ${data} is below minimum ${schema.minimum}` });
    }
    if (schema.maximum !== undefined && data > schema.maximum) {
      errors.push({ path, message: `Value ${data} exceeds maximum ${schema.maximum}` });
    }
  }

  return errors;
};

/**
 * Compute a simple structural diff between two parsed JSON values.
 * Returns a list of human-readable change descriptions.
 * @param {unknown} a  - "before"
 * @param {unknown} b  - "after"
 * @param {string} [path]
 * @returns {{ type: 'added'|'removed'|'changed'|'type_changed', path: string, a?: unknown, b?: unknown }[]}
 */
export const diffJson = (a, b, path = '$') => {
  const changes = [];

  if (typeof a !== typeof b || (a === null) !== (b === null) || Array.isArray(a) !== Array.isArray(b)) {
    changes.push({ type: 'type_changed', path, a: typeof a, b: typeof b });
    return changes;
  }

  if (a === null && b === null) return changes;

  if (Array.isArray(a)) {
    const maxLen = Math.max(a.length, b.length);
    for (let i = 0; i < maxLen; i++) {
      if (i >= a.length) changes.push({ type: 'added', path: `${path}[${i}]`, b: b[i] });
      else if (i >= b.length) changes.push({ type: 'removed', path: `${path}[${i}]`, a: a[i] });
      else changes.push(...diffJson(a[i], b[i], `${path}[${i}]`));
    }
    return changes;
  }

  if (typeof a === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    const allKeys = [...new Set([...keysA, ...keysB])];
    for (const key of allKeys) {
      if (!(key in a)) changes.push({ type: 'added', path: `${path}.${key}`, b: b[key] });
      else if (!(key in b)) changes.push({ type: 'removed', path: `${path}.${key}`, a: a[key] });
      else changes.push(...diffJson(a[key], b[key], `${path}.${key}`));
    }
    return changes;
  }

  // Primitive
  if (a !== b) changes.push({ type: 'changed', path, a, b });
  return changes;
};

/**
 * Minimal YAML → JS object parser.
 * Handles flat key: value, quoted strings, nested indent blocks, and arrays (- item).
 * Good enough for typical config files; not a full YAML spec implementation.
 * @param {string} yaml
 * @returns {unknown}
 */
export const yamlToJson = (yaml) => {
  const lines = yaml.split('\n');

  const parseValue = (raw) => {
    const v = raw.trim();
    if (v === 'null' || v === '~') return null;
    if (v === 'true') return true;
    if (v === 'false') return false;
    if (/^-?\d+$/.test(v)) return parseInt(v, 10);
    if (/^-?\d+\.\d+$/.test(v)) return parseFloat(v);
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      return v.slice(1, -1);
    }
    return v;
  };

  const parseBlock = (lineArr, baseIndent) => {
    const result = {};
    let i = 0;
    while (i < lineArr.length) {
      const line = lineArr[i];
      if (!line.trim() || line.trim().startsWith('#')) { i++; continue; }
      const indent = line.search(/\S/);
      if (indent < baseIndent) break;
      if (indent > baseIndent) { i++; continue; } // handled by child

      // List item
      if (line.trim().startsWith('- ')) {
        // Collect into an array
        const arr = [];
        while (i < lineArr.length) {
          const l = lineArr[i];
          if (!l.trim() || l.trim().startsWith('#')) { i++; continue; }
          const ind = l.search(/\S/);
          if (ind < baseIndent) break;
          if (l.trim().startsWith('- ')) {
            const afterDash = l.replace(/^\s*-\s?/, '');
            if (afterDash.trim() && !afterDash.trim().includes(':')) {
              arr.push(parseValue(afterDash));
              i++;
            } else {
              // Could be an object item — collect subsequent indented lines
              const childLines = [afterDash];
              i++;
              while (i < lineArr.length) {
                const cl = lineArr[i];
                if (!cl.trim()) { i++; continue; }
                if (cl.search(/\S/) <= indent) break;
                childLines.push(cl.slice(indent + 2));
                i++;
              }
              arr.push(parseBlock(childLines, 0));
            }
          } else break;
        }
        return arr;
      }

      const colonIdx = line.indexOf(':');
      if (colonIdx < 0) { i++; continue; }
      const key = line.slice(indent, colonIdx).trim();
      const afterColon = line.slice(colonIdx + 1).trim();

      if (afterColon) {
        result[key] = parseValue(afterColon);
        i++;
      } else {
        // Collect child lines
        const childIndent = indent + 2;
        const childLines = [];
        i++;
        while (i < lineArr.length) {
          const cl = lineArr[i];
          if (!cl.trim() || cl.trim().startsWith('#')) { i++; continue; }
          if (cl.search(/\S/) < childIndent) break;
          childLines.push(cl.slice(childIndent));
          i++;
        }
        result[key] = parseBlock(childLines, 0);
      }
    }
    return result;
  };

  return parseBlock(lines, 0);
};

/**
 * Minimal TOML → JS object parser.
 * Handles flat keys, quoted strings, arrays, [sections], and [[array sections]].
 * @param {string} toml
 * @returns {object}
 */
export const tomlToJson = (toml) => {
  const lines = toml.split('\n').map((l) => l.split('#')[0].trim()).filter(Boolean);
  const root = {};
  let current = root;
  let currentArrayKey = null;
  let currentArraySection = null;

  const parseVal = (raw) => {
    const v = raw.trim();
    if (v === 'true') return true;
    if (v === 'false') return false;
    if (/^-?\d+$/.test(v)) return parseInt(v, 10);
    if (/^-?\d+\.\d+$/.test(v)) return parseFloat(v);
    if (v.startsWith('"') && v.endsWith('"')) return v.slice(1, -1).replace(/\\"/g, '"');
    if (v.startsWith("'") && v.endsWith("'")) return v.slice(1, -1);
    if (v.startsWith('[') && v.endsWith(']')) {
      return v.slice(1, -1).split(',').map((x) => parseVal(x.trim()));
    }
    return v;
  };

  for (const line of lines) {
    if (line.startsWith('[[')) {
      const key = line.slice(2, -2).trim();
      if (!root[key]) root[key] = [];
      const obj = {};
      root[key].push(obj);
      current = obj;
      currentArrayKey = key;
      currentArraySection = obj;
    } else if (line.startsWith('[')) {
      const key = line.slice(1, -1).trim();
      const parts = key.split('.');
      let node = root;
      for (const part of parts) {
        if (!node[part]) node[part] = {};
        node = node[part];
      }
      current = node;
      currentArrayKey = null;
    } else {
      const eq = line.indexOf('=');
      if (eq < 0) continue;
      const key = line.slice(0, eq).trim();
      const val = line.slice(eq + 1).trim();
      current[key] = parseVal(val);
    }
  }

  return root;
};

/**
 * Fetch JSON from a URL via a public CORS-anywhere proxy.
 * Falls back to direct fetch first (works if the server sends CORS headers).
 * @param {string} rawInput  - A URL or a `curl ...` command string.
 * @returns {Promise<string>}
 */
export const fetchJsonFromUrl = async (rawInput) => {
  // Extract URL from a curl command
  let url = rawInput.trim();
  const curlMatch = url.match(/curl\s+(?:-[^\s]+\s+)*['"]?(\bhttps?:\/\/[^\s'"]+)['"]?/i);
  if (curlMatch) url = curlMatch[1];

  if (!url.startsWith('http')) throw new Error('Please enter a valid http(s):// URL or curl command.');

  const tryFetch = async (fetchUrl) => {
    const res = await fetch(fetchUrl, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return res.text();
  };

  // 1. Direct fetch (works for CORS-enabled endpoints)
  try {
    return await tryFetch(url);
  } catch {
    // 2. Proxy fallback
    const proxy = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    return await tryFetch(proxy);
  }
};

/**
 * Load history entries from localStorage.
 * @returns {{ id: number, timestamp: string, input: string, output: string }[]}
 */
export const loadHistory = () => {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
};

/**
 * Persist a new history entry, keeping only the last MAX_HISTORY items.
 * @param {string} input
 * @param {string} output
 */
export const saveToHistory = (input, output) => {
  try {
    const history = loadHistory();
    const entry = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      input: input.slice(0, 500), // store excerpt only
      output: output.slice(0, 500),
    };
    const updated = [entry, ...history].slice(0, MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // localStorage unavailable — silently ignore
  }
};

/**
 * Delete a single history entry by id.
 * @param {number} id
 */
export const deleteHistoryEntry = (id) => {
  try {
    const history = loadHistory().filter((h) => h.id !== id);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch { /* ignore */ }
};

/**
 * @param {string} text
 * @returns {{ chars: number, tokens: number }}
 */
export const getCounts = (text) => ({
  chars: text.length,
  tokens: Math.ceil(text.length / CHARS_PER_TOKEN),
});

export const loadIndentSetting = () => {
  try { return localStorage.getItem(INDENT_KEY) || '2'; } catch { return '2'; }
};

export const saveIndentSetting = (v) => {
  try { localStorage.setItem(INDENT_KEY, v); } catch { /* ignore */ }
};

export const loadAutoFormatSetting = () => {
  try { return localStorage.getItem(AUTO_FMT_KEY) !== 'false'; } catch { return true; }
};

export const saveAutoFormatSetting = (v) => {
  try { localStorage.setItem(AUTO_FMT_KEY, String(v)); } catch { /* ignore */ }
};

/**
 * useJsonFormatter — all state + handlers for the JSON Formatter feature.
 *
 * @param {{ convertCode: Function, qualityMode: string, moduleData: object|null }} deps
 * @returns {object}
 */
export const useJsonFormatter = ({ convertCode, qualityMode, moduleData }) => {
  const [input, setInput] = useState('');
  const [outputCode, setOutputCode] = useState('');
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [viewMode, setViewMode] = useState('code'); // 'code' | 'tree' | 'zod' | 'diff'
  const [isDragging, setIsDragging] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [sortKeys, setSortKeys] = useState(false);

  const [indentSize, setIndentSizeState] = useState(() => loadIndentSetting());
  const [autoFormat, setAutoFormatState] = useState(() => loadAutoFormatSetting());
  const [jsonSchemaText, setJsonSchemaText] = useState('');
  const [schemaErrors, setSchemaErrors] = useState([]); // [{ path, message }]
  const [jsonPathQuery, setJsonPathQuery] = useState('');
  const [jsonPathResult, setJsonPathResult] = useState(null); // { values, paths }
  const [diffInput, setDiffInput] = useState(''); // second blob for diff
  const [diffResult, setDiffResult] = useState(null); // [{ type, path, a, b }]
  const [zodOutput, setZodOutput] = useState(''); // generated Zod schema
  const [zodLoading, setZodLoading] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);
  const [history, setHistory] = useState(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);
  const [conversionResult, setConversionResult] = useState(null); // { format, content }
  const [convertLoading, setConvertLoading] = useState(false);

  const treeDebounceRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkTheme(mq.matches);
    const handler = (e) => setIsDarkTheme(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (moduleData && moduleData.type === 'json') {
      setInput(moduleData.input || '');
      const { code, info } = parseJsonResponse(moduleData.fullOutput);
      setOutputCode(code);
      setExplanation(info);
    }
  }, [moduleData]);

  useEffect(() => {
    setErrorMsg(null);
    setLastResult(null);
  }, [input]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') setErrorMsg(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    return () => { if (treeDebounceRef.current) clearTimeout(treeDebounceRef.current); };
  }, []);

  const setIndentSize = useCallback((v) => {
    setIndentSizeState(v);
    saveIndentSetting(v);
    // Re-format output with new indent
    setOutputCode((prev) => {
      if (!prev.trim()) return prev;
      try {
        return JSON.stringify(JSON.parse(prev), null, resolveIndent(v));
      } catch { return prev; }
    });
  }, []);

  const setAutoFormat = useCallback((v) => {
    setAutoFormatState(v);
    saveAutoFormatSetting(v);
  }, []);

  const runSchemaValidation = useCallback((jsonStr, schemaStr) => {
    if (!schemaStr.trim() || !jsonStr.trim()) { setSchemaErrors([]); return; }
    try {
      const data = JSON.parse(jsonStr);
      const schema = JSON.parse(schemaStr);
      const errors = validateAgainstJsonSchema(data, schema);
      setSchemaErrors(errors);
    } catch (e) {
      setSchemaErrors([{ path: '$', message: `Schema parse error: ${e.message}` }]);
    }
  }, []);

  useEffect(() => {
    runSchemaValidation(outputCode, jsonSchemaText);
  }, [outputCode, jsonSchemaText, runSchemaValidation]);

  const runJsonPath = useCallback((query, jsonStr) => {
    if (!query || !jsonStr.trim()) { setJsonPathResult(null); return; }
    try {
      const parsed = JSON.parse(jsonStr);
      const result = evaluateJsonPath(parsed, query);
      setJsonPathResult(result);
    } catch {
      setJsonPathResult({ values: [], paths: [], error: 'Invalid JSON' });
    }
  }, []);

  useEffect(() => {
    runJsonPath(jsonPathQuery, outputCode);
  }, [jsonPathQuery, outputCode, runJsonPath]);

  const runDiff = useCallback((aStr, bStr) => {
    if (!aStr.trim() || !bStr.trim()) { setDiffResult(null); return; }
    try {
      const a = JSON.parse(aStr);
      const b = JSON.parse(bStr);
      setDiffResult(diffJson(a, b));
    } catch (e) {
      setDiffResult([{ type: 'error', path: '$', message: e.message }]);
    }
  }, []);

  useEffect(() => {
    if (viewMode === 'diff') runDiff(outputCode, diffInput);
  }, [viewMode, outputCode, diffInput, runDiff]);


  const handleLocalFormat = useCallback((src) => {
    const sourceCode = (src ?? input).trim();
    if (!sourceCode) return;

    setErrorMsg(null);
    const indent = resolveIndent(indentSize);

    try {
      let parsed = JSON.parse(sourceCode);
      if (sortKeys) parsed = sortKeysDeep(parsed);
      const formatted = JSON.stringify(parsed, null, indent);
      setOutputCode(formatted);
      setExplanation('Valid JSON – formatted locally.');
      saveToHistory(sourceCode, formatted);
      setHistory(loadHistory());
    } catch {
      try {
        let looseParsed = JSON5.parse(sourceCode);
        if (sortKeys) looseParsed = sortKeysDeep(looseParsed);
        const formatted = JSON.stringify(looseParsed, null, indent);
        setOutputCode(formatted);
        setExplanation('Loose JSON fixed locally via JSON5.');
        saveToHistory(sourceCode, formatted);
        setHistory(loadHistory());
      } catch (looseError) {
        const msg = looseError.message || '';
        const match = msg.match(/line \d+ column \d+/) || msg.match(/position \d+/);
        const loc = match ? ` at ${match[0]}` : '';
        setErrorMsg(`Syntax Error${loc}: Click 'AI Fix & Format' to auto-repair.`);
      }
    }
  }, [input, sortKeys, indentSize]);

  const handleMinify = useCallback(() => {
    const sourceCode = outputCode.trim() || input.trim();
    if (!sourceCode) return;
    setErrorMsg(null);
    try {
      setOutputCode(JSON.stringify(JSON.parse(sourceCode)));
      setExplanation('JSON minified to a single line.');
      return;
    } catch { /* fall through */ }
    try {
      setOutputCode(JSON.stringify(JSON5.parse(sourceCode)));
      setExplanation('JSON5 parsed and minified.');
    } catch {
      setErrorMsg('Invalid JSON: Minification requires valid syntax.');
    }
  }, [outputCode, input]);

  const handleAiFix = useCallback(async () => {
    if (!input.trim()) return;
    setLoading(true);
    setOutputCode('');
    setExplanation('');
    setErrorMsg(null);
    try {
      const result = await convertCode('json', input, { qualityMode });
      const { code, info } = parseJsonResponse(result);
      if (code) {
        setOutputCode(code);
        setExplanation(info);
        setLastResult({ type: 'json', input, output: result });
        saveToHistory(input, code);
        setHistory(loadHistory());
      }
    } catch (error) {
      alert(`Fix failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [input, qualityMode, convertCode]);

  const handlePaste = useCallback((e) => {
    if (!autoFormat) return;
    const pasted = e.clipboardData?.getData('text') ?? '';
    if (!pasted.trim()) return;
    // Use setTimeout so the textarea value is updated first
    setTimeout(() => handleLocalFormat(pasted), 0);
  }, [autoFormat, handleLocalFormat]);

  const readFile = useCallback((file) => {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMsg(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max is ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB.`);
      return;
    }
    const ext = file.name.split('.').pop().toLowerCase();
    const reader = new FileReader();
    reader.onload = (event) => {
      const raw = event.target.result;
      try {
        if (ext === 'yaml' || ext === 'yml') {
          const obj = yamlToJson(raw);
          const json = JSON.stringify(obj, null, resolveIndent(indentSize));
          setInput(json);
          setOutputCode(json);
          setExplanation('YAML converted to JSON.');
        } else if (ext === 'toml') {
          const obj = tomlToJson(raw);
          const json = JSON.stringify(obj, null, resolveIndent(indentSize));
          setInput(json);
          setOutputCode(json);
          setExplanation('TOML converted to JSON.');
        } else {
          setInput(raw);
          setOutputCode('');
          setErrorMsg(null);
        }
      } catch (e) {
        setErrorMsg(`Failed to parse ${ext.toUpperCase()}: ${e.message}`);
      }
    };
    reader.readAsText(file);
  }, [indentSize]);

  const handleUrlImport = useCallback(async () => {
    if (!urlInput.trim()) return;
    setUrlLoading(true);
    try {
      const text = await fetchJsonFromUrl(urlInput);
      setInput(text);
      handleLocalFormat(text);
      setUrlInput('');
    } catch (e) {
      setErrorMsg(`URL import failed: ${e.message}`);
    } finally {
      setUrlLoading(false);
    }
  }, [urlInput, handleLocalFormat]);

  const handleConvert = useCallback(async (format) => {
    if (!outputCode.trim()) return;
    setConvertLoading(true);
    try {
      const parsed = JSON.parse(outputCode);
      let content = '';
      let ext = format;
      if (format === 'yaml') {
        content = jsonToYaml(parsed);
      } else if (format === 'toml') {
        content = jsonToToml(parsed);
      } else if (format === 'csv') {
        content = jsonToCsv(parsed);
        ext = 'csv';
      }
      setConversionResult({ format, content });
      setViewMode('code'); // switch back to code view to show result button
    } catch (e) {
      setErrorMsg(`Conversion to ${format.toUpperCase()} failed: ${e.message}`);
    } finally {
      setConvertLoading(false);
    }
  }, [outputCode]);

  const handleGenerateZod = useCallback(async () => {
    if (!outputCode.trim()) return;
    setZodLoading(true);
    setViewMode('zod');
    try {
      let parsed;
      try { parsed = JSON.parse(outputCode); } catch { throw new Error('Format JSON first.'); }
      // Use local inference (instant, no AI call)
      const zodCode = buildZodModule(parsed);
      setZodOutput(zodCode);
      setExplanation('Zod schema inferred from JSON structure.');
    } catch (e) {
      setErrorMsg(`Zod inference failed: ${e.message}`);
    } finally {
      setZodLoading(false);
    }
  }, [outputCode]);

  const handleZodToExample = useCallback(() => {
    if (!zodOutput.trim()) return;
    try {
      const example = zodToExample(zodOutput);
      const json = JSON.stringify(example, null, resolveIndent(indentSize));
      setOutputCode(json);
      setViewMode('code');
      setExplanation('Example JSON generated from Zod schema.');
    } catch (e) {
      setErrorMsg(`Zod→JSON failed: ${e.message}`);
    }
  }, [zodOutput, indentSize]);

  const handleDownload = useCallback(() => {
    if (!outputCode.trim()) return;
    downloadFile(outputCode, 'output.json');
  }, [outputCode]);

  const getJsonForTree = useCallback(() => {
    try { return outputCode ? JSON.parse(outputCode) : {}; }
    catch { return { error: 'Parse error. Switch to Code view to fix.' }; }
  }, [outputCode]);

  const handleTreeEdit = useCallback((params) => {
    if (treeDebounceRef.current) clearTimeout(treeDebounceRef.current);
    treeDebounceRef.current = setTimeout(() => {
      try { setOutputCode(JSON.stringify(params.src, null, resolveIndent(indentSize))); }
      catch { console.error('Failed to sync tree edit.'); }
    }, TREE_DEBOUNCE_MS);
  }, [indentSize]);

  const onDragOver = useCallback((e) => { e.preventDefault(); setIsDragging(true); }, []);
  const onDragLeave = useCallback((e) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setIsDragging(false);
  }, []);
  const onDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) readFile(file);
  }, [readFile]);

  const loadSample = useCallback(() => {
    setInput(
      '{\n  "status": "broken",\n  "error": "missing quotes and commas"\n  unquoted_key: 123\n  "list": [1, 2, 3,]\n}'
    );
    setOutputCode('');
    setErrorMsg(null);
  }, []);

  const handleRestoreHistory = useCallback((entry) => {
    setInput(entry.input);
    setOutputCode(entry.output);
    setShowHistory(false);
    setExplanation('Restored from history.');
  }, []);

  const handleDeleteHistory = useCallback((id) => {
    deleteHistoryEntry(id);
    setHistory(loadHistory());
  }, []);

  const outputCounts = getCounts(outputCode);

  return {
    // State
    input, setInput,
    outputCode, setOutputCode,
    explanation,
    loading,
    errorMsg, setErrorMsg,
    lastResult,
    viewMode, setViewMode,
    isDragging,
    isDarkTheme,
    sortKeys, setSortKeys,
    indentSize, setIndentSize,
    autoFormat, setAutoFormat,
    jsonSchemaText, setJsonSchemaText,
    schemaErrors,
    jsonPathQuery, setJsonPathQuery,
    jsonPathResult,
    diffInput, setDiffInput,
    diffResult,
    zodOutput, setZodOutput,
    zodLoading,
    urlInput, setUrlInput,
    urlLoading,
    history,
    showHistory, setShowHistory,
    conversionResult, setConversionResult,
    convertLoading,
    outputCounts,

    // Handlers
    handleLocalFormat,
    handleMinify,
    handleAiFix,
    handlePaste,
    handleDownload,
    handleFileUpload: (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      readFile(file);
      e.target.value = '';
    },
    onDragOver,
    onDragLeave,
    onDrop,
    loadSample,
    handleUrlImport,
    handleConvert,
    handleGenerateZod,
    handleZodToExample,
    getJsonForTree,
    handleTreeEdit,
    handleRestoreHistory,
    handleDeleteHistory,
  };
};
