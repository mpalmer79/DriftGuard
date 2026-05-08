// ModeLegend — verifies all four safety modes are rendered with the
// expected operator-friendly explanation strings. Title attributes
// mirror the visible explanation so screen-reader / hover users see
// the same text.

import { describe, expect, it, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { ModeLegend } from "./ModeLegend";

afterEach(() => cleanup());

describe("ModeLegend", () => {
  it("renders all four safety modes", () => {
    render(<ModeLegend />);
    expect(screen.getByText("NORMAL")).toBeTruthy();
    expect(screen.getByText("DEGRADED")).toBeTruthy();
    expect(screen.getByText("SAFE_MODE")).toBeTruthy();
    expect(screen.getByText("FAILED")).toBeTruthy();
  });

  it("includes operator-friendly explanations for each mode", () => {
    render(<ModeLegend />);
    expect(screen.getByText(/All components healthy/i)).toBeTruthy();
    expect(screen.getByText(/Component unhealthy/i)).toBeTruthy();
    expect(screen.getByText(/Insufficient consensus or invalid sensor/i)).toBeTruthy();
    expect(screen.getByText(/Multiple critical failures/i)).toBeTruthy();
  });

  it("exposes the legend as a labelled section", () => {
    render(<ModeLegend />);
    const section = screen.getByLabelText(/safety mode legend/i);
    expect(section).toBeTruthy();
  });
});
