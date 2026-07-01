'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '@/context';
import { convertCode, useDraft } from '@/lib';

export const FRAMEWORK_OPTIONS = [
  { value: 'msw', label: 'MSW v2 (Mock Service Worker)', icon: 'fa-shield-halved' },
  { value: 'nextjs', label: 'Next.js App Router Routes', icon: 'fa-route' },
  { value: 'axios', label: 'Axios Mock Adapter', icon: 'fa-circle-nodes' },
  { value: 'json', label: 'JSON Fixtures Only', icon: 'fa-file-code' },
];

export const PAGINATION_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'offset', label: 'Offset / Limit' },
  { value: 'cursor', label: 'Cursor-based' },
  { value: 'page', label: 'Page / Per Page' },
];

export const AUTH_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'bearer', label: 'Bearer / JWT' },
  { value: 'apikey', label: 'API Key Header' },
  { value: 'session', label: 'Session Cookie' },
];

export const ENV_PREFIX_OPTIONS = [
  { value: 'none', label: 'None (hardcoded)' },
  { value: 'process.env', label: 'process.env' },
  { value: 'import.meta.env', label: 'import.meta.env' },
];

export const DEFAULT_OUTPUT_CONFIG = {
  framework: 'msw',
  endpointCount: 5,
  delayMs: 0,
  errorRate: 0,
  paginationStyle: 'none',
  authStyle: 'none',
  includeTypes: true,
  includeAnalysis: false,
  envPrefix: 'none',
};

export const SPEC_TEMPLATES = [
  {
    label: 'Users REST CRUD',
    value: `type User {
  id: ID!
  name: String!
  email: String!
  role: String!  # admin | member | viewer
  avatarUrl: String
  createdAt: String!
  updatedAt: String!
}

type Query {
  users(page: Int, limit: Int): [User!]!
  user(id: ID!): User
}

type Mutation {
  createUser(name: String!, email: String!, role: String!): User!
  updateUser(id: ID!, name: String, role: String): User!
  deleteUser(id: ID!): Boolean!
}`,
  },
  {
    label: 'E-Commerce Products',
    value: `type Product {
  id: ID!
  sku: String!
  name: String!
  price: Float!
  stock: Int!
  category: String!
  imageUrl: String
  rating: Float
  tags: [String!]!
}

type Cart {
  id: ID!
  userId: ID!
  items: [CartItem!]!
  total: Float!
}

type CartItem {
  productId: ID!
  quantity: Int!
  unitPrice: Float!
}`,
  },
  {
    label: 'Auth Endpoints',
    value: `POST /api/auth/register
  Body: { email: string, password: string, name: string }
  Response: { user: User, token: string }

POST /api/auth/login
  Body: { email: string, password: string }
  Response: { user: User, accessToken: string, refreshToken: string }

POST /api/auth/refresh
  Body: { refreshToken: string }
  Response: { accessToken: string }

POST /api/auth/logout
  Headers: Authorization: Bearer <token>
  Response: { success: boolean }

GET /api/auth/me
  Headers: Authorization: Bearer <token>
  Response: { user: User }`,
  },
  {
    label: 'Blog / CMS API',
    value: `interface Post {
  id: string;
  title: string;
  slug: string;
  body: string;
  excerpt: string;
  author: Author;
  tags: string[];
  status: 'draft' | 'published' | 'archived';
  publishedAt: string | null;
  viewCount: number;
}

interface Author {
  id: string;
  name: string;
  bio: string;
  avatarUrl: string;
}

interface Comment {
  id: string;
  postId: string;
  author: string;
  body: string;
  createdAt: string;
  likes: number;
}`,
  },
];

/**
 * Auto-detects input spec format from content.
 * Returns one of: 'graphql' | 'openapi' | 'typescript' | 'json' | 'rest' | 'auto'
 */
