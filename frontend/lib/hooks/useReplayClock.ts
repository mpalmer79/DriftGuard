"use client";

// useReplayClock — drives a replay timeline scrubber with play/pause, speed,
// step controls, and reduced-motion support. The 220ms base interval is
// rebased cleanly on speed changes via a self-rescheduling setTimeout.
//
// Invariants:
//   I-RC-1: currentStep always in [0, max(0, totalSteps - 1)].
//   I-RC-2: totalSteps === 0 forces isPlaying=false and currentStep=0.
//   I-RC-3: play() at the last step is a no-op (auto-stop at end).
//   I-RC-4: prefersReducedMotion=true makes play() a no-op.
//   I-RC-5: setSpeed never changes isPlaying; rebases timer cleanly.
//   I-RC-6: Unmounting clears the pending timeout.
//   I-RC-7: totalSteps shrinking clamps currentStep and pauses if past end.

import { useCallback, useEffect, useReducer, useRef } from "react";

export type Speed = 0.5 | 1 | 2 | 4;

export type ReplayClockHandle = {
  currentStep: number;
  isPlaying: boolean;
  speedMultiplier: Speed;
  isComplete: boolean;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  stepForward: () => void;
  stepBackward: () => void;
  jumpTo: (step: number) => void;
  setSpeed: (s: Speed) => void;
  reset: () => void;
};

export interface UseReplayClockOptions {
  totalSteps: number;
  prefersReducedMotion?: boolean;
}

export const REPLAY_BASE_INTERVAL_MS = 220;

type State = {
  currentStep: number;
  isPlaying: boolean;
  speedMultiplier: Speed;
};

type Action =
  | { type: "play"; totalSteps: number; prefersReducedMotion: boolean }
  | { type: "pause" }
  | { type: "toggle"; totalSteps: number; prefersReducedMotion: boolean }
  | { type: "tick"; totalSteps: number }
  | { type: "stepForward"; totalSteps: number }
  | { type: "stepBackward" }
  | { type: "jumpTo"; step: number; totalSteps: number }
  | { type: "setSpeed"; speed: Speed }
  | { type: "reset" }
  | { type: "syncTotal"; totalSteps: number };

function clampStep(step: number, totalSteps: number): number {
  if (totalSteps <= 0) return 0;
  if (step < 0) return 0;
  const max = totalSteps - 1;
  return step > max ? max : step;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "play": {
      if (action.totalSteps <= 0) return { ...state, isPlaying: false, currentStep: 0 };
      if (action.prefersReducedMotion) return state;
      const lastIndex = action.totalSteps - 1;
      if (state.currentStep >= lastIndex) return state;
      return { ...state, isPlaying: true };
    }
    case "pause": {
      if (!state.isPlaying) return state;
      return { ...state, isPlaying: false };
    }
    case "toggle": {
      if (state.isPlaying) return { ...state, isPlaying: false };
      if (action.totalSteps <= 0) return { ...state, isPlaying: false, currentStep: 0 };
      if (action.prefersReducedMotion) return state;
      const lastIndex = action.totalSteps - 1;
      if (state.currentStep >= lastIndex) return state;
      return { ...state, isPlaying: true };
    }
    case "tick": {
      if (action.totalSteps <= 0) return { currentStep: 0, isPlaying: false, speedMultiplier: state.speedMultiplier };
      const lastIndex = action.totalSteps - 1;
      const next = state.currentStep + 1;
      if (next >= lastIndex) {
        return { ...state, currentStep: lastIndex, isPlaying: false };
      }
      return { ...state, currentStep: next };
    }
    case "stepForward": {
      const next = clampStep(state.currentStep + 1, action.totalSteps);
      return { ...state, currentStep: next, isPlaying: false };
    }
    case "stepBackward": {
      const next = state.currentStep - 1 < 0 ? 0 : state.currentStep - 1;
      return { ...state, currentStep: next, isPlaying: false };
    }
    case "jumpTo": {
      const next = clampStep(action.step, action.totalSteps);
      return { ...state, currentStep: next, isPlaying: false };
    }
    case "setSpeed": {
      if (state.speedMultiplier === action.speed) return state;
      return { ...state, speedMultiplier: action.speed };
    }
    case "reset": {
      return { currentStep: 0, isPlaying: false, speedMultiplier: 1 };
    }
    case "syncTotal": {
      if (action.totalSteps <= 0) {
        return { ...state, currentStep: 0, isPlaying: false };
      }
      const lastIndex = action.totalSteps - 1;
      if (state.currentStep > lastIndex) {
        return { ...state, currentStep: lastIndex, isPlaying: false };
      }
      return state;
    }
    default:
      return state;
  }
}

const INITIAL_STATE: State = {
  currentStep: 0,
  isPlaying: false,
  speedMultiplier: 1,
};

export function useReplayClock(opts: UseReplayClockOptions): ReplayClockHandle {
  const { totalSteps, prefersReducedMotion = false } = opts;
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  const totalStepsRef = useRef(totalSteps);
  totalStepsRef.current = totalSteps;
  const prefersReducedMotionRef = useRef(prefersReducedMotion);
  prefersReducedMotionRef.current = prefersReducedMotion;

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPending = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    dispatch({ type: "syncTotal", totalSteps });
  }, [totalSteps]);

  useEffect(() => {
    if (!state.isPlaying) {
      clearPending();
      return;
    }
    const intervalMs = Math.max(1, Math.round(REPLAY_BASE_INTERVAL_MS / state.speedMultiplier));
    const fire = () => {
      dispatch({ type: "tick", totalSteps: totalStepsRef.current });
      timeoutRef.current = setTimeout(fire, intervalMs);
    };
    clearPending();
    timeoutRef.current = setTimeout(fire, intervalMs);
    return clearPending;
  }, [state.isPlaying, state.speedMultiplier, clearPending]);

  useEffect(() => clearPending, [clearPending]);

  const play = useCallback(() => {
    dispatch({
      type: "play",
      totalSteps: totalStepsRef.current,
      prefersReducedMotion: prefersReducedMotionRef.current,
    });
  }, []);

  const pause = useCallback(() => {
    dispatch({ type: "pause" });
  }, []);

  const toggle = useCallback(() => {
    dispatch({
      type: "toggle",
      totalSteps: totalStepsRef.current,
      prefersReducedMotion: prefersReducedMotionRef.current,
    });
  }, []);

  const stepForward = useCallback(() => {
    dispatch({ type: "stepForward", totalSteps: totalStepsRef.current });
  }, []);

  const stepBackward = useCallback(() => {
    dispatch({ type: "stepBackward" });
  }, []);

  const jumpTo = useCallback((step: number) => {
    dispatch({ type: "jumpTo", step, totalSteps: totalStepsRef.current });
  }, []);

  const setSpeed = useCallback((s: Speed) => {
    dispatch({ type: "setSpeed", speed: s });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: "reset" });
  }, []);

  const lastIndex = totalSteps > 0 ? totalSteps - 1 : 0;
  const isComplete = totalSteps > 0 && state.currentStep === lastIndex && !state.isPlaying;

  return {
    currentStep: state.currentStep,
    isPlaying: state.isPlaying,
    speedMultiplier: state.speedMultiplier,
    isComplete,
    play,
    pause,
    toggle,
    stepForward,
    stepBackward,
    jumpTo,
    setSpeed,
    reset,
  };
}
