// Skeleton — pulse loader with typed shape variants.
//
// The original API (`width`, `height`, `className`, `style`,
// `...rest`) is preserved verbatim, so call sites in
// `frontend/app/simulations/[id]/{page,report}/page.tsx` continue
// to compile without modification.
//
// New, additive `kind` prop selects an opinionated default shape
// suitable for common loading surfaces:
//
//   * "default"   — bare rectangular pulse (existing behaviour).
//   * "text-line" — short text-line shaped pulse, ~9rem wide.
//   * "card"      — card-shaped pulse, full width × ~9rem tall.
//   * "row"       — table row, full width × ~2rem tall.
//
// `kind` defaults are overridden by any explicit `width` / `height`
// prop the caller passes — so the variant nudges the default
// dimensions without taking control away from existing code.

import * as React from "react";

export type SkeletonKind = "default" | "text-line" | "card" | "row";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
  kind?: SkeletonKind;
}

// Default dimensions per variant. Used only when the caller does
// not explicitly pass `width` / `height`.
const KIND_DEFAULTS: Record<
  SkeletonKind,
  { width: string | number; height: string | number; extraClass?: string }
> = {
  default: { width: "100%", height: "1.25rem" },
  "text-line": { width: "9rem", height: "0.75rem", extraClass: "rounded-sm" },
  card: { width: "100%", height: "9rem", extraClass: "rounded-md" },
  row: { width: "100%", height: "2rem", extraClass: "rounded-sm" },
};

export function Skeleton({
  width,
  height,
  kind = "default",
  className = "",
  style,
  ...rest
}: SkeletonProps) {
  const defaults = KIND_DEFAULTS[kind];
  const resolvedWidth = width ?? defaults.width;
  const resolvedHeight = height ?? defaults.height;
  const extra = defaults.extraClass ?? "";

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="loading"
      data-skeleton-kind={kind}
      className={`bg-border/60 rounded animate-pulse motion-reduce:animate-none ${extra} ${className}`.trim()}
      style={{ width: resolvedWidth, height: resolvedHeight, ...style }}
      {...rest}
    />
  );
}
