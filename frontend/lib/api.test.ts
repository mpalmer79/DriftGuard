// Phase 6.2a — first vitest test surface for the frontend.
//
// Covers the three error contracts the API client must honour:
//   1. happy path returns the decoded JSON body
//   2. 4xx with `{error: {code, message}}` envelope (Phase 8.6) →
//      ApiError with `body.error.message` as the user-facing string
//   3. 4xx with `{detail: ...}` (FastAPI validation default) →
//      ApiError with the detail string
//   4. network error → ApiError with status=0 and the underlying
//      message wrapped
//
// Stubs `globalThis.fetch` via `vi.stubGlobal` — simpler than MSW
// for a single helper, and keeps the dev-dep footprint tight.

import { afterEach, describe, expect, it, vi } from "vitest";

import { api } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(impl: typeof fetch): void {
  vi.stubGlobal("fetch", impl);
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(body === null ? "" : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("api client error contract", () => {
  it("returns the decoded body on a 2xx", async () => {
    stubFetch(async () => jsonResponse(200, { status: "ok" }));
    const result = await api.health();
    expect(result).toEqual({ status: "ok" });
  });

  it("throws ApiError with `error.message` on a 4xx error envelope", async () => {
    stubFetch(async () =>
      jsonResponse(401, {
        error: { code: "unauthorized", message: "missing or malformed Authorization header" },
      })
    );

    await expect(api.createSimulation(1)).rejects.toMatchObject({
      status: 401,
      message: "missing or malformed Authorization header",
    });
  });

  it("throws ApiError with `detail` on a FastAPI validation 422", async () => {
    stubFetch(async () =>
      jsonResponse(422, {
        detail: [{ loc: ["body", "seed"], msg: "value is not a valid integer" }],
      })
    );

    await expect(api.createSimulation()).rejects.toMatchObject({
      status: 422,
    });
  });

  it("falls back to a generic message when neither envelope is present", async () => {
    stubFetch(async () => jsonResponse(500, { something: "else" }));

    await expect(api.health()).rejects.toMatchObject({
      status: 500,
      message: "request failed with status 500",
    });
  });

  it("wraps network failures as ApiError with status=0", async () => {
    stubFetch(async () => {
      throw new TypeError("Failed to fetch");
    });

    await expect(api.health()).rejects.toMatchObject({
      status: 0,
      message: expect.stringContaining("cannot reach SentinelNav backend"),
    });
  });
});

describe("api client routing (Phase 6.3 auth proxy)", () => {
  it("routes write calls through /api/proxy", async () => {
    const calls: string[] = [];
    stubFetch(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      calls.push(url);
      return jsonResponse(201, { simulation_id: "sim-x", seed: 1 });
    });

    await api.createSimulation(1);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toBe("/api/proxy/simulations");
  });

  it("routes read calls direct to NEXT_PUBLIC_API_BASE", async () => {
    const calls: string[] = [];
    stubFetch(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      calls.push(url);
      return jsonResponse(200, []);
    });

    await api.listScenarios();

    expect(calls).toHaveLength(1);
    expect(calls[0]).not.toMatch(/^\/api\/proxy/);
    expect(calls[0]).toMatch(/\/scenarios$/);
  });

  it("routes YAML scenario uploads through the proxy too", async () => {
    const calls: string[] = [];
    stubFetch(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      calls.push(url);
      return jsonResponse(201, { name: "demo" });
    });

    await api.createScenario("name: demo\nseed: 1\n");

    expect(calls).toHaveLength(1);
    expect(calls[0]).toBe("/api/proxy/scenarios");
  });
});
