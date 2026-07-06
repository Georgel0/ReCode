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
    value: `type User {\n  id: ID!\n  name: String!\n  email: String!\n  role: String!  # admin | member | viewer\n  avatarUrl: String\n  createdAt: String!\n  updatedAt: String!\n}\n\ntype Query {\n  users(page: Int, limit: Int): [User!]!\n  user(id: ID!): User\n}\n\ntype Mutation {\n  createUser(name: String!, email: String!, role: String!): User!\n  updateUser(id: ID!, name: String, role: String): User!\n  deleteUser(id: ID!): Boolean!\n}`,
  },
  {
    label: 'E-Commerce Products',
    value: `type Product {\n  id: ID!\n  sku: String!\n  name: String!\n  price: Float!\n  stock: Int!\n  category: String!\n  imageUrl: String\n  rating: Float\n  tags: [String!]!\n}\n\ntype Cart {\n  id: ID!\n  userId: ID!\n  items: [CartItem!]!\n  total: Float!\n}\n\ntype CartItem {\n  productId: ID!\n  quantity: Int!\n  unitPrice: Float!\n}`,
  },
  {
    label: 'Auth Endpoints',
    value: `POST /api/auth/register\n  Body: { email: string, password: string, name: string }\n  Response: { user: User, token: string }\n\nPOST /api/auth/login\n  Body: { email: string, password: string }\n  Response: { user: User, accessToken: string, refreshToken: string }\n\nPOST /api/auth/refresh\n  Body: { refreshToken: string }\n  Response: { accessToken: string }\n\nPOST /api/auth/logout\n  Headers: Authorization: Bearer <token>\n  Response: { success: boolean }\n\nGET /api/auth/me\n  Headers: Authorization: Bearer <token>\n  Response: { user: User }`,
  },
  {
    label: 'Blog / CMS API',
    value: `interface Post {\n  id: string;\n  title: string;\n  slug: string;\n  body: string;\n  excerpt: string;\n  author: Author;\n  tags: string[];\n  status: 'draft' | 'published' | 'archived';\n  publishedAt: string | null;\n  viewCount: number;\n}\n\ninterface Author {\n  id: string;\n  name: string;\n  bio: string;\n  avatarUrl: string;\n}\n\ninterface Comment {\n  id: string;\n  postId: string;\n  author: string;\n  body: string;\n  createdAt: string;\n  likes: number;\n}`,
  },
];

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

export const FORMAT_LABELS = {
  graphql: 'GraphQL SDL',
  openapi: 'OpenAPI / Swagger',
  typescript: 'TypeScript',
  json: 'JSON Sample',
  rest: 'REST Spec',
  auto: 'Auto-Detect',
};

export const FORMAT_ICONS = {
  graphql: 'fa-bezier-curve',
  openapi: 'fa-file-contract',
  typescript: 'fa-code',
  json: 'fa-brackets-curly',
  rest: 'fa-list-ul',
  auto: 'fa-wand-magic-sparkles',
};

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