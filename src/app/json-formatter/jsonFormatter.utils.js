export const MAX_FILE_SIZE_BYTES = 3 * 1024 * 1024; // 3 MB
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
 * @param {string} text
 * @returns {{ chars: number, tokens: number }}
 */
export const getCounts = (text) => ({
  chars: text.length,
  tokens: Math.ceil(text.length / CHARS_PER_TOKEN),
});

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
      if (indent > baseIndent) { i++; continue; }

      if (line.trim().startsWith('- ')) {
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
    const allStrings = value.every((v) => typeof v === 'string');
    const distinct = [...new Set(value)];
    if (allStrings && distinct.length <= 8 && distinct.length < value.length) {
      const literals = distinct.map((s) => `z.literal(${JSON.stringify(s)})`).join(', ');
      return `z.array(z.union([${literals}]))`;
    }
    const firstObj = value.find((v) => v !== null && typeof v === 'object' && !Array.isArray(v));
    if (firstObj) {
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

    const dotKey = remaining.match(/^\.([a-zA-Z_$][a-zA-Z0-9_$]*)(.*)/s);
    if (dotKey) {
      const [, key, rest] = dotKey;
      if (node && typeof node === 'object' && !Array.isArray(node) && key in node) {
        traverse(node[key], rest, `${currentPath}.${key}`);
      }
      return;
    }

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

  traverse(root, path.slice(1), '$');
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

  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const actualType = data === null ? 'null'
      : Array.isArray(data) ? 'array'
        : typeof data;
    if (!types.includes(actualType)) {
      errors.push({ path, message: `Expected type "${types.join('|')}", got "${actualType}"` });
      return errors;
    }
  }

  if (schema.properties && typeof data === 'object' && data !== null && !Array.isArray(data)) {
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
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(data)) {
        if (!(key in schema.properties)) {
          errors.push({ path: `${path}.${key}`, message: `Unexpected additional property "${key}"` });
        }
      }
    }
  }

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

  if (a !== b) changes.push({ type: 'changed', path, a, b });
  return changes;
};

/**
 * Fetch JSON from a URL via a public CORS-anywhere proxy.
 * Falls back to direct fetch first (works if the server sends CORS headers).
 * @param {string} rawInput  - A URL or a `curl ...` command string.
 * @returns {Promise<string>}
 */
export const fetchJsonFromUrl = async (rawInput) => {
  let url = rawInput.trim();
  const curlMatch = url.match(/curl\s+(?:-[^\s]+\s+)*['""]?(\bhttps?:\/\/[^\s'"]+)['""]?/i);
  if (curlMatch) url = curlMatch[1];

  if (!url.startsWith('http')) throw new Error('Please enter a valid http(s):// URL or curl command.');

  const tryFetch = async (fetchUrl) => {
    const res = await fetch(fetchUrl, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return res.text();
  };

  try {
    return await tryFetch(url);
  } catch {
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
      input: input.slice(0, 500),
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