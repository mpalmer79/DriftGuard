// Skeleton — typed pulse loader.
//
// Coverage:
//   * default (no `kind`) renders with role/aria-busy and respects
//     explicit width / height props (legacy API).
//   * `kind` variants surface via the `data-skeleton-kind` attribute
//     and apply opinionated default dimensions when not overridden.
//   * caller-provided width / height override the variant defaults
//     (this protects existing simulations/[id]/{page,report}/page.tsx
//     call sites which pass explicit dimensions).

import { describe, expect, it, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { Skeleton } from "./Skeleton";

afterEach(() => cleanup());

describe("Skeleton", () => {
  it("renders with role=status and aria-busy and respects explicit dimensions (legacy API)", () => {
    render(<Skeleton width="40%" height="2rem" />);
    const node = screen.getByRole("status");
    expect(node.getAttribute("aria-busy")).toBe("true");
    expect(node.getAttribute("data-skeleton-kind")).toBe("default");
    expect((node as HTMLElement).style.width).toBe("40%");
    expect((node as HTMLElement).style.height).toBe("2rem");
  });

  it("routes each kind to its data-skeleton-kind attribute", () => {
    const { rerender } = render(<Skeleton kind="text-line" />);
    expect(screen.getByRole("status").getAttribute("data-skeleton-kind")).toBe("text-line");
    rerender(<Skeleton kind="card" />);
    expect(screen.getByRole("status").getAttribute("data-skeleton-kind")).toBe("card");
    rerender(<Skeleton kind="row" />);
    expect(screen.getByRole("status").getAttribute("data-skeleton-kind")).toBe("row");
  });

  it("lets caller-provided width / height override variant defaults", () => {
    render(<Skeleton kind="card" width="123px" height="45px" />);
    const node = screen.getByRole("status") as HTMLElement;
    expect(node.style.width).toBe("123px");
    expect(node.style.height).toBe("45px");
  });
});
