import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "DriftGuard",
  description: "Deterministic, fault-tolerant control system simulation",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-mono">
        <header className="border-b border-sentinel-border bg-sentinel-panel/50 backdrop-blur sticky top-0 z-10">
          <nav className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-6 text-sm">
            <Link href="/" className="font-semibold text-base">
              DriftGuard
            </Link>
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/scenarios">Scenarios</Link>
            <a
              href="https://github.com/mpalmer79/SentinelNav"
              target="_blank"
              rel="noreferrer"
              className="ml-auto opacity-60 hover:opacity-100"
            >
              source
            </a>
          </nav>
        </header>
        <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
