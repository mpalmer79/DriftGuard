// HeroErrorBoundary — catches runtime errors thrown by the 3D hero scene
// (R3F / three.js / drei) so a Canvas crash never tears down the rest
// of the simulation detail page. Renders a static OG-image fallback.

"use client";

import { Component, type ReactNode } from "react";
import Image from "next/image";

interface HeroErrorBoundaryProps {
  children: ReactNode;
}

interface HeroErrorBoundaryState {
  hasError: boolean;
}

export class HeroErrorBoundary extends Component<HeroErrorBoundaryProps, HeroErrorBoundaryState> {
  state: HeroErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): HeroErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(): void {
    // Silently isolate: the rest of the page is the source of truth.
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
        </div>
      </div>
    );
  }
}
