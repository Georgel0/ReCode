export const RULE_TEMPLATES = [
  { label: "Date Range (Last 30 Days)", value: "All created_at dates must be within the last 30 days." },
  { label: "Percentage Split", value: "70% of users should have status 'active', 30% 'inactive'." },
  { label: "Sequential IDs", value: "Primary keys should be sequential integers starting at 1000." },
  { label: "FK Pool Mapping", value: "orders.user_id must perfectly map to generated users.id values." }
];

export const SAMPLE_SCHEMAS = [
  {
    label: "E-Commerce Core (SQL)",
    schema: `CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  full_name VARCHAR(100),
  created_at TIMESTAMP
);

CREATE TABLE orders (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  total_amount FLOAT,
  status VARCHAR(50),
  created_at TIMESTAMP
);`,
    rules: "All orders.user_id must perfectly map to generated users.id values.\n70% of orders should have status 'completed', 20% 'pending', 10% 'cancelled'."
  },
  {
    label: "SaaS Workspace (Prisma)",
    schema: `model Workspace {
  id        String   @id @default(uuid())
  name      String
  plan      String
  createdAt DateTime @default(now())
}

model Member {
  id          String   @id @default(uuid())
  workspaceId String
  email       String
  role        String
}`,
    rules: "75% of members must have role 'Member', 25% 'Admin'.\nAll Member.workspaceId values must reference valid Workspace records."
  }
];

export const ITEMS_PER_PAGE = 15;

export const DEFAULT_CONFIG = {
  locale: 'en-US',
  rowCount: '15',
  seed: '',
  dataQuality: 75,
  includeAnalysis: false
};

export const FAKER_ANNOTATIONS = [
  { annotation: '@faker:uuid', description: 'UUID v4' },
  { annotation: '@faker:email', description: 'Realistic email address' },
  { annotation: '@faker:firstName', description: 'First name' },
  { annotation: '@faker:lastName', description: 'Last name' },
  { annotation: '@faker:fullName', description: 'Full name' },
  { annotation: '@faker:phone', description: 'Phone number' },
  { annotation: '@faker:zipCode', description: 'Postal / ZIP code' },
  { annotation: '@faker:city', description: 'City name' },
  { annotation: '@faker:country', description: 'Country name' },
  { annotation: '@faker:streetAddress', description: 'Street address' },
  { annotation: '@faker:creditCard', description: 'Credit card number' },
  { annotation: '@faker:iban', description: 'IBAN bank account number' },
  { annotation: '@faker:url', description: 'Full URL' },
  { annotation: '@faker:ipv4', description: 'IPv4 address' },
  { annotation: '@faker:hexColor', description: 'Hex colour code' },
  { annotation: '@faker:companyName', description: 'Company name' },
  { annotation: '@faker:jobTitle', description: 'Job title' },
  { annotation: '@faker:paragraph', description: 'Lorem paragraph' },
  { annotation: '@faker:sentence', description: 'Lorem sentence' },
  { annotation: '@faker:word', description: 'Single word' },
  { annotation: '@regex:[A-Z]{3}-\\d{4}', description: 'Custom regex pattern' },
];

export function inferColumnBadges(colName, sampleValue, allTableNames = []) {
  const badges = [];
  const lower = colName.toLowerCase();
  const strVal = sampleValue !== null && sampleValue !== undefined ? String(sampleValue) : '';

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(strVal)) badges.push('UUID');

  if (lower === 'id') badges.push('PK');

  if (lower.endsWith('_id') && lower !== 'id') {
    const ref = lower.replace(/_id$/, '');
    const matched = tableNames.find(t => {
      const tl = t.toLowerCase();
      return tl === ref ||
        tl === ref + 's' ||
        tl === ref + 'es' ||
        (ref.endsWith('y') && tl === ref.slice(0, -1) + 'ies');
    });
    badges.push(matchedTable ? `FK → ${matchedTable}` : 'FK');
  }

  const dateColNames = ['created_at', 'updated_at', 'deleted_at', 'timestamp', 'date', 'time', 'datetime'];
  if (dateColNames.some(d => lower.includes(d))) badges.push('TIMESTAMP');
  else if (!badges.includes('UUID') && strVal && /^\d{4}-\d{2}-\d{2}/.test(strVal)) badges.push('DATE');

  if (strVal === 'true' || strVal === 'false') badges.push('BOOL');
  if (!badges.length && /^-?\d+$/.test(strVal) && strVal.length < 12) badges.push('INT');
  if (!badges.length && /^-?\d+\.\d+$/.test(strVal)) badges.push('FLOAT');

  return badges;
}

export function extractFkRelationships(tables) {
  if (!tables || tables.length === 0) return [];

  const tableNames = tables.map(t => t.tableName);
  const relationships = [];

  tables.forEach(table => {
    if (!table.rows || table.rows.length === 0) return;
    const columns = Object.keys(table.rows[0]);

    columns.forEach(col => {
      const lower = col.toLowerCase();
      if (!lower.endsWith('_id') || lower === 'id') return;

      const ref = lower.replace(/_id$/, '');
      const matched = tableNames.find(t => {
        const tl = t.toLowerCase();
        return tl === ref ||
          tl === ref + 's' ||
          tl === ref + 'es' ||
          (ref.endsWith('y') && tl === ref.slice(0, -1) + 'ies');
      });

      if (matched && matched !== table.tableName) {
        relationships.push({
          fromTable: table.tableName,
          fromCol: col,
          toTable: matched,
          toCol: 'id',
        });
      }
    });
  });

  return relationships;
}

export function hasNoInboundFKs(tableName, allRelationships) {
  return !allRelationships.some(r => r.toTable === tableName);
}

export function isSafeToRegenerate(tableName, allRelationships) {
  return !allRelationships.some(
    r => r.toTable === tableName || r.fromTable === tableName
  );
}

export function topologicalSort(tables, relationships) {
  const order = [];
  const visited = new Set();
  const deps = Object.fromEntries(tables.map(t => [t.tableName, []]));
  relationships.forEach(r => {
    if (deps[r.fromTable]) deps[r.fromTable].push(r.toTable);
  });

  function visit(name) {
    if (visited.has(name)) return;
    visited.add(name);
    (deps[name] || []).forEach(visit);
    order.push(name);
  }
  tables.forEach(t => visit(t.tableName));
  return order.map(name => tables.find(t => t.tableName === name)).filter(Boolean);
}

export function deriveTypeScriptTypes(tables) {
  const jsTypeOf = (val) => {
    if (val === null || val === undefined) return 'string | null';
    if (typeof val === 'boolean') return 'boolean';
    if (typeof val === 'number') return 'number';
    if (typeof val === 'object') return 'Record<string, unknown>';

    const s = String(val);
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRe.test(s)) return 'string';
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return 'string';

    return 'string';
  };

  return tables
    .filter(t => t.rows?.length)
    .map(table => {
      const sample = table.rows[0];
      const fields = Object.entries(sample)
        .map(([k, v]) => `  ${k}: ${jsTypeOf(v)};`)
        .join('\n');
      return `export interface ${table.tableName} {\n${fields}\n}`;
    })
    .join('\n\n');
}