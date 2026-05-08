"use client";

import * as React from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-dg-accent/20 border-dg-accent/40 text-dg-accent hover:bg-dg-accent/30",
  secondary: "bg-dg-panel border-dg-border text-gray-200 hover:bg-dg-border/40",
  ghost: "border-transparent text-gray-300 hover:bg-dg-panel",
  danger: "bg-dg-bad/20 border-dg-bad/40 text-dg-bad hover:bg-dg-bad/30",
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
      className={`rounded border ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-dg-accent ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});
