import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import { useReplayClock } from "./useReplayClock";

afterEach(() => {
  vi.useRealTimers();
});

describe("useReplayClock", () => {
  it("I-RC-1: clamps currentStep within [0, totalSteps - 1] across jumpTo overflow / underflow", () => {
    const { result } = renderHook(() => useReplayClock({ totalSteps: 5 }));

    act(() => result.current.jumpTo(99));
    expect(result.current.currentStep).toBe(4);

    act(() => result.current.jumpTo(-10));
    expect(result.current.currentStep).toBe(0);

    act(() => result.current.jumpTo(2));
    expect(result.current.currentStep).toBe(2);
  });

  it("I-RC-2: totalSteps=0 keeps currentStep=0 and isPlaying=false even after play()", () => {
    const { result } = renderHook(() => useReplayClock({ totalSteps: 0 }));
    expect(result.current.currentStep).toBe(0);
    expect(result.current.isPlaying).toBe(false);

    act(() => result.current.play());
    expect(result.current.currentStep).toBe(0);
    expect(result.current.isPlaying).toBe(false);

    act(() => result.current.toggle());
    expect(result.current.isPlaying).toBe(false);
  });

  it("I-RC-3: play() at last step is a no-op (isPlaying stays false)", () => {
    const { result } = renderHook(() => useReplayClock({ totalSteps: 4 }));

    act(() => result.current.jumpTo(3));
    expect(result.current.currentStep).toBe(3);
    expect(result.current.isPlaying).toBe(false);

    act(() => result.current.play());
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.currentStep).toBe(3);
  });

  it("I-RC-4: prefersReducedMotion=true makes play() a no-op", () => {
    const { result } = renderHook(() =>
      useReplayClock({ totalSteps: 10, prefersReducedMotion: true })
    );

    act(() => result.current.play());
    expect(result.current.isPlaying).toBe(false);

    act(() => result.current.toggle());
    expect(result.current.isPlaying).toBe(false);
  });

  it("I-RC-5: setSpeed mid-play does not change isPlaying and does not skip steps", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useReplayClock({ totalSteps: 100 }));

    act(() => result.current.play());
    expect(result.current.isPlaying).toBe(true);
    expect(result.current.currentStep).toBe(0);

    // Advance one full tick at speed 1 (220ms).
    act(() => {
      vi.advanceTimersByTime(220);
    });
    expect(result.current.currentStep).toBe(1);
    expect(result.current.isPlaying).toBe(true);

    // Change speed mid-play; should rebase the timer cleanly.
    act(() => result.current.setSpeed(2));
    expect(result.current.isPlaying).toBe(true);

    // After setSpeed, no tick should fire before the new interval (110ms) elapses.
    act(() => {
      vi.advanceTimersByTime(109);
    });
    expect(result.current.currentStep).toBe(1);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.currentStep).toBe(2);
    expect(result.current.isPlaying).toBe(true);

    // Advance exactly one more interval — should advance by exactly one step.
    act(() => {
      vi.advanceTimersByTime(110);
    });
    expect(result.current.currentStep).toBe(3);
  });

  it("I-RC-6: unmount clears pending timeout (no leaks)", () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() => useReplayClock({ totalSteps: 50 }));

    act(() => result.current.play());
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("I-RC-7: totalSteps decreasing clamps currentStep and pauses when past the new end", () => {
    let totalSteps = 10;
    const { result, rerender } = renderHook(() => useReplayClock({ totalSteps }));

    act(() => result.current.jumpTo(8));
    expect(result.current.currentStep).toBe(8);

    act(() => result.current.play());
    expect(result.current.isPlaying).toBe(true);

    totalSteps = 3;
    rerender();
    expect(result.current.currentStep).toBe(2);
    expect(result.current.isPlaying).toBe(false);
  });

  it("play() then advancing fake time by N×220ms results in currentStep N (capped at totalSteps - 1)", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useReplayClock({ totalSteps: 6 }));

    act(() => result.current.play());
    expect(result.current.currentStep).toBe(0);

    act(() => {
      vi.advanceTimersByTime(220 * 3);
    });
    expect(result.current.currentStep).toBe(3);
    expect(result.current.isPlaying).toBe(true);

    act(() => {
      vi.advanceTimersByTime(220 * 100);
    });
    expect(result.current.currentStep).toBe(5);
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.isComplete).toBe(true);
  });

  it("setSpeed(2) halves the interval — tick fires at 110ms", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useReplayClock({ totalSteps: 50 }));

    act(() => result.current.setSpeed(2));
    act(() => result.current.play());

    act(() => {
      vi.advanceTimersByTime(109);
    });
    expect(result.current.currentStep).toBe(0);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.currentStep).toBe(1);
  });

  it("setSpeed(0.5) doubles the interval — tick fires at 440ms", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useReplayClock({ totalSteps: 50 }));

    act(() => result.current.setSpeed(0.5));
    act(() => result.current.play());

    act(() => {
      vi.advanceTimersByTime(439);
    });
    expect(result.current.currentStep).toBe(0);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.currentStep).toBe(1);
  });

  it("stepForward() while playing pauses isPlaying", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useReplayClock({ totalSteps: 10 }));

    act(() => result.current.play());
    expect(result.current.isPlaying).toBe(true);

    act(() => result.current.stepForward());
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.currentStep).toBe(1);
  });

  it("stepBackward() while playing pauses isPlaying and clamps at 0", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useReplayClock({ totalSteps: 10 }));

    act(() => result.current.jumpTo(2));
    act(() => result.current.play());
    expect(result.current.isPlaying).toBe(true);

    act(() => result.current.stepBackward());
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.currentStep).toBe(1);

    act(() => result.current.stepBackward());
    expect(result.current.currentStep).toBe(0);

    act(() => result.current.stepBackward());
    expect(result.current.currentStep).toBe(0);
  });

  it("reset() from any state returns to {currentStep: 0, isPlaying: false, speedMultiplier: 1}", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useReplayClock({ totalSteps: 20 }));

    act(() => result.current.jumpTo(7));
    act(() => result.current.setSpeed(4));
    act(() => result.current.play());
    expect(result.current.currentStep).toBe(7);
    expect(result.current.speedMultiplier).toBe(4);
    expect(result.current.isPlaying).toBe(true);

    act(() => result.current.reset());
    expect(result.current.currentStep).toBe(0);
    expect(result.current.isPlaying).toBe(false);
    expect(result.current.speedMultiplier).toBe(1);
  });

  it("isComplete is true at last step when paused, false otherwise", () => {
    const { result } = renderHook(() => useReplayClock({ totalSteps: 3 }));
    expect(result.current.isComplete).toBe(false);

    act(() => result.current.jumpTo(2));
    expect(result.current.isComplete).toBe(true);
    expect(result.current.isPlaying).toBe(false);
  });

  it("toggle() pauses when playing and plays when paused", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useReplayClock({ totalSteps: 10 }));

    expect(result.current.isPlaying).toBe(false);
    act(() => result.current.toggle());
    expect(result.current.isPlaying).toBe(true);
    act(() => result.current.toggle());
    expect(result.current.isPlaying).toBe(false);
  });

  it("callbacks remain stable across renders", () => {
    const { result, rerender } = renderHook(
      ({ total }: { total: number }) => useReplayClock({ totalSteps: total }),
      { initialProps: { total: 5 } }
    );
    const first = {
      play: result.current.play,
      pause: result.current.pause,
      toggle: result.current.toggle,
      stepForward: result.current.stepForward,
      stepBackward: result.current.stepBackward,
      jumpTo: result.current.jumpTo,
      setSpeed: result.current.setSpeed,
      reset: result.current.reset,
    };
    rerender({ total: 9 });
    expect(result.current.play).toBe(first.play);
    expect(result.current.pause).toBe(first.pause);
    expect(result.current.toggle).toBe(first.toggle);
    expect(result.current.stepForward).toBe(first.stepForward);
    expect(result.current.stepBackward).toBe(first.stepBackward);
    expect(result.current.jumpTo).toBe(first.jumpTo);
    expect(result.current.setSpeed).toBe(first.setSpeed);
    expect(result.current.reset).toBe(first.reset);
  });
});