export function detectSpecFormat(input) {
  if (!input?.trim()) return 'auto';
  const t = input.trim();

  if (
    (t.includes('type ') && (t.includes('Query {') || t.includes('Mutation {') || t.includes('!}'))) ||
    t.startsWith('type ') || t.startsWith('input ') || t.startsWith('enum ')
  ) return 'graphql';

  if (t.includes('openapi:') || t.includes('"openapi"') || t.includes('swagger:') || t.includes('"swagger"'))
    return 'openapi';

  if (t.startsWith('{') || t.startsWith('[')) return 'json';

  if (
    t.includes(': string') || t.includes(': number') || t.includes(': boolean') ||
    /^(interface|type)\s+\w+/m.test(t)
  ) return 'typescript';

  if (/^(GET|POST|PUT|PATCH|DELETE)\s+\//m.test(t) || t.includes('/api/'))
    return 'rest';

  return 'auto';
}

const FORMAT_LABELS = {
  graphql: 'GraphQL SDL',
  openapi: 'OpenAPI / Swagger',
  typescript: 'TypeScript',
  json: 'JSON Sample',
  rest: 'REST Spec',
  auto: 'Auto-Detect',
};

const FORMAT_ICONS = {
  graphql: 'fa-bezier-curve',
  openapi: 'fa-file-contract',
  typescript: 'fa-code',
  json: 'fa-brackets-curly',
  rest: 'fa-list-ul',
  auto: 'fa-wand-magic-sparkles',
};

export { FORMAT_LABELS, FORMAT_ICONS };

// Returns CSS modifier class and label for an HTTP method badge.
export function getMethodMeta(method = '') {
  const m = (method ?? '').toUpperCase();
  const map = {
    GET: { cls: 'method-badge--get', label: 'GET' },
    POST: { cls: 'method-badge--post', label: 'POST' },
    PUT: { cls: 'method-badge--put', label: 'PUT' },
    PATCH: { cls: 'method-badge--patch', label: 'PATCH' },
    DELETE: { cls: 'method-badge--delete', label: 'DELETE' },
  };
  return map[m] ?? { cls: 'method-badge--get', label: m };
}

const MAX_HISTORY = 5;

export function useApiMocksTab({ onDataUpdate } = {}) {
  const { moduleData, qualityMode } = useApp();

  const [specInput, setSpecInput] = useState('');

  const [outputConfig, setOutputConfig] = useState(DEFAULT_OUTPUT_CONFIG);
  const updateOutputConfig = useCallback((key, value) => {
    setOutputConfig(prev => ({ ...prev, [key]: value }));
  }, []);

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [generatedData, setGeneratedData] = useState(null);
  const [activeHandlerIdx, setActiveHandlerIdx] = useState(0);
  const [viewMode, setViewMode] = useState('code');   // 'code' | 'fixture'
  const [filterQuery, setFilterQuery] = useState('');
  const [parsedSpecFeedback, setParsedSpecFeedback] = useState([]);

  const [copyFlash, setCopyFlash] = useState(null); // null | 'handler' | 'all'

  const [savedSpecs, setSavedSpecs] = useState([]);
  const [specsVisible, setSpecsVisible] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [newSpecName, setNewSpecName] = useState('');
  const [saveSpecError, setSaveSpecError] = useState('');

  const [editingHandlerIdx, setEditingHandlerIdx] = useState(null);
  const [editingField, setEditingField] = useState(null); // 'code' | 'fixtureData'
  const [editDraft, setEditDraft] = useState('');
  const [handlerDirty, setHandlerDirty] = useState({}); // { [idx]: true }

  const [regeneratingIdx, setRegeneratingIdx] = useState(null);
  const [isAddEndpointOpen, setIsAddEndpointOpen] = useState(false);
  const [addEndpointInput, setAddEndpointInput] = useState('');

  const [isDragOver, setIsDragOver] = useState(false);

  const [generationHistory, setGenerationHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const [activeErrorVariant, setActiveErrorVariant] = useState({});

  const [modalConfig, setModalConfig] = useState({
    isOpen: false, title: '', message: '', onConfirm: () => { },
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem('mockApiSpecs');
      if (saved) setSavedSpecs(JSON.parse(saved));
    } catch (e) {
      console.warn('Failed to load saved API specs:', e);
      localStorage.removeItem('mockApiSpecs');
    }
    try {
      const hist = localStorage.getItem('mockApiHistory');
      if (hist) setGenerationHistory(JSON.parse(hist));
    } catch (e) {
      console.warn('Failed to load generation history:', e);
      localStorage.removeItem('mockApiHistory');
    }
  }, []);

  useEffect(() => {
    if (moduleData && moduleData.type === 'api-mocks') {
      setSpecInput(moduleData.input || '');
      setOutputConfig(prev => ({
        ...prev,
        ...(moduleData.framework && { framework: moduleData.framework }),
        ...(moduleData.endpointCount && { endpointCount: moduleData.endpointCount }),
        ...(moduleData.delayMs != null && { delayMs: moduleData.delayMs }),
        ...(moduleData.errorRate != null && { errorRate: moduleData.errorRate }),
        ...(moduleData.paginationStyle && { paginationStyle: moduleData.paginationStyle }),
        ...(moduleData.authStyle && { authStyle: moduleData.authStyle }),
        ...(moduleData.includeTypes != null && { includeTypes: moduleData.includeTypes }),
        ...(moduleData.includeAnalysis != null && { includeAnalysis: moduleData.includeAnalysis }),
        ...(moduleData.envPrefix && { envPrefix: moduleData.envPrefix }),
      }));

      const rawOutput = moduleData.output || moduleData.fullOutput;
      if (rawOutput) {
        try {
          const parsed = typeof rawOutput === 'string' ? JSON.parse(rawOutput) : rawOutput;
          setGeneratedData(parsed);
          setParsedSpecFeedback(parsed.parsedSpec || []);
          setActiveHandlerIdx(0);
          setFilterQuery('');
        } catch (e) {
          console.warn('Failed to parse stored output:', e);
        }
      }
    }
  }, [moduleData]);

  useDraft(
    'api-mocks-draft',
    { specInput, outputConfig, generatedData },
    (saved) => {
      if (saved.specInput !== undefined) setSpecInput(saved.specInput);
      if (saved.outputConfig) setOutputConfig(prev => ({ ...prev, ...saved.outputConfig }));
      if (saved.generatedData !== undefined) setGeneratedData(saved.generatedData);
    },
    {
      isEmpty: (d) => !d.specInput?.trim(),
      skip: !!(moduleData && moduleData.type === 'api-mocks'),
    }
  );

  const detectedFormat = useMemo(() => detectSpecFormat(specInput), [specInput]);

  const filteredHandlers = useMemo(() => {
    if (!generatedData?.handlers) return [];
    const q = filterQuery.toLowerCase().trim();
    if (!q) return generatedData.handlers;
    return generatedData.handlers.filter(h =>
      h.name?.toLowerCase().includes(q) ||
      h.path?.toLowerCase().includes(q) ||
      h.method?.toLowerCase().includes(q) ||
      h.description?.toLowerCase().includes(q)
    );
  }, [generatedData, filterQuery]);

  const activeHandler = filteredHandlers[activeHandlerIdx] ?? null;

  const methodCounts = useMemo(() => {
    if (!generatedData?.handlers) return {};

    return generatedData.handlers.reduce((acc, h) => {
      const m = h.method?.toUpperCase() ?? 'GET';
      acc[m] = (acc[m] || 0) + 1;
      return acc;
    }, {});
  }, [generatedData]);

  // Push a snapshot into generation history (localStorage + state)
  const pushHistory = useCallback((data) => {
    const entry = {
      timestamp: new Date().toISOString(),
      label: `${data.handlers?.length ?? 0} handlers – ${new Date().toLocaleTimeString()}`,
      data,
    };
    setGenerationHistory(prev => {
      const next = [entry, ...prev].slice(0, MAX_HISTORY);
      try { localStorage.setItem('mockApiHistory', JSON.stringify(next)); } catch (_) { }
      return next;
    });
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!specInput.trim()) return;

    setIsLoading(true);
    setParsedSpecFeedback([]);
    setGeneratedData(null);
    setHandlerDirty({});
    setActiveErrorVariant({});

    try {
      const data = await convertCode('api-mocks', specInput, {
        ...outputConfig,
        qualityMode,
        detectedFormat,
      });

      setGeneratedData(data);
      setParsedSpecFeedback(data.parsedSpec || []);
      setActiveHandlerIdx(0);
      setFilterQuery('');
      setViewMode('code');
      pushHistory(data);

      if (onDataUpdate) {
        onDataUpdate({
          type: 'api-mocks',
          input: specInput,
          output: JSON.stringify(data),
          ...outputConfig,
        });
      }
    } catch (error) {
      console.error(error);
      alert(error.message || 'Error generating API mock handlers.');
    } finally {
      setIsLoading(false);
    }
  }, [specInput, outputConfig, qualityMode, detectedFormat, onDataUpdate, pushHistory]);

  // Regenerate a single handler
  const handleRegenerateHandler = useCallback(async (idx) => {
    if (!generatedData?.handlers?.[idx]) return;
    const handler = generatedData.handlers[idx];
    setRegeneratingIdx(idx);

    try {
      // Narrow prompt: target just this one endpoint
      const singleSpec = `${handler.method} ${handler.path}\n${handler.description || ''}`;
      const data = await convertCode('api-mocks', singleSpec, {
        ...outputConfig,
        endpointCount: 1,
        includeAnalysis: false,
        qualityMode,
        detectedFormat: 'rest',
      });

      const newHandler = data.handlers?.[0];
      if (!newHandler) throw new Error('No handler returned');

      setGeneratedData(prev => {
        const handlers = [...prev.handlers];
        handlers[idx] = newHandler;
        const next = { ...prev, handlers };
        pushHistory(next);
        return next;
      });
      // Clear dirty state for this handler since it's freshly regenerated
      setHandlerDirty(prev => { const n = { ...prev }; delete n[idx]; return n; });
      setActiveErrorVariant(prev => { const n = { ...prev }; delete n[idx]; return n; });
    } catch (error) {
      console.error(error);
      alert(error.message || 'Error regenerating handler.');
    } finally {
      setRegeneratingIdx(null);
    }
  }, [generatedData, outputConfig, qualityMode, pushHistory]);

  // Add endpoint via mini-input
  const handleAddEndpoint = useCallback(async () => {
    if (!addEndpointInput.trim() || !generatedData) return;
    setIsLoading(true);
    try {
      const data = await convertCode('api-mocks', addEndpointInput.trim(), {
        ...outputConfig,
        endpointCount: 1,
        errorRate: 0,
        includeAnalysis: false,
        qualityMode,
        detectedFormat: 'rest',
      });

      const newHandler = data.handlers?.[0];
      if (!newHandler) throw new Error('No handler returned');

      setGeneratedData(prev => {
        const handlers = [...prev.handlers, newHandler];
        const next = { ...prev, handlers };
        pushHistory(next);
        return next;
      });
      setActiveHandlerIdx(prev => generatedData.handlers.length);
      const newCount = generatedData.handlers.length + 1;
      setGeneratedData(prev => ({ ...prev, handlers: [...prev.handlers, newHandler] }));
      pushHistory({ ...generatedData, handlers: [...generatedData.handlers, newHandler] });
      setActiveHandlerIdx(newCount - 1);

      setAddEndpointInput('');
      setIsAddEndpointOpen(false);
    } catch (error) {
      console.error(error);
      alert(error.message || 'Error adding endpoint.');
    } finally {
      setIsLoading(false);
    }
  }, [addEndpointInput, generatedData, outputConfig, qualityMode, pushHistory]);

  // File upload handler
  const handleFileUpload = useCallback((file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === 'string') setSpecInput(text);
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const handleDragOver = useCallback((e) => { e.preventDefault(); setIsDragOver(true); }, []);
  const handleDragLeave = useCallback(() => setIsDragOver(false), []);

  const flashCopy = useCallback((key) => {
    setCopyFlash(key);
    setTimeout(() => setCopyFlash(null), 2000);
  }, []);

  const handleCopyActiveHandler = useCallback(() => {
    if (!activeHandler) return;

    const text = viewMode === 'fixture'
      ? JSON.stringify(activeHandler.fixtureData, null, 2)
      : activeHandler.code;
    navigator.clipboard.writeText(text)
      .then(() => flashCopy('handler'))
      .catch(() => { });
  }, [activeHandler, viewMode, flashCopy]);

  const handleCopyAll = useCallback(() => {
    if (!generatedData?.handlers) return;

    const allCode = generatedData.handlers.map(h => h.code).join('\n\n// ────────────────────────────\n\n');
    navigator.clipboard.writeText(allCode)
      .then(() => flashCopy('all'))
      .catch(() => { });
  }, [generatedData, flashCopy]);

  // Inline editing: start editing a handler field
  const startEdit = useCallback((idx, field) => {
    if (!generatedData?.handlers?.[idx]) return;

    const handler = generatedData.handlers[idx];
    const value = field === 'fixtureData'
      ? JSON.stringify(handler.fixtureData, null, 2)
      : handler.code;
    setEditingHandlerIdx(idx);
    setEditingField(field);
    setEditDraft(value);
  }, [generatedData]);

  const cancelEdit = useCallback(() => {
    setEditingHandlerIdx(null);
    setEditingField(null);
    setEditDraft('');
  }, []);

  // Restore from history
  const handleRestoreHistory = useCallback((entry) => {
    setGeneratedData(entry.data);
    setParsedSpecFeedback(entry.data.parsedSpec || []);
    setActiveHandlerIdx(0);
    setFilterQuery('');
    setHandlerDirty({});
    setActiveErrorVariant({});
    cancelEdit();
    setHistoryOpen(false);
  }, [cancelEdit]);

  const commitEdit = useCallback(() => {
    if (editingHandlerIdx == null || !editingField) return;

    let parsedFixture;
    if (editingField === 'fixtureData') {
      try {
        parsedFixture = JSON.parse(editDraft);
      } catch (_) {
        alert('Invalid JSON in fixture data. Please fix before saving.');
        return;
      }
    }

    setGeneratedData(prev => {
      const handlers = [...prev.handlers];
      const handler = { ...handlers[editingHandlerIdx] };
      if (editingField === 'fixtureData') handler.fixtureData = parsedFixture;
      else handler.code = editDraft;
      handlers[editingHandlerIdx] = handler;
      return { ...prev, handlers };
    });
    setHandlerDirty(prev => ({ ...prev, [editingHandlerIdx]: true }));
    setEditingHandlerIdx(null);
    setEditingField(null);
    setEditDraft('');
  }, [editingHandlerIdx, editingField, editDraft]);

  // Error variant switcher
  const setErrorVariantForHandler = useCallback((handlerIdx, variantIdx) => {
    setActiveErrorVariant(prev => ({ ...prev, [handlerIdx]: variantIdx }));
  }, []);

  const downloadFile = (content, filename, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  // Zip export: group handlers by path prefix into directory structure
  const exportAsZip = useCallback(async () => {
    if (!generatedData?.handlers) return;
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      const srcMocks = zip.folder('src/mocks/handlers');

      // Group by first path segment
      const groups = {};
      generatedData.handlers.forEach(h => {
        const segments = h.path.replace(/^\//, '').split('/').filter(Boolean);
        const group = segments[0] || 'root';
        if (!groups[group]) groups[group] = [];
        groups[group].push(h);
      });

      const barrelImports = [];

      Object.entries(groups).forEach(([group, handlers]) => {
        const filename = `${group}.ts`;
        const content = [
          `// ${group} handlers – generated by Mock Data Factory`,
          outputConfig.framework === 'msw' ? `import { http, HttpResponse } from 'msw';` : '',
          '',
          ...handlers.map(h => h.code),
          '',
          `export const ${group}Handlers = [`,
          ...handlers.map(h => `  ${h.name},`),
          `];`,
        ].filter(l => l !== undefined).join('\n');
        srcMocks.file(filename, content);
        barrelImports.push({ group, filename });
      });

      // Barrel file
      const barrel = [
        `// Auto-generated barrel – re-exports all handler arrays`,
        ...barrelImports.map(({ group, filename }) =>
          `export { ${group}Handlers } from './${filename.replace('.ts', '')}';`
        ),
        '',
        `// Combined handlers array for setupWorker / setupServer`,
        `import { ${barrelImports.map(b => `${b.group}Handlers`).join(', ')} } from '.';`,
        `export const handlers = [${barrelImports.map(b => `...${b.group}Handlers`).join(', ')}];`,
      ].join('\n');
      srcMocks.file('index.ts', barrel);

      // Browser entry (MSW only)
      if (outputConfig.framework === 'msw') {
        zip.folder('src/mocks').file('browser.ts',
          `import { setupWorker } from 'msw/browser';\nimport { handlers } from './handlers';\nexport const worker = setupWorker(...handlers);\n`
        );
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mock-handlers.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (e) {
      console.error('Zip export failed:', e);
      alert('Zip export requires the jszip package. Run: npm install jszip');
    }
    setModalConfig(prev => ({ ...prev, isOpen: false }));
  }, [generatedData, outputConfig]);

  // VS Code snippets export
  const exportAsVSCodeSnippets = useCallback(() => {
    if (!generatedData?.handlers) return;
    const snippets = {};

    generatedData.handlers.forEach(h => {
      const key = h.name;
      // camelCase → trigger prefix
      const prefix = h.name;
      snippets[key] = {
        scope: 'typescript,javascript',
        prefix,
        body: h.code.split('\n'),
        description: h.description,
      };
    });

    downloadFile(
      JSON.stringify(snippets, null, 2),
      'api-mocks.code-snippets',
      'application/json'
    );
    setModalConfig(prev => ({ ...prev, isOpen: false }));
  }, [generatedData]);

  const executeExport = useCallback((exportType) => {
    if (!generatedData?.handlers) return;

    if (exportType === 'all-ts') {
      const ext = outputConfig.framework === 'json' ? 'json' : 'ts';
      const fileHeader = outputConfig.framework === 'msw'
        ? `// MSW v2 Handlers – generated by Mock Data Factory\nimport { http, HttpResponse } from 'msw';\n\nexport const handlers = [\n`
        : outputConfig.framework === 'nextjs'
          ? `// Next.js App Router API Routes – generated by Mock Data Factory\n`
          : `// Axios Mock Adapter handlers – generated by Mock Data Factory\nimport MockAdapter from 'axios-mock-adapter';\n\n`;

      const allCode = viewMode === 'fixture'
        ? generatedData.handlers.map(h =>
          JSON.stringify(h.fixtureData, null, 2)).join('\n\n')
        : generatedData.handlers.map(h => h.code).join('\n\n// ─────\n\n');
      const fileFooter = outputConfig.framework === 'msw' ? '\n];\n' : '';

      downloadFile(fileHeader + allCode + fileFooter, `mock-handlers.${ext}`, 'text/typescript');
    }

    else if (exportType === 'fixtures-json') {
      const fixtures = {};
      generatedData.handlers.forEach(h => {
        fixtures[`${h.method} ${h.path}`] = {
          status: h.statusCode ?? 200,
          data: h.fixtureData,
        };
      });
      downloadFile(JSON.stringify(fixtures, null, 2), 'fixtures.json', 'application/json');
    }

    else if (exportType === 'active-ts') {
      if (!activeHandler) return;
      downloadFile(activeHandler.code, `${activeHandler.name}.ts`, 'text/typescript');
    }

    else if (exportType === 'postman') {
      const collection = {
        info: { name: 'Mock API Collection', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
        item: generatedData.handlers.map(h => ({
          name: h.name,
          request: {
            method: h.method,
            url: { raw: `{{baseUrl}}${h.path}`, host: ['{{baseUrl}}'], path: h.path.split('/').filter(Boolean) },
            description: h.description,
          },
          response: [{
            name: `${h.statusCode ?? 200} OK`,
            status: 'OK',
            code: h.statusCode ?? 200,
            body: JSON.stringify(h.fixtureData, null, 2),
          }],
        })),
      };
      downloadFile(JSON.stringify(collection, null, 2), 'mock-collection.postman_collection.json', 'application/json');
    }

    // Project structure zip export
    else if (exportType === 'zip') {
      exportAsZip();
      return;
    }

    // Code snippets export
    else if (exportType === 'vscode-snippets') {
      exportAsVSCodeSnippets();
      return;
    }

    setModalConfig(prev => ({ ...prev, isOpen: false }));
  }, [generatedData, activeHandler, outputConfig, viewMode]);

  const triggerExportModal = useCallback((type) => {
    const labels = {
      'all-ts': `All Handlers (.ts)`,
      'fixtures-json': 'JSON Fixtures',
      'active-ts': `Active Handler (.ts)`,
      'postman': 'Postman Collection (.json)',
      'zip': 'Project Structure (.zip)',
      'vscode-snippets': 'VS Code Snippets (.code-snippets)',
    };

    setModalConfig({
      isOpen: true,
      title: `Export ${labels[type] || type}`,
      message: 'Download the generated mock code as a production-ready file.',
      confirmText: 'Export',
      cancelText: 'Cancel',
      icon: 'fa-file-export',
      onConfirm: () => executeExport(type),
    });
  }, [executeExport]);

  const handleSaveSpec = useCallback(() => {
    setNewSpecName('');
    setSaveSpecError('');
    setIsSaveModalOpen(true);
  }, []);

  const executeSaveSpec = useCallback(() => {
    if (!newSpecName?.trim()) { setSaveSpecError('Name cannot be empty.'); return; }

    const trimmed = newSpecName.trim();

    if (savedSpecs.some(s => s.name.toLowerCase() === trimmed.toLowerCase())) {
      setSaveSpecError('A spec with this name already exists.'); return;
    }

    const newSaved = [...savedSpecs, { name: trimmed, spec: specInput, framework: outputConfig.framework }];

    try {
      localStorage.setItem('mockApiSpecs', JSON.stringify(newSaved));
      setSavedSpecs(newSaved);
      setIsSaveModalOpen(false);
    } catch (e) {
      setSaveSpecError('Storage quota exceeded. Delete some saved specs first.');
    }
  }, [newSpecName, savedSpecs, specInput, outputConfig]);

  const handleDeleteSpec = useCallback((idx) => {
    const newSaved = savedSpecs.filter((_, i) => i !== idx);
    setSavedSpecs(newSaved);
    try {
      localStorage.setItem('mockApiSpecs', JSON.stringify(newSaved));
    } catch (e) {
      console.warn('Failed to persist spec deletion:', e);
    }
    if (newSaved.length === 0) setSpecsVisible(false);
  }, [savedSpecs]);

  return {
    // Form
    specInput, setSpecInput,
    outputConfig, updateOutputConfig,
    isDropdownOpen, setIsDropdownOpen,
    detectedFormat,

    // Output
    isLoading,
    generatedData, setGeneratedData,
    activeHandlerIdx,
    setActiveHandlerIdx,
    viewMode, setViewMode,
    filterQuery, setFilterQuery,
    filteredHandlers,
    activeHandler,
    parsedSpecFeedback,
    methodCounts,
    copyFlash,

    // Inline editing
    editingHandlerIdx, editingField, editDraft, setEditDraft,
    handlerDirty,
    startEdit, cancelEdit, commitEdit,

    // Single-handler regen & add endpoint
    regeneratingIdx,
    isAddEndpointOpen, setIsAddEndpointOpen,
    addEndpointInput, setAddEndpointInput,
    handleRegenerateHandler,
    handleAddEndpoint,

    // File upload
    isDragOver,
    handleDrop, handleDragOver, handleDragLeave,
    handleFileUpload,

    // Generation history
    generationHistory,
    historyOpen, setHistoryOpen,
    handleRestoreHistory,

    // Error variant
    activeErrorVariant,
    setErrorVariantForHandler,

    // Library
    savedSpecs, specsVisible, setSpecsVisible,
    isSaveModalOpen, setIsSaveModalOpen,
    newSpecName, setNewSpecName,
    saveSpecError, setSaveSpecError,

    // Modals
    modalConfig, setModalConfig,

    // Actions
    handleGenerate,
    handleCopyActiveHandler,
    handleCopyAll,
    triggerExportModal,
    handleSaveSpec,
    executeSaveSpec,
    handleDeleteSpec,
  };
}