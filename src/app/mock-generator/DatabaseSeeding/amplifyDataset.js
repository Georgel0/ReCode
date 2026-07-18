import { fakerEN_US, fakerEN_GB, fakerDE, fakerFR, fakerJA } from '@faker-js/faker';
import { inferColumnBadges, extractFkRelationships, topologicalSort, FAKER_ANNOTATIONS } from './utils';

// Floor sample size actually requested from the AI, regardless of how large
// the user's requested total is. Below this, percentage/distribution rules
// in the user's custom rules text become statistically meaningless.
export const SAMPLE_FLOOR = 25;

const LOCALE_MAP = {
  'en-US': fakerEN_US,
  'en-GB': fakerEN_GB,
  'de-DE': fakerDE,
  'fr-FR': fakerFR,
  'ja-JP': fakerJA,
};

// Low-cardinality columns (status, role, category, ...) get resampled from
// the sample's *observed* distribution instead of uniform random. These
// thresholds decide what counts as "low cardinality" vs "basically unique".
const ENUM_MAX_DISTINCT = 8;
const ENUM_DISTINCT_RATIO_MAX = 0.5;
const UNIQUE_DISTINCT_RATIO_MIN = 0.9;

// Faker instance
function hashStringToInt(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) || 1;
}

function getFakerInstance(locale, seed) {
  const instance = LOCALE_MAP[locale] || fakerEN_US;
  if (seed !== undefined && seed !== null && seed !== '') {
    const numericSeed = typeof seed === 'number' ? seed : hashStringToInt(String(seed));
    instance.seed(numericSeed);
  }
  return instance;
}


// Rule parsing (best-effort, regex-based — the rules field is free text)

// Finds "NN% ... <value>" or "<value> ... NN%" pairs for each of a column's
// observed values. Returns null if the rules text doesn't mention any of
// them, so callers fall back to the sample's own observed ratio.
export function parsePercentageRule(rules, observedValues) {
  if (!rules || !observedValues?.length) return null;

  const percentMatches = [...rules.matchAll(/(\d{1,3})\s*%/g)].map((m) => ({
    pct: parseInt(m[1], 10),
    idx: m.index,
  }));
  if (!percentMatches.length) return null;

  // Collect every occurrence of any observed value in the text (quoted or
  // bare), so each percent can be paired with whichever value comes right
  // after it — matching the natural phrasing "NN% ... 'A', MM% 'B'".
  const valueOccurrences = [];
  observedValues.forEach((val) => {
    const strVal = String(val);
    const escaped = strVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`['"\`]?${escaped}['"\`]?`, 'gi');
    let m = re.exec(rules);
    while (m !== null) {
      valueOccurrences.push({ val: strVal, idx: m.index });
      m = re.exec(rules);
    }
  });
  if (!valueOccurrences.length) return null;
  valueOccurrences.sort((a, b) => a.idx - b.idx);

  const weights = {};
  percentMatches.forEach(({ pct, idx }) => {
    const next = valueOccurrences.find((v) => v.idx > idx);
    if (next && weights[next.val] === undefined) weights[next.val] = pct;
  });

  return Object.keys(weights).length ? weights : null;
}

// "within the last 30 days" / "last 6 months" / "last 2 years"
export function parseDateRangeRule(rules) {
  if (!rules) return null;
  const m = rules.match(/last\s+(\d+)\s*(day|days|week|weeks|month|months|year|years)/i);
  if (!m) return null;

  const amount = parseInt(m[1], 10);
  const unit = m[2].toLowerCase();
  const max = new Date();
  const min = new Date(max);

  if (unit.startsWith('day')) min.setDate(min.getDate() - amount);
  else if (unit.startsWith('week')) min.setDate(min.getDate() - amount * 7);
  else if (unit.startsWith('month')) min.setMonth(min.getMonth() - amount);
  else if (unit.startsWith('year')) min.setFullYear(min.getFullYear() - amount);

  return { min, max };
}

