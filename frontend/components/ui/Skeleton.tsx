import * as React from "react";

export type SkeletonKind = "default" | "text-line" | "card" | "row";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
  kind?: SkeletonKind;
}

// Defaults are overridden by an explicit width/height prop.
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
