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

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function compilePathMatcher(handlerPath) {
  const [rawPath, rawQuery] = (handlerPath || '/').split('?');
  const cleanPath = rawPath.replace(/\/$/, '') || '/';

  const paramNames = [];
  const segments = cleanPath.split(/(:\w+|\{\w+\}|\[\w+\])/);

  let pattern = segments.map(segment => {
    const match = segment.match(/^[:{\[](\w+)[}\]]?$/);
    if (match) {
      paramNames.push(match[1]);
      return '([^/]+)'; // Captures the dynamic value
    }
    return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('');

  const expectedQuery = new URLSearchParams(rawQuery || '');
  const weight = (paramNames.length * -1) + (Array.from(expectedQuery.keys()).length * 2);

  return { regex: new RegExp(`^${pattern}$`), paramNames, expectedQuery, weight };
}

function findHandler(handlers, method, cleanRequestedPath, requestQuery) {
  const matches = handlers
    .filter(h => h.method.toUpperCase() === method.toUpperCase())
    .map(h => ({ handler: h, ...compilePathMatcher(h.path) }))
    .filter(({ regex, expectedQuery }) => {
      if (!regex.test(cleanRequestedPath)) return false;

      for (const [key, val] of expectedQuery.entries()) {
        if (!requestQuery.has(key)) return false;
        if (val && requestQuery.get(key) !== val) return false;
      }
      return true;
    })
    .sort((a, b) => b.weight - a.weight);

  if (matches.length === 0) return null;

  const bestMatch = matches[0];
  const pathMatch = cleanRequestedPath.match(bestMatch.regex);
  const params = {};

  bestMatch.paramNames.forEach((name, i) => {
    params[name] = pathMatch[i + 1];
  });

  return { handler: bestMatch.handler, params };
}

export async function handleMockRequest(request, context, method) {
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 5 * 1024 * 1024) { 
      return jsonWithCors({ error: "Payload too large. Max 2MB allowed." }, { status: 413 });
    }
  }

  const params = await context.params;
  const { mockId, slug } = params;
  
  // Isolate the relative mock path from the global Next.js path
  const requestedPath = slug ? '/' + slug.join('/') : '/';
  const cleanRequestedPath = requestedPath.replace(/\/$/, '') || '/';

  try {
    const redis = await getRedisClient();

    const ip = request.headers.get('x-forwarded-for') || 'anonymous';
    const rateKey = `rate:${mockId}:${ip}`;
    const reqCount = await redis.incr(rateKey);
    if (reqCount === 1) await redis.expire(rateKey, 10); 
    if (reqCount > 50) {
      return jsonWithCors({ error: "Rate limit exceeded. Too many requests to this mock." }, { status: 429 });
    }

    const dataString = await redis.get(`mock:${mockId}`);
    if (!dataString) {
      return jsonWithCors({ error: "Live mock server not found or has expired." }, { status: 404 });
    }

    let mockData;
    try {
      mockData = JSON.parse(dataString);
    } catch (parseError) {
      console.error(`Mock ID ${mockId} corrupted data:`, parseError);
      return jsonWithCors({ error: "Mock engine failed parsing stored configuration.", details: parseError.message }, { status: 500 });
    }

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

    // Pass the isolated path and the query params independently
    const matchResult = findHandler(mockData.handlers, method, cleanRequestedPath, request.nextUrl.searchParams);

    if (!matchResult) {
      return jsonWithCors({
        error: `No route found for ${method} ${cleanRequestedPath}${request.nextUrl.search}`,
        availableRoutes: mockData.handlers.map(h => `${h.method} ${h.path}`)
      }, { status: 404 });
    }

    const { handler, params: pathParams } = matchResult;

    const forceStatus = request.headers.get('x-mock-status');
    const errorRate = mockData.config?.errorRate || 0;
    const delayMs = handler.delayMs ?? (mockData.config?.delayMs || 0);

    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    let responseStatus = handler.statusCode || 200;
    let responseData = handler.fixtureData;

    if (forceStatus && handler.errorVariants) {
      const targetStatus = parseInt(forceStatus, 10);
      const variant = handler.errorVariants.find(v => v.statusCode === targetStatus);
      if (variant) {
        responseStatus = variant.statusCode;
        responseData = variant.fixtureData;
      }
    } else if (errorRate > 0 && handler.errorVariants && handler.errorVariants.length > 0) {
      const roll = Math.random() * 100;
      if (roll < errorRate) {
        const randomVariant = handler.errorVariants[Math.floor(Math.random() * handler.errorVariants.length)];
        responseStatus = randomVariant.statusCode;
        responseData = randomVariant.fixtureData;
      }
    }

    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      try {
        const bodyText = await request.text(); 
        if (bodyText && responseStatus >= 200 && responseStatus < 300) {
          const bodyJson = JSON.parse(bodyText);
          if (typeof responseData === 'object' && responseData !== null && !Array.isArray(responseData)) {
            responseData = { ...responseData, ...bodyJson };
          }
        }
      } catch (e) {
      }
    }

    if (typeof responseData === 'object' && responseData !== null && !Array.isArray(responseData)) {
      for (const [key, value] of Object.entries(pathParams)) {
        if (key in responseData) {
          responseData[key] = isNaN(value) ? value : Number(value);
        }
      }
    }

    return jsonWithCors(responseData, { status: responseStatus });

  } catch (error) {
    console.error("Redis fetch error:", error);
    return jsonWithCors({ error: "Database connection failed or transaction timed out." }, { status: 500 });
  }
}

export async function GET(req, ctx) { return handleMockRequest(req, ctx, 'GET'); }
export async function POST(req, ctx) { return handleMockRequest(req, ctx, 'POST'); }
export async function PUT(req, ctx) { return handleMockRequest(req, ctx, 'PUT'); }
export async function PATCH(req, ctx) { return handleMockRequest(req, ctx, 'PATCH'); }
export async function DELETE(req, ctx) { return handleMockRequest(req, ctx, 'DELETE'); }