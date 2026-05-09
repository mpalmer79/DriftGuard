// HeroErrorBoundary — catches runtime errors thrown by the 3D hero scene
// (R3F / three.js / drei) so a Canvas crash never tears down the rest
// of the simulation detail page. Renders a static OG-image fallback,
// and surfaces the error message inline so we can diagnose without
// devtools access.

"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import Image from "next/image";

interface HeroErrorBoundaryProps {
  children: ReactNode;
}

interface HeroErrorBoundaryState {
  hasError: boolean;
  message: string | null;
  stackHead: string | null;
}

function firstStackFrame(stack: string | undefined): string | null {
  if (!stack) return null;
  const line = stack.split("\n").find((l) => l.trim().startsWith("at "));
  return line ? line.trim() : null;
}

export class HeroErrorBoundary extends Component<HeroErrorBoundaryProps, HeroErrorBoundaryState> {
  state: HeroErrorBoundaryState = { hasError: false, message: null, stackHead: null };

  static getDerivedStateFromError(error: unknown): HeroErrorBoundaryState {
    const err = error instanceof Error ? error : null;
    return {
      hasError: true,
      message: err?.message ?? String(error),
      stackHead: firstStackFrame(err?.stack),
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    if (typeof window !== "undefined") {
      const componentStack = info.componentStack?.split("\n").slice(0, 3).join("\n") ?? "";
      const message = error instanceof Error ? error.message : String(error);
      // Stash on window so it survives React error overlays.
      (window as unknown as { __DG_HERO_ERROR__?: string }).__DG_HERO_ERROR__ =
        `${message}\n${componentStack}`;
    }
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <div
        data-testid="hero-error-fallback"
        className="aspect-[16/7] w-full relative"
        aria-label="Triplex controller visualization"
      >
        <span className="sr-only">3D hero unavailable; showing static visualization.</span>
        <div className="flex flex-col items-center justify-center w-full h-full">
          <Image
            src="/og.png"
            alt="DriftGuard triplex visualization"
            width={1200}
            height={525}
            className="w-full h-full object-cover opacity-80"
            unoptimized
          />
          <p className="text-xs text-text-muted font-mono mt-2">
            {"// 3D hero unavailable — showing static visualization"}
          </p>
          {this.state.message ? (
            <div className="mt-2 max-w-[640px] w-full px-3 py-2 rounded border border-status-failed/40 bg-status-failed/5 font-mono text-[11px] text-status-failed leading-snug break-all">
              <p className="uppercase tracking-wider text-[9px] text-status-failed/80 mb-1">
                {"// hero error (diagnostic)"}
              </p>
              <p>{this.state.message}</p>
              {this.state.stackHead ? (
                <p className="mt-1 opacity-70">{this.state.stackHead}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    );
  }
}
