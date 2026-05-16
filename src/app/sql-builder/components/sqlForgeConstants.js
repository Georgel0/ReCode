export const DIALECTS = [
  { value: 'Standard SQL', label: 'Standard SQL' },
  { value: 'PostgreSQL', label: 'PostgreSQL' },
  { value: 'MySQL', label: 'MySQL' },
  { value: 'SQLite', label: 'SQLite' },
  { value: 'SQL Server', label: 'SQL Server (T-SQL)' },
  { value: 'Oracle', label: 'Oracle PL/SQL' },
  { value: 'Snowflake', label: 'Snowflake' },
  { value: 'BigQuery', label: 'Google BigQuery' },
  { value: 'Redshift', label: 'AWS Redshift' },
];

export const MODES = [
  { id: 'builder', label: 'Builder', icon: 'fa-wand-magic-sparkles' },
  { id: 'converter', label: 'Converter', icon: 'fa-right-left' },
  { id: 'optimizer', label: 'Optimizer', icon: 'fa-gauge-high' },
];

export const STORAGE_KEY = 'sqlForge_workspaces';

const FORMATTER_DIALECT_MAP = {
  MySQL: 'mysql',
  PostgreSQL: 'postgresql',
  SQLite: 'sqlite',
  'SQL Server': 'tsql',
  Oracle: 'plsql',
  Snowflake: 'snowflake',
  BigQuery: 'bigquery',
  Redshift: 'redshift',
};

export const getFormatterDialect = (dialectName) =>
  FORMATTER_DIALECT_MAP[dialectName] || 'sql';

export const safeParseWorkspaces = (raw) => {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch { /* ignore */ }
  return null;
};

export const persistWorkspaces = (workspaces) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workspaces));
  } catch { /* storage quota or SSR */ }
};