import { NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-mock-status',
  'Access-Control-Max-Age': '86400',
};

function jsonWithCors(body, init = {}) {
  return NextResponse.json(body, {
    ...init,
    headers: { ...CORS_HEADERS, ...(init.headers || {}) },
  });
}

// Browsers send a preflight OPTIONS request before cross-origin GET/POST/etc.
// calls that carry custom headers (like x-mock-status) or non-simple methods.
// Without this, every call from a real frontend to its generated mock server
// fails at the preflight step before your handler code ever runs.
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// Turns a handler path template into a matcher that understands path
// parameters written as `:id`, `{id}`, or `[id]`, so a request to `/users/123`
// correctly matches a stored handler registered as `/users/:id`.
function compilePathMatcher(handlerPath) {
  const cleanPath = (handlerPath || '/').split('?')[0].replace(/\/$/, '') || '/';
  let paramCount = 0;

  const pattern = cleanPath
    .split('/')
    .map(segment => {
      const isParam =
        /^:(\w+)$/.test(segment) ||
        /^\{(\w+)\}$/.test(segment) ||
        /^\[(\w+)\]$/.test(segment);
      if (isParam) {
        paramCount += 1;
        return '([^/]+)';
      }
      // Escape literal segments so regex special chars in a static path
      // (e.g. a path containing a dot) don't get treated as regex syntax.
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');

  return { regex: new RegExp(`^${pattern}$`), paramCount };
}

function findHandler(handlers, method, cleanRequestedPath) {
  return handlers
    .filter(h => h.method.toUpperCase() === method.toUpperCase())
    .map(h => ({ handler: h, ...compilePathMatcher(h.path) }))
    // Try static (param-free) paths before dynamic ones, so a literal route
    // like /users/me isn't shadowed by an earlier /users/:id handler.
    .sort((a, b) => a.paramCount - b.paramCount)
    .find(({ regex }) => regex.test(cleanRequestedPath))?.handler ?? null;
}

async function handleMockRequest(request, { params }, method) {
  const { mockId, slug } = await params;

  const requestedPath = slug ? '/' + slug.join('/') : '/';

  try {
    const redis = await getRedisClient();
    const dataString = await redis.get(`mock:${mockId}`);

    if (!dataString) {
      return jsonWithCors({ error: "Live mock server not found or has expired." }, { status: 404 });
    }

    const mockData = JSON.parse(dataString);

    if (requestedPath === '/') {
      return jsonWithCors({
        status: "online",
        message: "🚀 Welcome to your Live Mock Server container!",
        instructions: "Append one of the available generated endpoints below to this URL to fetch data.",
        availableEndpoints: mockData.handlers.map(h => ({
          method: h.method.toUpperCase(),
          fullUrl: `${request.nextUrl.origin}/m/${mockId}${h.path}`,
          description: h.description
        }))
      }, { status: 200 });
    }

    const cleanRequestedPath = requestedPath.replace(/\/$/, "") || '/';

    const handler = findHandler(mockData.handlers, method, cleanRequestedPath);

    if (!handler) {
      return jsonWithCors({
        error: `No route found for ${method} ${requestedPath}`,
        availableRoutes: mockData.handlers.map(h => `${h.method} ${h.path}`)
      }, { status: 404 });
    }

    const forceStatus = request.headers.get('x-mock-status');
    if (forceStatus && handler.errorVariants) {
      const targetStatus = parseInt(forceStatus, 10);
      const variant = handler.errorVariants.find(v => v.statusCode === targetStatus);
      if (variant) return jsonWithCors(variant.fixtureData, { status: targetStatus });
    }

    if (handler.delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, handler.delayMs));
    }

    return jsonWithCors(handler.fixtureData, { status: handler.statusCode || 200 });

  } catch (error) {
    console.error("Redis fetch error:", error);
    return jsonWithCors({ error: "Database connection failed." }, { status: 500 });
  }
}

export async function GET(req, ctx) { return handleMockRequest(req, ctx, 'GET'); }
export async function POST(req, ctx) { return handleMockRequest(req, ctx, 'POST'); }
export async function PUT(req, ctx) { return handleMockRequest(req, ctx, 'PUT'); }
export async function PATCH(req, ctx) { return handleMockRequest(req, ctx, 'PATCH'); }
export async function DELETE(req, ctx) { return handleMockRequest(req, ctx, 'DELETE'); }