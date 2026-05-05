"use client";

import * as React from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-sentinel-accent/20 border-sentinel-accent/40 text-sentinel-accent hover:bg-sentinel-accent/30",
  secondary: "bg-sentinel-panel border-sentinel-border text-gray-200 hover:bg-sentinel-border/40",
  ghost: "border-transparent text-gray-300 hover:bg-sentinel-panel",
  danger: "bg-sentinel-bad/20 border-sentinel-bad/40 text-sentinel-bad hover:bg-sentinel-bad/30",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "px-2 py-0.5 text-xs",
  md: "px-3 py-1 text-sm",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", className = "", children, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      className={`rounded border ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-sentinel-accent ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});
