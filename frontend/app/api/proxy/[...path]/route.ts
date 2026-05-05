// Frontend auth proxy (Phase 6.3).
//
// Mutating API calls are routed through this Next.js route handler
// instead of going directly to the FastAPI backend from the browser.
// The handler runs server-side, so it can read the *non-public*
// `SENTINEL_API_TOKEN` and inject `Authorization: Bearer <token>`
// without exposing the token to the client.
//
// Read traffic still goes direct (`NEXT_PUBLIC_API_BASE`) — reads
// don't need the token under the Phase 8.3 policy and bouncing them
// through the proxy would just add a hop.
//
// Method allow-list: POST, PUT, PATCH, DELETE. GET / HEAD return 405
// to avoid an open relay.

import { NextRequest, NextResponse } from "next/server";

const BACKEND =
  process.env.SENTINEL_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

const ALLOWED_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

async function forward(req: NextRequest, path: string[]): Promise<NextResponse> {
  if (!ALLOWED_METHODS.has(req.method)) {
    return new NextResponse(
      JSON.stringify({
        error: { code: "method_not_allowed", message: `${req.method} not proxied` },
      }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );
  }

  const target = `${BACKEND.replace(/\/$/, "")}/${path.join("/")}${req.nextUrl.search}`;
  const headers = new Headers();
  // Forward the content type the client sent so YAML scenario uploads
  // (Phase 5.3) reach the backend with `text/yaml`.
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  const token = process.env.SENTINEL_API_TOKEN;
  if (token) headers.set("authorization", `Bearer ${token}`);

  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.text();

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body,
      cache: "no-store",
    });
  } catch (err) {
    return new NextResponse(
      JSON.stringify({
        error: {
          code: "backend_unreachable",
          message: `proxy could not reach backend: ${(err as Error).message}`,
        },
      }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  // Pass the upstream body and content-type through unchanged so the
  // client sees the exact 4xx envelope the backend produced.
  const upstreamBody = await upstream.text();
  const responseHeaders = new Headers();
  const upstreamCT = upstream.headers.get("content-type");
  if (upstreamCT) responseHeaders.set("content-type", upstreamCT);
  return new NextResponse(upstreamBody, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return forward(req, path);
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return forward(req, path);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return forward(req, path);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return forward(req, path);
}
