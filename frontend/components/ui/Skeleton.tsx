import * as React from "react";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
}

export function Skeleton({
  width = "100%",
  height = "1.25rem",
  className = "",
  style,
  ...rest
}: SkeletonProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="loading"
      className={`bg-dg-border/50 rounded animate-pulse motion-reduce:animate-none ${className}`}
      style={{ width, height, ...style }}
      {...rest}
    />
  );
}
