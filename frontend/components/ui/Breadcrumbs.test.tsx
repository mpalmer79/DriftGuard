import { describe, expect, it, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { Breadcrumbs } from "./Breadcrumbs";

afterEach(() => cleanup());

describe("Breadcrumbs", () => {
  it("renders nothing when the trail is empty", () => {
    const { container } = render(<Breadcrumbs trail={[]} />);
    expect(container.querySelector("nav")).toBeNull();
  });

  it("links non-final items with hrefs, plain-texts items without hrefs, and locks the last item", () => {
    render(
      <Breadcrumbs
        trail={[
          { label: "Scenarios", href: "/scenarios" },
          { label: "Sensor Drift" },
          { label: "Run 7" },
        ]}
      />
    );

    // First crumb has an href → rendered as a real <a>.
    const first = screen.getByRole("link", { name: "Scenarios" });
    expect(first.getAttribute("href")).toBe("/scenarios");

    // Second crumb is intermediate but href-less → plain text.
    expect(screen.getByText("Sensor Drift")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Sensor Drift" })).toBeNull();

    // Last crumb is never a link and is marked aria-current="page".
    const last = screen.getByText("Run 7");
    expect(last.getAttribute("aria-current")).toBe("page");
    expect(screen.queryByRole("link", { name: "Run 7" })).toBeNull();
  });

  it("renders one separator per gap (n-1 separators for n crumbs)", () => {
    render(
      <Breadcrumbs
        trail={[{ label: "A", href: "/a" }, { label: "B", href: "/b" }, { label: "C" }]}
      />
    );
    const nav = screen.getByLabelText(/breadcrumb/i);
    // Separators are aria-hidden spans containing ">". A 3-crumb trail has 2.
    const seps = nav.querySelectorAll('[aria-hidden="true"]');
    expect(seps.length).toBe(2);
  });
});
