import { NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-mock-status, x-api-key',
  'Access-Control-Max-Age': '86400',
};

const MAX_BODY_BYTES = 2 * 1024 * 1024;
const RATE_LIMIT_WINDOW_SECONDS = 10;
const RATE_LIMIT_MAX_REQUESTS = 50;
const MAX_DELAY_MS = 10000;

// Atomically increments the rate-limit counter and sets its expiry only on the first hit
// in the window, as a single server-side operation. Doing INCR then EXPIRE as two separate
// round trips (the previous approach) leaves a race window: if the process dies or is
// delayed between the two calls, the key can be left with no TTL and that IP is locked
// out of this mock permanently instead of for 10 seconds.
const RATE_LIMIT_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return current
`;

function jsonWithCors(body, init = {}) {
  return NextResponse.json(body, {
    ...init,
    headers: { ...CORS_HEADERS, ...(init.headers || {}) },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * Compiles a handler path into a matchable regex plus the ordered list of param names it
 * captures. Param tokens (`:name`, `{name}`, `[name]`) are located by scanning each path
 * segment for the token *anywhere* inside it, not by requiring the whole segment to be one —
 * so "/files/track-:fileId.pdf" and "/package-{version}" correctly isolate the dynamic part
 * instead of falling back to a static literal match.
 */
function compilePathMatcher(handlerPath) {
  const [rawPath, rawQuery] = (handlerPath || '/').split('?');
  const cleanPath = rawPath.replace(/\/$/, '') || '/';

  const paramNames = [];
  const tokens = cleanPath.split(/(:\w+|\{\w+\}|\[\w+\])/);

  const pattern = tokens
    .map((token) => {
      const match = token.match(/^[:{[](\w+)[}\]]?$/);
      if (match) {
        paramNames.push(match[1]);
        return '([^/]+)';
      }
      return token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('');

  const expectedQuery = new URLSearchParams(rawQuery || '');
  // More specific handlers should win ties: required query params outrank a bare path,
  // and fewer dynamic segments outrank more (an exact static route beats a wildcard one).
  const weight = paramNames.length * -1 + Array.from(expectedQuery.keys()).length * 2;

  return { regex: new RegExp(`^${pattern}$`), paramNames, expectedQuery, weight };
}

/**
 * Finds the best-matching handler for a request and extracts its path params into a
 * `{ name: value }` dictionary (e.g. `/users/789` against `/users/:id` yields `{ id: '789' }`),
 * and also honors query-string shape so `/items?category=books` and
 * `/items?category=electronics` can be registered as distinct handlers.
 */
function findHandler(handlers, method, cleanRequestedPath, requestQuery) {
  const candidates = handlers
    .filter((h) => String(h.method || '').toUpperCase() === method.toUpperCase())
    .map((h) => ({ handler: h, ...compilePathMatcher(h.path) }))
    .filter(({ regex, expectedQuery }) => {
      if (!regex.test(cleanRequestedPath)) return false;
      for (const [key, val] of expectedQuery.entries()) {
        if (!requestQuery.has(key)) return false;
        if (val && requestQuery.get(key) !== val) return false;
      }
      return true;
    })
    .sort((a, b) => b.weight - a.weight);

  if (candidates.length === 0) return null;

  const best = candidates[0];
  const pathMatch = cleanRequestedPath.match(best.regex);
  const params = {};
  best.paramNames.forEach((name, i) => {
    params[name] = pathMatch[i + 1];
  });

  return { handler: best.handler, params };
}

/**
 * Reads the request body as text while enforcing a hard byte cap on the actual stream.
 * This is the authoritative payload-size guard: a Content-Length header can be absent
 * (chunked transfer encoding has none at all) or simply lied about, so trusting it alone
 * — as the previous implementation did — doesn't actually stop a large body from being
 * parsed into memory. The Content-Length check in handleMockRequest is only a cheap
 * fast-fail for the common/honest case; this is what actually enforces the limit.
 */
async function readBodyWithCap(request, maxBytes) {
  if (!request.body) return '';

  const reader = request.body.getReader();
  const chunks = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel().catch(() => {});
      const err = new Error('Payload exceeds the maximum allowed size.');
      err.code = 'PAYLOAD_TOO_LARGE';
      throw err;
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder('utf-8').decode(merged);
}

function findIdKey(item) {
  if (!item || typeof item !== 'object') return null;
  if ('id' in item) return 'id';
  return Object.keys(item).find((k) => /(^|_)[Ii]d$/.test(k)) || null;
}

/**
 * Best-effort persistency layer. Previously, POST/PUT accepted a body and merged it into
 * the *response* only — nothing was ever written back, so the "collection" reset on every
 * request and a POST was invisible to a following GET. This writes mutations into the
 * stored mock data itself:
 *   - POST against an array-shaped fixture appends a new item (auto-id if none supplied).
 *   - PUT/PATCH/DELETE with a path param search every array-shaped fixture in this mock for
 *     an item whose id field matches the param, and update/remove it there — so a DELETE on
 *     /users/:id is reflected the next time something GETs /users.
 *   - Otherwise (a single, object-shaped resource) the body is merged into that handler's
 *     own fixtureData.
 * Returns the item that should be reflected in the response, or null if nothing applied
 * (callers fall back to the old echo behavior in that case).
 */
function applyPersistence(mockData, handler, method, pathParams, bodyJson) {
  if (!bodyJson || typeof bodyJson !== 'object') return null;

  if (method === 'POST' && Array.isArray(handler.fixtureData)) {
    const idKey = findIdKey(handler.fixtureData[0]) || 'id';
    const nextId =
      bodyJson[idKey] ??
      (handler.fixtureData.length
        ? Math.max(...handler.fixtureData.map((i) => Number(i[idKey]) || 0)) + 1
        : 1);
    const newItem = { [idKey]: nextId, ...bodyJson };
    handler.fixtureData.push(newItem);
    return newItem;
  }

  const idParam = Object.values(pathParams)[0];
  if (['PUT', 'PATCH', 'DELETE'].includes(method) && idParam !== undefined) {
    for (const h of mockData.handlers) {
      if (!Array.isArray(h.fixtureData)) continue;
      const idKey = findIdKey(h.fixtureData[0]);
      if (!idKey) continue;
      const idx = h.fixtureData.findIndex((item) => String(item[idKey]) === String(idParam));
      if (idx === -1) continue;

      if (method === 'DELETE') return h.fixtureData.splice(idx, 1)[0];
      h.fixtureData[idx] = { ...h.fixtureData[idx], ...bodyJson };
      return h.fixtureData[idx];
    }
  }

  if (!Array.isArray(handler.fixtureData) && typeof handler.fixtureData === 'object' && handler.fixtureData !== null) {
    handler.fixtureData = { ...handler.fixtureData, ...bodyJson };
    return handler.fixtureData;
  }

  return null;
}

/** Wires up the `paginationStyle` config, which the runner previously never read at all. */
function applyPagination(items, style, searchParams) {
  if (!Array.isArray(items) || !style || style === 'none') return items;

  if (style === 'cursor') {
    const cursor = Math.max(0, parseInt(searchParams.get('cursor'), 10) || 0);
    const limit = Math.max(1, parseInt(searchParams.get('limit'), 10) || 20);
    const data = items.slice(cursor, cursor + limit);
    const nextCursor = cursor + limit < items.length ? cursor + limit : null;
    return { data, nextCursor, limit, total: items.length };
  }

  if (style === 'page') {
    const pageSize = Math.max(1, parseInt(searchParams.get('pageSize'), 10) || 20);
    const page = Math.max(1, parseInt(searchParams.get('page'), 10) || 1);
    const start = (page - 1) * pageSize;
    const data = items.slice(start, start + pageSize);
    return { data, page, pageSize, totalPages: Math.ceil(items.length / pageSize), totalItems: items.length };
  }

  // 'offset' style (also the fallback for any unrecognized value)
  const limit = Math.max(1, parseInt(searchParams.get('limit'), 10) || 20);
  const offset = Math.max(0, parseInt(searchParams.get('offset'), 10) || 0);
  const data = items.slice(offset, offset + limit);
  return { data, limit, offset, total: items.length };
}

function authRequirementMessage(authStyle) {
  if (authStyle === 'apiKey') return 'an x-api-key header';
  if (authStyle === 'basic') return 'an Authorization: Basic <credentials> header';
  return 'an Authorization: Bearer <token> header';
}

/** Wires up the `authStyle` config. This is presence-based, not real credential
 * verification — it's a mock server, the point is to simulate the *shape* of an
 * auth-protected API so client code can be tested against it, not to authenticate anyone. */
function checkAuth(request, authStyle) {
  if (!authStyle || authStyle === 'none') return true;

  if (authStyle === 'bearer') return /^Bearer\s+\S+/i.test(request.headers.get('authorization') || '');
  if (authStyle === 'basic') return /^Basic\s+\S+/i.test(request.headers.get('authorization') || '');
  if (authStyle === 'apiKey') return !!(request.headers.get('x-api-key') || '').trim();
  return true;
}

export async function handleMockRequest(request, context, method) {
  // Fast-fail on an obviously oversized declared payload before doing any Redis work.
  // This is a cheap optimization, not the real guard — see readBodyWithCap for that.
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
      return jsonWithCors(
        { error: `Payload too large. Max ${MAX_BODY_BYTES / (1024 * 1024)}MB allowed.` },
        { status: 413 }
      );
    }
  }

  const params = await context.params;
  const { mockId, slug } = params;

  const requestedPath = slug ? '/' + slug.join('/') : '/';
  const cleanRequestedPath = requestedPath.replace(/\/$/, '') || '/';

  try {
    const redis = await getRedisClient();

    const ip = (request.headers.get('x-forwarded-for') || 'anonymous').split(',')[0].trim();
    const rateKey = `rate:${mockId}:${ip}`;
    const reqCount = await redis.eval(RATE_LIMIT_SCRIPT, {
      keys: [rateKey],
      arguments: [String(RATE_LIMIT_WINDOW_SECONDS)],
    });
    if (reqCount > RATE_LIMIT_MAX_REQUESTS) {
      return jsonWithCors({ error: 'Rate limit exceeded. Too many requests to this mock.' }, { status: 429 });
    }

    const dataString = await redis.get(`mock:${mockId}`);
    if (!dataString) {
      return jsonWithCors({ error: 'Live mock server not found or has expired.' }, { status: 404 });
    }

    let mockData;
    try {
      mockData = JSON.parse(dataString);
    } catch (parseError) {
      // Isolated so one corrupted mock can't cascade into an unhandled crash — reported
      // as 502 (bad upstream data) rather than a generic 500 so client tooling can tell
      // "your mock config is broken" apart from "our infra is down".
      console.error(`Mock ID ${mockId} corrupted data:`, parseError);
      return jsonWithCors(
        { error: 'Mock engine failed parsing stored configuration.', details: parseError.message },
        { status: 502 }
      );
    }

    if (requestedPath === '/') {
      return jsonWithCors(
        {
          status: 'online',
          message: '🚀 Welcome to your Live Mock Server container!',
          instructions: 'Append one of the available generated endpoints below to this URL to fetch data.',
          availableEndpoints: mockData.handlers.map((h) => ({
            method: h.method.toUpperCase(),
            fullUrl: `${request.nextUrl.origin}/m/${mockId}${h.path}`,
            description: h.description,
          })),
        },
        { status: 200 }
      );
    }

    const matchResult = findHandler(mockData.handlers, method, cleanRequestedPath, request.nextUrl.searchParams);
    if (!matchResult) {
      return jsonWithCors(
        {
          error: `No route found for ${method} ${cleanRequestedPath}${request.nextUrl.search}`,
          availableRoutes: mockData.handlers.map((h) => `${h.method} ${h.path}`),
        },
        { status: 404 }
      );
    }

    const { handler, params: pathParams } = matchResult;
    const forceStatus = request.headers.get('x-mock-status');

    // Auth gate — skipped when the caller is explicitly forcing a status via x-mock-status,
    // since that header is already an established "I'm testing a specific response" escape
    // hatch in this codebase.
    const authStyle = mockData.config?.authStyle;
    if (!forceStatus && !checkAuth(request, authStyle)) {
      return jsonWithCors(
        { error: 'Unauthorized', message: `This mock endpoint requires ${authRequirementMessage(authStyle)}.` },
        { status: 401 }
      );
    }

    const errorRate = Math.min(100, Math.max(0, Number(mockData.config?.errorRate) || 0));
    const delayMs = Math.min(
      MAX_DELAY_MS,
      Math.max(0, Number(handler.delayMs ?? mockData.config?.delayMs ?? 0))
    );
    if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));

    let responseStatus = handler.statusCode || 200;
    let responseData = handler.fixtureData;

    if (forceStatus && handler.errorVariants) {
      const targetStatus = parseInt(forceStatus, 10);
      const variant = handler.errorVariants.find((v) => v.statusCode === targetStatus);
      if (variant) {
        responseStatus = variant.statusCode;
        responseData = variant.fixtureData;
      }
    } else if (errorRate > 0 && handler.errorVariants?.length > 0) {
      const roll = Math.random() * 100;
      if (roll < errorRate) {
        const variant = handler.errorVariants[Math.floor(Math.random() * handler.errorVariants.length)];
        responseStatus = variant.statusCode;
        responseData = variant.fixtureData;
      }
    }

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && responseStatus >= 200 && responseStatus < 300) {
      try {
        const bodyText = await readBodyWithCap(request, MAX_BODY_BYTES);
        const bodyJson = bodyText ? JSON.parse(bodyText) : null;
        const persisted = applyPersistence(mockData, handler, method, pathParams, bodyJson || {});

        if (method === 'DELETE') {
          responseData = persisted ?? { deleted: true, ...pathParams };
        } else if (persisted) {
          responseData = persisted;
        } else if (bodyJson && typeof responseData === 'object' && responseData !== null && !Array.isArray(responseData)) {
          responseData = { ...responseData, ...bodyJson };
        }

        // Write the mutation back so the next request — from any client, on any handler —
        // sees it too. TTL is preserved (falling back to 60s if we can't read a positive
        // one) so mutating traffic can't be used to keep a mock alive forever for free.
        const remainingTtl = await redis.ttl(`mock:${mockId}`);
        await redis.set(`mock:${mockId}`, JSON.stringify(mockData), { EX: remainingTtl > 0 ? remainingTtl : 60 });
      } catch (e) {
        if (e.code === 'PAYLOAD_TOO_LARGE') {
          return jsonWithCors(
            { error: `Payload too large. Max ${MAX_BODY_BYTES / (1024 * 1024)}MB allowed.` },
            { status: 413 }
          );
        }
        // Malformed or absent JSON body — fall through and return the fixture untouched,
        // same as the previous behavior.
      }
    }

    if (typeof responseData === 'object' && responseData !== null && !Array.isArray(responseData)) {
      // Clone before mutating — responseData may still be a direct reference into
      // mockData.handlers (e.g. plain GET requests never pass through applyPersistence),
      // and we don't want to leak path-param values into the in-memory fixture object.
      responseData = { ...responseData };
      for (const [key, value] of Object.entries(pathParams)) {
        if (key in responseData) {
          responseData[key] = isNaN(value) ? value : Number(value);
        }
      }
    }

    if (method === 'GET' && Array.isArray(responseData)) {
      responseData = applyPagination(responseData, mockData.config?.paginationStyle, request.nextUrl.searchParams);
    }

    return jsonWithCors(responseData, { status: responseStatus });
  } catch (error) {
    console.error('Mock server error:', error);
    return jsonWithCors({ error: 'Database connection failed or transaction timed out.' }, { status: 500 });
  }
}

export async function GET(req, ctx) { return handleMockRequest(req, ctx, 'GET'); }
export async function POST(req, ctx) { return handleMockRequest(req, ctx, 'POST'); }
export async function PUT(req, ctx) { return handleMockRequest(req, ctx, 'PUT'); }
export async function PATCH(req, ctx) { return handleMockRequest(req, ctx, 'PATCH'); }
export async function DELETE(req, ctx) { return handleMockRequest(req, ctx, 'DELETE'); }