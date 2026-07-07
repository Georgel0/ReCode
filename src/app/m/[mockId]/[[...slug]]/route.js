import { createClient } from 'redis';
import { NextResponse } from 'next/server';

async function handleMockRequest(request, { params }, method) {
  const { mockId, slug } = await params;

  const requestedPath = slug ? '/' + slug.join('/') : '/';

  try {
    const redis = createClient({ url: process.env.KV_REDIS_URL });
    await redis.connect();

    const dataString = await redis.get(`mock:${mockId}`);
    await redis.disconnect();

    if (!dataString) {
      return NextResponse.json({ error: "Live mock server not found or has expired." }, { status: 404 });
    }

    const mockData = JSON.parse(dataString);

    if (requestedPath === '/') {
      return NextResponse.json({
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

    const cleanRequestedPath = requestedPath.replace(/\/$/, "");

    const handler = mockData.handlers.find(h => {
      const cleanHandlerPath = h.path.split('?')[0].replace(/\/$/, "");
      return h.method.toUpperCase() === method.toUpperCase() && cleanHandlerPath === cleanRequestedPath;
    });


    if (!handler) {
      return NextResponse.json({
        error: `No route found for ${method} ${requestedPath}`,
        availableRoutes: mockData.handlers.map(h => `${h.method} ${h.path}`)
      }, { status: 404 });
    }

    const forceStatus = request.headers.get('x-mock-status');
    if (forceStatus && handler.errorVariants) {
      const targetStatus = parseInt(forceStatus, 10);
      const variant = handler.errorVariants.find(v => v.statusCode === targetStatus);
      if (variant) return NextResponse.json(variant.fixtureData, { status: targetStatus });
    }

    if (handler.delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, handler.delayMs));
    }

    return NextResponse.json(handler.fixtureData, { status: handler.statusCode || 200 });

  } catch (error) {
    console.error("Redis fetch error:", error);
    return NextResponse.json({ error: "Database connection failed." }, { status: 500 });
  }
}

export async function GET(req, ctx) { return handleMockRequest(req, ctx, 'GET'); }
export async function POST(req, ctx) { return handleMockRequest(req, ctx, 'POST'); }
export async function PUT(req, ctx) { return handleMockRequest(req, ctx, 'PUT'); }
export async function PATCH(req, ctx) { return handleMockRequest(req, ctx, 'PATCH'); }
export async function DELETE(req, ctx) { return handleMockRequest(req, ctx, 'DELETE'); }