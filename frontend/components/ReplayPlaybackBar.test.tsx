import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ReplayPlaybackBar } from "./ReplayPlaybackBar";
import type { ReplayClockHandle } from "@/lib/hooks/useReplayClock";
import type { SystemMode } from "@/types/api";

afterEach(() => cleanup());

function makeClock(overrides?: Partial<ReplayClockHandle>): ReplayClockHandle {
  const base: ReplayClockHandle = {
    currentStep: 0,
    isPlaying: false,
    speedMultiplier: 1,
    isComplete: false,
    play: vi.fn(),
    pause: vi.fn(),
    toggle: vi.fn(),
    stepForward: vi.fn(),
    stepBackward: vi.fn(),
    jumpTo: vi.fn(),
    setSpeed: vi.fn(),
    reset: vi.fn(),
  };
  return { ...base, ...overrides };
}

const allNormal = (): SystemMode | null => "NORMAL";

describe("ReplayPlaybackBar", () => {
  it("renders STEP 1 / 25 when currentStep=0 and totalSteps=25", () => {
    const clock = makeClock({ currentStep: 0 });
    render(<ReplayPlaybackBar clock={clock} totalSteps={25} modeAtStep={allNormal} />);
    expect(screen.getByTestId("replay-step-counter").textContent).toContain("STEP 1 / 25");
  });

  it("renders STEP 13 / 25 when currentStep=12 and totalSteps=25", () => {
    const clock = makeClock({ currentStep: 12 });
    render(<ReplayPlaybackBar clock={clock} totalSteps={25} modeAtStep={allNormal} />);
    expect(screen.getByTestId("replay-step-counter").textContent).toContain("STEP 13 / 25");
  });

  it("renders STEP 0 / 0 and disables play/forward/back when totalSteps=0", () => {
    const clock = makeClock({ currentStep: 0 });
    render(<ReplayPlaybackBar clock={clock} totalSteps={0} modeAtStep={allNormal} />);
    expect(screen.getByTestId("replay-step-counter").textContent).toContain("STEP 0 / 0");

    const playBtn = screen.getByRole("button", { name: /play replay/i }) as HTMLButtonElement;
    const fwdBtn = screen.getByRole("button", { name: /step forward/i }) as HTMLButtonElement;
    const backBtn = screen.getByRole("button", { name: /step backward/i }) as HTMLButtonElement;

    expect(playBtn.disabled).toBe(true);
    expect(fwdBtn.disabled).toBe(true);
    expect(backBtn.disabled).toBe(true);

    expect(screen.getByTestId("replay-scrubber-empty")).toBeTruthy();
    expect(screen.queryByTestId("replay-scrubber")).toBeNull();
  });

  it("clicking the play button calls clock.toggle() once", async () => {
    const user = userEvent.setup();
    const clock = makeClock();
    render(<ReplayPlaybackBar clock={clock} totalSteps={10} modeAtStep={allNormal} />);
    await user.click(screen.getByRole("button", { name: /play replay/i }));
    expect(clock.toggle).toHaveBeenCalledTimes(1);
  });

  it("clicking step-forward calls stepForward; clicking step-backward calls stepBackward", async () => {
    const user = userEvent.setup();
    const clock = makeClock({ currentStep: 5 });
    render(<ReplayPlaybackBar clock={clock} totalSteps={10} modeAtStep={allNormal} />);
    await user.click(screen.getByRole("button", { name: /step forward/i }));
    expect(clock.stepForward).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /step backward/i }));
    expect(clock.stepBackward).toHaveBeenCalledTimes(1);
  });

  it("pressing Space on the focused root calls clock.toggle() once", () => {
    const clock = makeClock();
    render(<ReplayPlaybackBar clock={clock} totalSteps={10} modeAtStep={allNormal} />);
    const root = screen.getByTestId("replay-playback-bar");
    fireEvent.keyDown(root, { key: " " });
    expect(clock.toggle).toHaveBeenCalledTimes(1);
  });

  it("pressing ArrowRight calls stepForward; ArrowLeft calls stepBackward", () => {
    const clock = makeClock({ currentStep: 3 });
    render(<ReplayPlaybackBar clock={clock} totalSteps={10} modeAtStep={allNormal} />);
    const root = screen.getByTestId("replay-playback-bar");
    fireEvent.keyDown(root, { key: "ArrowRight" });
    expect(clock.stepForward).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(root, { key: "ArrowLeft" });
    expect(clock.stepBackward).toHaveBeenCalledTimes(1);
  });

  it("pressing 3 calls setSpeed(2); 1 calls setSpeed(0.5); 4 calls setSpeed(4)", () => {
    const clock = makeClock();
    render(<ReplayPlaybackBar clock={clock} totalSteps={10} modeAtStep={allNormal} />);
    const root = screen.getByTestId("replay-playback-bar");

    fireEvent.keyDown(root, { key: "3" });
    expect(clock.setSpeed).toHaveBeenLastCalledWith(2);

    fireEvent.keyDown(root, { key: "1" });
    expect(clock.setSpeed).toHaveBeenLastCalledWith(0.5);

    fireEvent.keyDown(root, { key: "4" });
    expect(clock.setSpeed).toHaveBeenLastCalledWith(4);
  });

  it("clicking the 2× pill calls setSpeed(2); active pill reflects clock.speedMultiplier", async () => {
    const user = userEvent.setup();
    const clock = makeClock({ speedMultiplier: 2 });
    render(<ReplayPlaybackBar clock={clock} totalSteps={10} modeAtStep={allNormal} />);

    const twoX = screen.getByRole("button", { name: /set speed to 2×/i });
    await user.click(twoX);
    expect(clock.setSpeed).toHaveBeenCalledWith(2);

    expect(twoX.getAttribute("aria-pressed")).toBe("true");
    const oneX = screen.getByRole("button", { name: /set speed to 1×/i });
    expect(oneX.getAttribute("aria-pressed")).toBe("false");
  });

  it("clicking a scrubber segment for step 5 calls clock.jumpTo(5)", async () => {
    const user = userEvent.setup();
    const clock = makeClock();
    render(<ReplayPlaybackBar clock={clock} totalSteps={10} modeAtStep={allNormal} />);

    const segment = screen.getByRole("button", { name: /jump to step 5/i });
    await user.click(segment);
    expect(clock.jumpTo).toHaveBeenCalledWith(5);
  });

  it("renders an AT END indicator only when clock.isComplete is true", () => {
    const incompleteClock = makeClock({ isComplete: false });
    const { rerender } = render(
      <ReplayPlaybackBar clock={incompleteClock} totalSteps={10} modeAtStep={allNormal} />
    );
    expect(screen.queryByTestId("replay-at-end-badge")).toBeNull();

    const completeClock = makeClock({
      isComplete: true,
      currentStep: 9,
    });
    rerender(<ReplayPlaybackBar clock={completeClock} totalSteps={10} modeAtStep={allNormal} />);
    expect(screen.getByTestId("replay-at-end-badge")).toBeTruthy();
    expect(screen.getByText(/AT END/i)).toBeTruthy();
  });

  it("exposes accessible names for all interactive elements", () => {
    const clock = makeClock();
    render(<ReplayPlaybackBar clock={clock} totalSteps={6} modeAtStep={allNormal} />);

    expect(screen.getByRole("group", { name: /replay playback controls/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /play replay/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /step forward/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /step backward/i })).toBeTruthy();
    expect(screen.getByRole("group", { name: /step scrubber/i })).toBeTruthy();
    expect(screen.getByRole("group", { name: /playback speed/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /set speed to 0\.5×/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /set speed to 1×/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /set speed to 2×/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /set speed to 4×/i })).toBeTruthy();
  });

  it("play button accessible name is Pause replay when isPlaying, Play replay otherwise", () => {
    const playingClock = makeClock({ isPlaying: true });
    const { rerender } = render(
      <ReplayPlaybackBar clock={playingClock} totalSteps={10} modeAtStep={allNormal} />
    );
    expect(screen.getByRole("button", { name: /pause replay/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^play replay$/i })).toBeNull();

    const pausedClock = makeClock({ isPlaying: false });
    rerender(<ReplayPlaybackBar clock={pausedClock} totalSteps={10} modeAtStep={allNormal} />);
    expect(screen.getByRole("button", { name: /play replay/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /pause replay/i })).toBeNull();
  });
});
