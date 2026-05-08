import { expect, test } from "@playwright/test";

test.describe("public surface smoke", () => {
  test("landing page renders and links to dashboard", async ({ page }) => {
    await page.goto("/");
    // Match the H1 landmark, not the doc title, so a copy tweak doesn't
    // break the test.
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const dashLink = page.getByRole("link", { name: /dashboard/i }).first();
    await expect(dashLink).toBeVisible();
  });

  test("dashboard route renders without runtime errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(errors, `runtime errors during /dashboard load: ${errors.join("; ")}`).toEqual([]);
  });
});
