// HeaderNav — verifies the active-link rule (`isActive`) and the
// rendered set of links. We exercise `isActive` directly so we don't
// have to install a full Next router context inside the test
// environment; that helper drives every link's aria-current state.

import { describe, expect, it, afterEach, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { isActive } from "./HeaderNav";

afterEach(() => {
  cleanup();
  vi.resetModules();
});

describe("isActive", () => {
  it("matches exact paths and child paths by default", () => {
    expect(isActive("/scenarios", "/scenarios")).toBe(true);
    expect(isActive("/scenarios/sensor-drift", "/scenarios")).toBe(true);
    expect(isActive("/dashboard", "/scenarios")).toBe(false);
  });

  it("respects the `exact` flag and tolerates a null pathname", () => {
    expect(isActive("/", "/", true)).toBe(true);
    expect(isActive("/dashboard", "/", true)).toBe(false);
    expect(isActive(null, "/dashboard")).toBe(false);
  });
});

describe("HeaderNav", () => {
  it("renders the brand link, Dashboard, and Scenarios entries with the active route marked", async () => {
    vi.doMock("next/navigation", () => ({
      usePathname: () => "/dashboard",
    }));
    // Re-import after mocking so the component picks up the stub.
    const { HeaderNav: NavWithMock } = await import("./HeaderNav");

    render(<NavWithMock />);

    const brand = screen.getByRole("link", { name: /driftguard/i });
    expect(brand.getAttribute("href")).toBe("/");

    const dashboard = screen.getByRole("link", { name: /dashboard/i });
    expect(dashboard.getAttribute("href")).toBe("/dashboard");
    expect(dashboard.getAttribute("aria-current")).toBe("page");

    const scenarios = screen.getByRole("link", { name: /scenarios/i });
    expect(scenarios.getAttribute("href")).toBe("/scenarios");
    expect(scenarios.getAttribute("aria-current")).toBeNull();

    vi.doUnmock("next/navigation");
  });
});
