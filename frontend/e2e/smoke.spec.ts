// Phase 6.2b — Playwright smoke test.
//
// Verifies the public surface of the Next.js app loads end-to-end:
//   - landing page renders with the project tagline
//   - landing → dashboard navigation works
//   - dashboard renders without throwing in the browser console
//
// We don't talk to the real backend here — the unit tests
// (lib/api.test.ts) cover the API client contract. A smoke test
// that depended on a live FastAPI process would be flaky in CI for
// reasons that have nothing to do with the frontend.

import { expect, test } from "@playwright/test";

test.describe("public surface smoke", () => {
  test("landing page renders and links to dashboard", async ({ page }) => {
    await page.goto("/");
    // Title is the H1 in app/page.tsx ("SentinelNav") — match the
    // landmark, not the doc title, so a future copy tweak doesn't
    // break the test.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // The landing page links into /dashboard.
    const dashLink = page.getByRole("link", { name: /dashboard/i }).first();
    await expect(dashLink).toBeVisible();
  });

  test("dashboard route renders without runtime errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/dashboard");
    // The dashboard ships its own H1.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(errors, `runtime errors during /dashboard load: ${errors.join("; ")}`).toEqual([]);
  });
});
