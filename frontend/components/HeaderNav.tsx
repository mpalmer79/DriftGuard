// HeaderNav — client-side navigation strip for the global header.
//
// Extracted out of `app/layout.tsx` (a server component) because
// it needs `usePathname()` to mark the active link with
// `aria-current="page"`.
//
// Routes: brand link → /, plus Dashboard and Scenarios. The
// "source" link and the ThemeToggle live next to the nav inside
// `layout.tsx`, so this component intentionally only renders the
// in-app navigation.
//
// Mobile: `flex flex-wrap` is preserved so narrow viewports
// line-wrap cleanly without horizontal scroll.

"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavLink {
  href: string;
  label: string;
  /** When true, only the exact path activates this link. Used for "/" so it doesn't match every route. */
  exact?: boolean;
}

const LINKS: readonly NavLink[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/scenarios", label: "Scenarios" },
];

// Internal helper exported for unit tests so we can verify the
// matching rule directly without rendering against a contrived
// `usePathname` mock.
export function isActive(pathname: string | null, href: string, exact?: boolean): boolean {
  if (!pathname) return false;
  if (exact) return pathname === href;
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}

export function HeaderNav() {
  const pathname = usePathname();
  return (
    <>
      <Link href="/" className="font-semibold text-base">
        DriftGuard
      </Link>
      {LINKS.map((link) => {
        const active = isActive(pathname, link.href, link.exact);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "text-text-primary underline underline-offset-4 decoration-accent"
                : "text-text-muted hover:text-text-primary"
            }
          >
            {link.label}
          </Link>
        );
      })}
    </>
  );
}