// Heuristic line-based scan of the raw schema text for @faker:x / @regex:...
// comments, associated with the nearest preceding CREATE TABLE / model block
// and the column identifier at the start of the line they're on.
export function extractColumnAnnotations(schemaInput) {
  const annotationMap = {};
  if (!schemaInput) return annotationMap;

  const annotationTags = new Set(FAKER_ANNOTATIONS.map((a) => a.annotation.split(':')[0]));
  let currentTable = null;

  schemaInput.split('\n').forEach((line) => {
    const tableMatch = line.match(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?["`]?(\w+)["`]?/i)
      || line.match(/^\s*model\s+(\w+)\s*\{/i);
    if (tableMatch) currentTable = tableMatch[1];

    const annotationMatch = line.match(/(@faker:[\w]+|@regex:[^\s*/-][^\n]*?)(?:\s{2,}|-->|\*\/|,?\s*$)/);
    if (!currentTable || !annotationMatch) return;
    const tag = annotationMatch[1].split(':')[0];
    if (!annotationTags.has(tag)) return;

    const colMatch = line.match(/^\s*["`]?(\w+)["`]?[\s(]/);
    if (!colMatch) return;

    annotationMap[`${currentTable}.${colMatch[1]}`] = annotationMatch[1].trim();
  });

  return annotationMap;
}


// Column classification — built on top of the existing inferColumnBadges
function classifyColumns(sampleRows, tableName, allTableNames, annotationMap) {
  const classifications = {};
  if (!sampleRows.length) return classifications;

  const columns = Object.keys(sampleRows[0]);

  columns.forEach((col) => {
    const rawValues = sampleRows.map((r) => r[col]).filter((v) => v !== null && v !== undefined);
    const observedValues = [...new Set(rawValues.map((v) => String(v)))];
    const distinctRatio = rawValues.length ? observedValues.length / rawValues.length : 0;
    const sampleValue = rawValues[0];
    const badges = inferColumnBadges(col, sampleValue, allTableNames, allTableNames);
    const annotation = annotationMap[`${tableName}.${col}`];

    let kind = 'fallback';
    let refTable = null;

    if (annotation) {
      kind = 'annotation';
    } else if (badges.includes('PK')) {
      // Only treat as a continuable integer sequence if every sample value
      // is actually numeric. A non-numeric, non-UUID PK (some other string
      // ID scheme) falls back to fresh UUIDs rather than emitting bare
      // integers that wouldn't match the sample's format at all.
      const allNumeric = rawValues.length > 0 && rawValues.every((v) => Number.isFinite(Number(v)));
      kind = allNumeric ? 'pk-sequential' : 'pk-uuid';
    } else if (badges.some((b) => b.startsWith('FK'))) {
      kind = 'fk';
      const fkBadge = badges.find((b) => b.startsWith('FK'));
      refTable = fkBadge.includes('→') ? fkBadge.split('→')[1].trim() : null;
    } else if (badges.includes('TIMESTAMP')) {
      kind = 'timestamp';
    } else if (badges.includes('DATE')) {
      kind = 'date';
    } else if (badges.includes('UUID')) {
      kind = 'uuid';
    } else if (badges.includes('BOOL')) {
      kind = 'bool';
    } else if (badges.includes('INT')) {
      kind = 'int';
    } else if (badges.includes('FLOAT')) {
      kind = 'float';
    } else if (rawValues.length && observedValues.length <= ENUM_MAX_DISTINCT && distinctRatio <= ENUM_DISTINCT_RATIO_MAX) {
      kind = 'enum';
    } else if (rawValues.length && distinctRatio >= UNIQUE_DISTINCT_RATIO_MIN) {
      kind = 'unique-string';
    }

    classifications[col] = { kind, annotation, refTable, distinctRatio, observedValues, rawValues, sampleValue };
  });

  return classifications;
}


// Per-kind generators

// faker's helpers.fromRegExp doesn't support \d / \w / \s shorthand classes
// (it emits them as literal characters), so expand them to the equivalent
// bracket expression first. Doesn't attempt to handle shorthands inside an
// existing [...] class or escaped literal backslashes — good enough for the
// simple ID/code-style patterns these annotations are meant for.
function expandRegexShorthand(pattern) {
  return pattern
    .replace(/\\d/g, '[0-9]')
    .replace(/\\w/g, '[A-Za-z0-9_]')
    .replace(/\\s/g, '[ ]');
}

function generateAnnotatedValue(annotation, fakerInstance) {
  if (annotation.startsWith('@regex:')) {
    const pattern = expandRegexShorthand(annotation.slice('@regex:'.length));
    try {
      return fakerInstance.helpers.fromRegExp(pattern);
    } catch {
      return fakerInstance.string.alphanumeric(10);
    }
  }

  const fnName = annotation.slice('@faker:'.length);
  const generators = {
    uuid: () => fakerInstance.string.uuid(),
    email: () => fakerInstance.internet.email(),
    firstName: () => fakerInstance.person.firstName(),
    lastName: () => fakerInstance.person.lastName(),
    fullName: () => fakerInstance.person.fullName(),
    phone: () => fakerInstance.phone.number(),
    zipCode: () => fakerInstance.location.zipCode(),
    city: () => fakerInstance.location.city(),
    country: () => fakerInstance.location.country(),
    streetAddress: () => fakerInstance.location.streetAddress(),
    creditCard: () => fakerInstance.finance.creditCardNumber(),
    iban: () => fakerInstance.finance.iban(),
    url: () => fakerInstance.internet.url(),
    ipv4: () => fakerInstance.internet.ipv4(),
    hexColor: () => fakerInstance.internet.color(),
    companyName: () => fakerInstance.company.name(),
    jobTitle: () => fakerInstance.person.jobTitle(),
    paragraph: () => fakerInstance.lorem.paragraph(),
    sentence: () => fakerInstance.lorem.sentence(),
    word: () => fakerInstance.lorem.word(),
  };

  return (generators[fnName] || generators.word)();
}

function guessUniqueGenerator(colName, fakerInstance) {
  const lower = colName.toLowerCase();
  const normalized = lower.replace(/[_\s]/g, '');

  if (lower.includes('email')) return () => fakerInstance.internet.email();
  if (lower.includes('username') || lower.includes('handle')) return () => fakerInstance.internet.userName();
  if (lower.includes('slug')) return () => fakerInstance.lorem.slug();
  if (lower.includes('sku') || lower.includes('code')) return () => fakerInstance.string.alphanumeric({ length: 10, casing: 'upper' });
  if (lower.includes('url') || lower.includes('link')) return () => fakerInstance.internet.url();
  if (normalized.includes('fullname') || normalized === 'name') return () => fakerInstance.person.fullName();
  if (normalized.includes('firstname')) return () => fakerInstance.person.firstName();
  if (normalized.includes('lastname')) return () => fakerInstance.person.lastName();
  if (lower.includes('phone')) return () => fakerInstance.phone.number();
  if (lower.includes('company')) return () => fakerInstance.company.name();
  if (lower.includes('title')) return () => fakerInstance.person.jobTitle();
  if (lower.includes('address')) return () => fakerInstance.location.streetAddress();

  // Generic fallback: this column is visibly human-readable free text (high
  // distinct ratio but not one of the recognized identifier patterns above),
  // so produce short pseudo-text rather than an opaque UUID.
  return () => fakerInstance.lorem.words({ min: 2, max: 4 });
}

function generateUniqueValue(generatorFn, existingSet, maxAttempts = 50) {
  for (let i = 0; i < maxAttempts; i += 1) {
    const candidate = generatorFn();
    if (!existingSet.has(candidate)) {
      existingSet.add(candidate);
      return candidate;
    }
  }
  const fallback = `${generatorFn()}-${existingSet.size}`;
  existingSet.add(fallback);
  return fallback;
}

function weightedPick(fakerInstance, weightMap) {
  const entries = Object.entries(weightMap).filter(([, w]) => w > 0);
  if (!entries.length) return null;
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = fakerInstance.number.float({ min: 0, max: total });
  for (const [val, w] of entries) {
    if (r < w) return val;
    r -= w;
  }
  return entries[entries.length - 1][0];
}

// Combines any rule-specified percentages with the sample's own observed
// frequency for whichever values the rules text didn't mention, so the
// weights always cover every value seen in the sample.
function buildEnumWeights(rawValues, ruleWeights) {
  const freq = {};
  rawValues.forEach((v) => { const k = String(v); freq[k] = (freq[k] || 0) + 1; });
  const distinct = Object.keys(freq);

  if (!ruleWeights) return Object.fromEntries(distinct.map((v) => [v, freq[v]]));

  const specified = distinct.filter((v) => ruleWeights[v] !== undefined);
  const unspecified = distinct.filter((v) => ruleWeights[v] === undefined);
  const specifiedTotal = specified.reduce((s, v) => s + ruleWeights[v], 0);
  const remaining = Math.max(0, 100 - specifiedTotal);
  const unspecifiedFreqTotal = unspecified.reduce((s, v) => s + freq[v], 0) || 1;

  const weights = {};
  specified.forEach((v) => { weights[v] = ruleWeights[v]; });
  unspecified.forEach((v) => { weights[v] = remaining * (freq[v] / unspecifiedFreqTotal); });
  return weights;
}

function inferNumericRange(rawValues) {
  const nums = rawValues.map(Number).filter(Number.isFinite);
  if (!nums.length) return { min: 0, max: 1000 };
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

function looksDateOnly(rawValues) {
  const strs = rawValues.map(String).filter(Boolean);
  if (!strs.length) return false;
  return strs.every((s) => /^\d{4}-\d{2}-\d{2}$/.test(s));
}

function inferDateRangeFromSample(rawValues) {
  const dates = rawValues.map((v) => new Date(v)).filter((d) => !Number.isNaN(d.getTime()));
  if (!dates.length) return { min: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), max: new Date() };
  return { min: new Date(Math.min(...dates)), max: new Date(Math.max(...dates)) };
}

function fallbackPick(fakerInstance, observedValues, sampleValue) {
  if (!observedValues.length) return sampleValue ?? null;
  return fakerInstance.helpers.arrayElement(observedValues);
}


// PK sequence helper — continues on from the sample's max value
function makeSequentialPkCounter(rawValues) {
  const nums = rawValues.map(Number).filter(Number.isFinite);
  let next = nums.length ? Math.max(...nums) + 1 : 1;
  return () => next++;
}


// Per-table amplification
function amplifyTable({
  table, classifications, countNeeded, fkPools, fakerInstance, rules, explicitDateRange,
}) {
  const newRows = [];
  const columns = Object.keys(classifications);

  const pkCol = columns.find((c) => classifications[c].kind === 'pk-sequential');
  const nextPkValue = pkCol ? makeSequentialPkCounter(classifications[pkCol].rawValues) : null;

  const enumWeights = {};
  const uniqueSets = {};
  columns.forEach((col) => {
    const cls = classifications[col];
    if (cls.kind === 'enum') {
      const ruleWeights = parsePercentageRule(rules, cls.observedValues);
      enumWeights[col] = buildEnumWeights(cls.rawValues, ruleWeights);
    }
    if (cls.kind === 'unique-string') {
      uniqueSets[col] = new Set(cls.rawValues.map(String));
    }
  });

  const dateRanges = {};
  columns.forEach((col) => {
    const cls = classifications[col];
    if (cls.kind === 'timestamp' || cls.kind === 'date') {
      dateRanges[col] = explicitDateRange || inferDateRangeFromSample(cls.rawValues);
    }
  });

  for (let i = 0; i < countNeeded; i += 1) {
    const row = {};
    columns.forEach((col) => {
      const cls = classifications[col];
      switch (cls.kind) {
        case 'annotation':
          row[col] = generateAnnotatedValue(cls.annotation, fakerInstance);
          break;
        case 'pk-sequential':
          row[col] = nextPkValue();
          break;
        case 'pk-uuid':
          row[col] = fakerInstance.string.uuid();
          break;
        case 'fk': {
          const pool = cls.refTable ? fkPools[cls.refTable] : null;
          row[col] = pool?.length ? fakerInstance.helpers.arrayElement(pool) : fallbackPick(fakerInstance, cls.observedValues, cls.sampleValue);
          break;
        }
        case 'timestamp':
        case 'date': {
          const generated = fakerInstance.date.between({ from: dateRanges[col].min, to: dateRanges[col].max });
          row[col] = looksDateOnly(cls.rawValues) ? generated.toISOString().slice(0, 10) : generated.toISOString();
          break;
        }
        case 'uuid':
          row[col] = fakerInstance.string.uuid();
          break;
        case 'bool':
          row[col] = fakerInstance.datatype.boolean();
          break;
        case 'int': {
          const { min, max } = inferNumericRange(cls.rawValues);
          row[col] = fakerInstance.number.int({ min, max: Math.max(min, max) });
          break;
        }
        case 'float': {
          const { min, max } = inferNumericRange(cls.rawValues);
          row[col] = fakerInstance.number.float({ min, max: Math.max(min, max), fractionDigits: 2 });
          break;
        }
        case 'enum':
          row[col] = weightedPick(fakerInstance, enumWeights[col]) ?? fallbackPick(fakerInstance, cls.observedValues, cls.sampleValue);
          break;
        case 'unique-string':
          row[col] = generateUniqueValue(guessUniqueGenerator(col, fakerInstance), uniqueSets[col]);
          break;
        default:
          row[col] = fallbackPick(fakerInstance, cls.observedValues, cls.sampleValue);
      }
    });
    newRows.push(row);
  }

  return { newRows, pkCol };
}


// Main entry point

/**
 * Amplifies AI-sampled table rows up to `requestedRows` per table using real
 * per-column faker generation, keyed off classification derived from
 * inferColumnBadges — never by duplicating or jittering sample rows.
 *
 * @param {Object} params
 * @param {Array<{tableName: string, rows: Object[]}>} params.tables - AI sample output.
 * @param {number} params.requestedRows - user's originally requested rowCount (per table).
 * @param {string} [params.rules] - raw rules text.
 * @param {string} [params.schemaInput] - raw schema text, for @faker/@regex annotations.
 * @param {string} [params.locale='en-US']
 * @param {string|number} [params.seed]
 * @param {string[]} [params.onlyTables] - if provided, only these tables are amplified;
 *        the rest pass through unchanged but still contribute FK pools (used by
 *        single-table regeneration, which needs sibling tables' existing PKs).
 *
 * @returns {{ tables: Array<{tableName: string, rows: Object[], sampleRowCount: number}> }}
 */
export function amplifyDataset({
  tables, requestedRows, rules, schemaInput, locale = 'en-US', seed, onlyTables,
}) {
  if (!tables?.length) return { tables: tables || [] };

  const fakerInstance = getFakerInstance(locale, seed);
  const tableNames = tables.map((t) => t.tableName);
  const relationships = extractFkRelationships(tables);
  const sortedTables = topologicalSort(tables, relationships);
  const annotationMap = extractColumnAnnotations(schemaInput);
  const explicitDateRange = parseDateRangeRule(rules);
  const amplifySet = onlyTables ? new Set(onlyTables) : null;

  const fkPools = {}; // tableName -> array of that table's final PK values
  const resultByName = {};

  sortedTables.forEach((table) => {
    const sampleRows = table.rows || [];
    const sampleRowCount = sampleRows.length;
    const shouldAmplify = (!amplifySet || amplifySet.has(table.tableName)) && requestedRows > sampleRowCount;

    let finalRows = sampleRows;

    if (shouldAmplify && sampleRowCount > 0) {
      const classifications = classifyColumns(sampleRows, table.tableName, tableNames, annotationMap);
      const { newRows } = amplifyTable({
        table,
        classifications,
        countNeeded: requestedRows - sampleRowCount,
        fkPools,
        fakerInstance,
        rules,
        explicitDateRange,
      });
      finalRows = [...sampleRows, ...newRows];
    }

    // Register this table's final PK pool for any children processed next.
    if (finalRows.length) {
      const pkCol = Object.keys(finalRows[0]).find((c) => c.toLowerCase() === 'id');
      if (pkCol) fkPools[table.tableName] = finalRows.map((r) => r[pkCol]);
    }

    resultByName[table.tableName] = { tableName: table.tableName, rows: finalRows, sampleRowCount };
  });

  // Return in the original table order, not topological order.
  return { tables: tables.map((t) => resultByName[t.tableName] || { ...t, sampleRowCount: t.rows?.length || 0 }) };
}