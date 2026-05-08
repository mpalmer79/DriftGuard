// We don't assert on full className strings — `data-empty-kind` is
// the intentional public hook for variant routing.
//
// The current call sites we're protecting from regressions:
//   - frontend/app/simulations/[id]/{page,report,live}/page.tsx
//   - frontend/app/simulations/[id]/{live,replay}/page.tsx
//   - frontend/components/{CausalityPanel,DecisionPipeline}.tsx

import { describe, expect, it, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { EmptyState, ErrorState } from "./EmptyState";

afterEach(() => cleanup());

describe("EmptyState", () => {
  it("renders the title and defaults to the no-data variant", () => {
    render(<EmptyState title="// AWAITING DATA" hint="Run a scenario to populate this view." />);
    expect(screen.getByText("// AWAITING DATA")).toBeTruthy();
    expect(screen.getByText("Run a scenario to populate this view.")).toBeTruthy();
    const root = screen.getByRole("status");
    expect(root.getAttribute("data-empty-kind")).toBe("no-data");
  });

  it("routes each kind to its data-empty-kind attribute", () => {
    const { rerender } = render(<EmptyState title="t" kind="not-started" />);
    expect(screen.getByRole("status").getAttribute("data-empty-kind")).toBe("not-started");
    rerender(<EmptyState title="t" kind="completed" />);
    expect(screen.getByRole("status").getAttribute("data-empty-kind")).toBe("completed");
    rerender(<EmptyState title="t" kind="error" />);
    expect(screen.getByRole("status").getAttribute("data-empty-kind")).toBe("error");
  });

  it("supports the legacy `description` prop alongside `hint`", () => {
    render(
      <EmptyState title="t" description="Backend unreachable — check network or backend health." />
    );
    expect(screen.getByText("Backend unreachable — check network or backend health.")).toBeTruthy();
  });

  it("renders descriptor-form action as an internal link", () => {
    render(<EmptyState title="t" action={{ label: "Browse scenarios", href: "/scenarios" }} />);
    const link = screen.getByRole("link", { name: /browse scenarios/i });
    expect(link.getAttribute("href")).toBe("/scenarios");
  });

  it("preserves legacy ReactNode-form action so existing call sites still work", () => {
    render(<EmptyState title="t" action={<span data-testid="legacy">legacy action</span>} />);
    expect(screen.getByText("legacy action")).toBeTruthy();
  });

  it("renders the severity bullet only when `severe` is set", () => {
    const { rerender } = render(<EmptyState title="t" kind="not-started" />);
    expect(screen.queryByTestId("empty-state-bullet")).toBeNull();
    rerender(<EmptyState title="t" kind="not-started" severe />);
    expect(screen.getByTestId("empty-state-bullet")).toBeTruthy();
  });
});

describe("ErrorState (named export)", () => {
  it("renders the message and an optional retry button", async () => {
    let clicked = 0;
    render(
      <ErrorState
        message="Backend unreachable — check network or backend health."
        retry={() => {
          clicked += 1;
        }}
      />
    );
    expect(screen.getByText("Backend unreachable — check network or backend health.")).toBeTruthy();
    const retry = screen.getByRole("button", { name: /retry/i });
    await userEvent.click(retry);
    expect(clicked).toBe(1);
  });

  it("omits the retry button when no retry handler is provided", () => {
    render(<ErrorState message="Backend unreachable." />);
    expect(screen.queryByRole("button", { name: /retry/i })).toBeNull();
  });
});
