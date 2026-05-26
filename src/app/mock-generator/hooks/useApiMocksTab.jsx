'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useApp } from '@/context';
import { convertCode } from '@/lib/api';

export const FRAMEWORK_OPTIONS = [
  { value: 'msw',    label: 'MSW v2 (Mock Service Worker)',  icon: 'fa-shield-halved' },
  { value: 'nextjs', label: 'Next.js App Router Routes',     icon: 'fa-route' },
  { value: 'axios',  label: 'Axios Mock Adapter',            icon: 'fa-circle-nodes' },
  { value: 'json',   label: 'JSON Fixtures Only',            icon: 'fa-file-code' },
];

export const PAGINATION_OPTIONS = [
  { value: 'none',   label: 'None' },
  { value: 'offset', label: 'Offset / Limit' },
  { value: 'cursor', label: 'Cursor-based' },
  { value: 'page',   label: 'Page / Per Page' },
];

export const AUTH_OPTIONS = [
  { value: 'none',    label: 'None' },
  { value: 'bearer',  label: 'Bearer / JWT' },
  { value: 'apikey',  label: 'API Key Header' },
  { value: 'session', label: 'Session Cookie' },
];

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
  const m = method.toUpperCase();
  const map = {
    GET:    { cls: 'method-badge--get',    label: 'GET' },
    POST:   { cls: 'method-badge--post',   label: 'POST' },
    PUT:    { cls: 'method-badge--put',    label: 'PUT' },
    PATCH:  { cls: 'method-badge--patch',  label: 'PATCH' },
    DELETE: { cls: 'method-badge--delete', label: 'DELETE' },
  };
  return map[m] ?? { cls: 'method-badge--get', label: m };
}

