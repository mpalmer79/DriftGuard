// Note: jsdom has no WebGL. We test prop wiring + the WebGL-unavailable fallback,
// not the rendered three.js scene.

import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import TriplexHero3D from "./TriplexHero3D";
import type {
  TriplexControllerHealth,
  TriplexFaultInjected,
} from "./TriplexHero3D";

// jsdom shouts "Not implemented: HTMLCanvasElement.prototype.getContext"
// every time we feature-detect WebGL. Stub it to return null (a valid
// "WebGL unavailable" answer) so the test log stays readable.
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});

const baseControllers: TriplexControllerHealth[] = [
  {
    id: "controller_a",
    trust: 0.9,
    status: "HEALTHY",
    isTrusted: true,
    isRejected: false,
  },
  {
    id: "controller_b",
    trust: 0.1,
    status: "CRITICAL",
    isTrusted: false,
    isRejected: true,
  },
  {
    id: "controller_c",
    trust: 0.8,
    status: "HEALTHY",
    isTrusted: true,
    isRejected: false,
  },
];

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("TriplexHero3D", () => {
  it("renders the WebGL-unavailable fallback img when WebGL isn't present", () => {
    render(
      <TriplexHero3D
        controllers={baseControllers}
        systemMode="SAFE_MODE"
        modeJustChanged={null}
        faultsJustInjected={[]}
        prefersReducedMotion={false}
      />,
    );
    const fallback = screen.getByRole("img", {
      name: /3D unavailable in this browser/i,
    }) as HTMLImageElement;
    expect(fallback).toBeTruthy();
    expect(fallback.getAttribute("src")).toBe("/og.png");
  });

  it("renders the screen-reader summary text reflecting systemMode and trusted/rejected controllers", () => {
    const { container } = render(
      <TriplexHero3D
        controllers={baseControllers}
        systemMode="SAFE_MODE"
        modeJustChanged={null}
        faultsJustInjected={[]}
        prefersReducedMotion={false}
      />,
    );
    const sr = container.querySelector(".sr-only");
    expect(sr).toBeTruthy();
    const text = sr?.textContent ?? "";
    expect(text).toMatch(/System mode SAFE_MODE/);
    expect(text).toMatch(/Controller A trusted/);
    expect(text).toMatch(/Controller B rejected/);
    expect(text).toMatch(/Controller C trusted/);
  });

  it("wraps content in a div with aria-label='Triplex controller visualization'", () => {
    render(
      <TriplexHero3D
        controllers={baseControllers}
        systemMode="NORMAL"
        modeJustChanged={null}
        faultsJustInjected={[]}
        prefersReducedMotion={false}
      />,
    );
    const wrapper = screen.getByLabelText("Triplex controller visualization");
    expect(wrapper).toBeTruthy();
    expect(wrapper.tagName).toBe("DIV");
  });

  it("updates the screen-reader summary when controllers prop changes", () => {
    const { container, rerender } = render(
      <TriplexHero3D
        controllers={baseControllers}
        systemMode="NORMAL"
        modeJustChanged={null}
        faultsJustInjected={[]}
        prefersReducedMotion={false}
      />,
    );
    const before = container.querySelector(".sr-only")?.textContent ?? "";
    expect(before).toMatch(/System mode NORMAL/);
    expect(before).toMatch(/Controller B rejected/);

    const updated: TriplexControllerHealth[] = baseControllers.map((c) =>
      c.id === "controller_b"
        ? { ...c, isRejected: false, isTrusted: true, status: "RECOVERING" }
        : c,
    );
    rerender(
      <TriplexHero3D
        controllers={updated}
        systemMode="DEGRADED"
        modeJustChanged={null}
        faultsJustInjected={[]}
        prefersReducedMotion={false}
      />,
    );
    const after = container.querySelector(".sr-only")?.textContent ?? "";
    expect(after).toMatch(/System mode DEGRADED/);
    expect(after).toMatch(/Controller B trusted/);
  });

  it("renders the fallback caption mentioning '3D scene unavailable in this browser'", () => {
    render(
      <TriplexHero3D
        controllers={baseControllers}
        systemMode="NORMAL"
        modeJustChanged={null}
        faultsJustInjected={[]}
        prefersReducedMotion={false}
      />,
    );
    expect(screen.getByText(/3D scene unavailable in this browser/i)).toBeTruthy();
  });

  it("renders without crashing when prefersReducedMotion is true", () => {
    const { container } = render(
      <TriplexHero3D
        controllers={baseControllers}
        systemMode="NORMAL"
        modeJustChanged={null}
        faultsJustInjected={[]}
        prefersReducedMotion={true}
      />,
    );
    expect(container.querySelector('[aria-label="Triplex controller visualization"]')).toBeTruthy();
  });

  it("applies the supplied className alongside the aspect-ratio wrapper class", () => {
    render(
      <TriplexHero3D
        controllers={baseControllers}
        systemMode="NORMAL"
        modeJustChanged={null}
        faultsJustInjected={[]}
        prefersReducedMotion={false}
        className="my-custom-hero"
      />,
    );
    const wrapper = screen.getByLabelText("Triplex controller visualization");
    expect(wrapper.className).toMatch(/aspect-\[16\/7\]/);
    expect(wrapper.className).toMatch(/my-custom-hero/);
  });

  it("uses the controller status word in the summary when a controller is neither trusted nor rejected", () => {
    const mixed: TriplexControllerHealth[] = [
      {
        id: "controller_a",
        trust: 0.5,
        status: "SUSPECT",
        isTrusted: false,
        isRejected: false,
      },
      ...baseControllers.slice(1),
    ];
    const { container } = render(
      <TriplexHero3D
        controllers={mixed}
        systemMode="DEGRADED"
        modeJustChanged={null}
        faultsJustInjected={[]}
        prefersReducedMotion={false}
      />,
    );
    const text = container.querySelector(".sr-only")?.textContent ?? "";
    expect(text).toMatch(/Controller A suspect/);
  });

  it("accepts a faultsJustInjected list without crashing", () => {
    const faults: TriplexFaultInjected[] = [
      {
        id: "fault-1",
        target: "controller_b",
        description: "controller latency spike",
        startedAtStep: 7,
      },
    ];
    const { container } = render(
      <TriplexHero3D
        controllers={baseControllers}
        systemMode="DEGRADED"
        modeJustChanged={null}
        faultsJustInjected={faults}
        prefersReducedMotion={false}
      />,
    );
    expect(container.querySelector('[aria-label="Triplex controller visualization"]')).toBeTruthy();
  });

  it("accepts a modeJustChanged transition without crashing", () => {
    const { container } = render(
      <TriplexHero3D
        controllers={baseControllers}
        systemMode="SAFE_MODE"
        modeJustChanged={{ from: "DEGRADED", to: "SAFE_MODE" }}
        faultsJustInjected={[]}
        prefersReducedMotion={false}
      />,
    );
    expect(container.querySelector('[aria-label="Triplex controller visualization"]')).toBeTruthy();
  });

  it("renders the screen-reader summary ahead of the fallback image so AT users get a state sentence first", () => {
    const { container } = render(
      <TriplexHero3D
        controllers={baseControllers}
        systemMode="FAILED"
        modeJustChanged={null}
        faultsJustInjected={[]}
        prefersReducedMotion={false}
      />,
    );
    const sr = container.querySelector(".sr-only");
    const img = container.querySelector("img");
    expect(sr).toBeTruthy();
    expect(img).toBeTruthy();
    // sr should appear before img in document order.
    expect(
      sr && img && sr.compareDocumentPosition(img) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  // jsdom cannot mount a real WebGL context. Even spying on
  // HTMLCanvasElement.prototype.getContext to return a stub is not
  // enough — react-three-fiber pulls in three.js features (rAF loop,
  // resize observers, device pixel queries) that crash without a real
  // GPU. Document the limitation rather than smuggle through a flaky
  // test.
  it.skip("mounts a Canvas tag when WebGL is forced available (skipped: not feasible in jsdom)", () => {
    /* intentionally blank */
  });
});
