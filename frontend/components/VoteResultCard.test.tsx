import { describe, expect, it, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { VoteResultCard } from "./VoteResultCard";
import type { VoteResult } from "@/types/api";

afterEach(() => cleanup());

describe("VoteResultCard", () => {
  it("renders an empty state when vote is null", () => {
    render(<VoteResultCard vote={null} />);
    expect(screen.getByText(/No vote recorded/i)).toBeTruthy();
  });

  it("renders consensus rationale and selected action", () => {
    const vote: VoteResult = {
      outcome: "CONSENSUS",
      selected_action: "MAINTAIN",
      agreeing_controllers: ["controller_a", "controller_b", "controller_c"],
      rejected_controllers: [],
      reason: "all agreed",
    };
    render(<VoteResultCard vote={vote} />);
    expect(screen.getByText("CONSENSUS")).toBeTruthy();
    expect(screen.getByText("→ MAINTAIN")).toBeTruthy();
    expect(screen.getByText(/Majority consensus: MAINTAIN/i)).toBeTruthy();
    expect(screen.getByText("controller_a")).toBeTruthy();
    expect(screen.getByText("controller_b")).toBeTruthy();
  });

  it("renders SPLIT rationale and shows rejected controllers", () => {
    const vote: VoteResult = {
      outcome: "SPLIT",
      selected_action: "DECELERATE",
      agreeing_controllers: ["controller_a"],
      rejected_controllers: ["controller_b", "controller_c"],
      reason: "disagree",
    };
    render(<VoteResultCard vote={vote} />);
    expect(screen.getByText("SPLIT")).toBeTruthy();
    expect(screen.getByText(/No consensus — controllers disagree/i)).toBeTruthy();
    expect(screen.getByText("controller_b")).toBeTruthy();
    expect(screen.getByText("controller_c")).toBeTruthy();
  });
});