export function useApiMocksTab({ onDataUpdate } = {}) {
  const { moduleData, qualityMode } = useApp();

  const [specInput, setSpecInput]               = useState('');
  const [framework, setFramework]               = useState('msw');
  const [endpointCount, setEndpointCount]       = useState(5);
  const [delayMs, setDelayMs]                   = useState(0);
  const [errorRate, setErrorRate]               = useState(0);
  const [paginationStyle, setPaginationStyle]   = useState('none');
  const [authStyle, setAuthStyle]               = useState('none');
  const [includeTypes, setIncludeTypes]         = useState(true);
  const [includeAnalysis, setIncludeAnalysis]   = useState(false);

  const [isLoading, setIsLoading]               = useState(false);
  const [generatedData, setGeneratedData]       = useState(null);
  const [activeHandlerIdx, setActiveHandlerIdx] = useState(0);
  const [viewMode, setViewMode]                 = useState('code');   // 'code' | 'fixture'
  const [filterQuery, setFilterQuery]           = useState('');
  const [parsedSpecFeedback, setParsedSpecFeedback] = useState([]);

  const [copyFlash, setCopyFlash] = useState(null); // null | 'handler' | 'all'

  const [savedSpecs, setSavedSpecs]           = useState([]);
  const [specsVisible, setSpecsVisible]       = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [newSpecName, setNewSpecName]         = useState('');
  const [saveSpecError, setSaveSpecError]     = useState('');

  const [modalConfig, setModalConfig] = useState({
    isOpen: false, title: '', message: '', onConfirm: () => {},
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem('mockApiSpecs');
      if (saved) setSavedSpecs(JSON.parse(saved));
    } catch (e) {
      console.warn('Failed to load saved API specs:', e);
      localStorage.removeItem('mockApiSpecs');
    }
  }, []);

  useEffect(() => {
    if (moduleData && moduleData.type === 'api-mocks') {
      setSpecInput(moduleData.input || '');
      if (moduleData.framework)      setFramework(moduleData.framework);
      if (moduleData.endpointCount)  setEndpointCount(moduleData.endpointCount);
      if (moduleData.delayMs != null) setDelayMs(moduleData.delayMs);
      if (moduleData.errorRate != null) setErrorRate(moduleData.errorRate);
      if (moduleData.paginationStyle) setPaginationStyle(moduleData.paginationStyle);
      if (moduleData.authStyle)       setAuthStyle(moduleData.authStyle);
      if (moduleData.includeTypes != null) setIncludeTypes(moduleData.includeTypes);
      if (moduleData.includeAnalysis != null) setIncludeAnalysis(moduleData.includeAnalysis);

      const rawOutput = moduleData.output || moduleData.fullOutput;
      if (rawOutput) {
        try {
          const parsed = typeof rawOutput === 'string' ? JSON.parse(rawOutput) : rawOutput;
          setGeneratedData(parsed);
          setParsedSpecFeedback(parsed.parsedSpec || []);
          setActiveHandlerIdx(0);
          setFilterQuery('');
        } catch (e) {
          console.error('Failed to rehydrate API mock data:', e);
        }
      }
    }
  }, [moduleData]);

  // Reset active handler & filter when data changes
  useEffect(() => {
    setActiveHandlerIdx(0);
    setFilterQuery('');
  }, [generatedData]);

  const detectedFormat = useMemo(() => detectSpecFormat(specInput), [specInput]);

  const filteredHandlers = useMemo(() => {
    if (!generatedData?.handlers) return [];
    if (!filterQuery.trim()) return generatedData.handlers;

    const q = filterQuery.toLowerCase();

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

  const handleGenerate = useCallback(async () => {
    if (!specInput.trim()) return;

    setIsLoading(true);
    setParsedSpecFeedback([]);
    setGeneratedData(null);

    try {
      const data = await convertCode('api-mocks', specInput, {
        framework,
        endpointCount,
        delayMs,
        errorRate,
        paginationStyle,
        authStyle,
        includeTypes,
        includeAnalysis,
        qualityMode,
        detectedFormat,
      });

      setGeneratedData(data);
      setParsedSpecFeedback(data.parsedSpec || []);
      setActiveHandlerIdx(0);
      setFilterQuery('');
      setViewMode('code');

      if (onDataUpdate) {
        onDataUpdate({
          type: 'api-mocks',
          input: specInput,
          output: JSON.stringify(data),
          framework, endpointCount, delayMs, errorRate,
          paginationStyle, authStyle, includeTypes, includeAnalysis,
        });
      }
    } catch (error) {
      console.error(error);
      alert(error.message || 'Error generating API mock handlers.');
    } finally {
      setIsLoading(false);
    }
  }, [
    specInput, framework, endpointCount, delayMs, errorRate,
    paginationStyle, authStyle, includeTypes, includeAnalysis,
    qualityMode, detectedFormat, onDataUpdate,
  ]);

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
      .catch(() => {});
  }, [activeHandler, viewMode, flashCopy]);

  const handleCopyAll = useCallback(() => {
    if (!generatedData?.handlers) return;

    const allCode = generatedData.handlers.map(h => h.code).join('\n\n// ────────────────────────────\n\n');
    navigator.clipboard.writeText(allCode)
      .then(() => flashCopy('all'))
      .catch(() => {});
  }, [generatedData, flashCopy]);

  const downloadFile = (content, filename, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const executeExport = useCallback((exportType) => {
    if (!generatedData?.handlers) return;

    if (exportType === 'all-ts') {
      const ext = framework === 'nextjs' ? 'ts' : 'ts';
      const fileHeader = framework === 'msw'
        ? `// MSW v2 Handlers – generated by Mock Data Factory\nimport { http, HttpResponse } from 'msw';\n\nexport const handlers = [\n`
        : framework === 'nextjs'
        ? `// Next.js App Router API Routes – generated by Mock Data Factory\n`
        : `// Axios Mock Adapter handlers – generated by Mock Data Factory\nimport MockAdapter from 'axios-mock-adapter';\n\n`;

      const allCode = generatedData.handlers.map(h => h.code).join('\n\n');
      const fileFooter = framework === 'msw' ? '\n];\n' : '';
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

    setModalConfig(prev => ({ ...prev, isOpen: false }));
  }, [generatedData, activeHandler, framework]);

  const triggerExportModal = useCallback((type) => {
    const labels = {
      'all-ts':        `All Handlers (.ts)`,
      'fixtures-json': 'JSON Fixtures',
      'active-ts':     `Active Handler (.ts)`,
      'postman':       'Postman Collection (.json)',
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
      setSaveSpecError('A spec with this name already exists.');
      return;
    }
    const newSaved = [...savedSpecs, { name: trimmed, spec: specInput, framework }];

    setSavedSpecs(newSaved);
    localStorage.setItem('mockApiSpecs', JSON.stringify(newSaved));
    setIsSaveModalOpen(false);
  }, [newSpecName, savedSpecs, specInput, framework]);

  const handleDeleteSpec = useCallback((idx) => {
    const newSaved = savedSpecs.filter((_, i) => i !== idx);
    setSavedSpecs(newSaved);

    localStorage.setItem('mockApiSpecs', JSON.stringify(newSaved));
    if (newSaved.length === 0) setSpecsVisible(false);
  }, [savedSpecs]);

  return {
    // Form
    specInput, setSpecInput,
    framework, setFramework,
    endpointCount, setEndpointCount,
    delayMs, setDelayMs,
    errorRate, setErrorRate,
    paginationStyle, setPaginationStyle,
    authStyle, setAuthStyle,
    includeTypes, setIncludeTypes,
    includeAnalysis, setIncludeAnalysis,
    detectedFormat,

    // Output
    isLoading,
    generatedData,
    activeHandlerIdx,
    setActiveHandlerIdx: (idx) => { setActiveHandlerIdx(idx); },
    viewMode, setViewMode,
    filterQuery, setFilterQuery,
    filteredHandlers,
    activeHandler,
    parsedSpecFeedback,
    methodCounts,
    copyFlash,

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