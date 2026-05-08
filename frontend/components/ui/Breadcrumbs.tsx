import * as React from "react";
import Link from "next/link";

export interface Crumb {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  trail: Crumb[];
}

export function Breadcrumbs({ trail }: BreadcrumbsProps) {
  if (!trail || trail.length === 0) return null;

  return (
    <nav
      aria-label="Breadcrumb"
      className="font-mono uppercase text-xs tracking-wider text-text-muted"
    >
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {trail.map((crumb, idx) => {
          const isLast = idx === trail.length - 1;
          const showSeparator = idx > 0;
          return (
            <li key={`${crumb.label}-${idx}`} className="flex items-center gap-2">
              {showSeparator && (
                <span aria-hidden="true" className="text-border-strong">
                  &gt;
                </span>
              )}
              {isLast || !crumb.href ? (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className={isLast ? "font-bold text-text-primary" : ""}
                >
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="hover:text-text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
