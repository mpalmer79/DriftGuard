// Server-side auth proxy (Phase 6.3). Mutating calls land here so the
// non-public SENTINEL_API_TOKEN can be injected without leaking to the
// client. Reads stay direct under the Phase 8.3 policy.

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
  // Preserve content-type so YAML scenario uploads reach the FastAPI
  // parse_yaml branch (Phase 5.3).
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

  // Pass body + content-type through so the client sees the backend's
  // exact 4xx envelope.
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
