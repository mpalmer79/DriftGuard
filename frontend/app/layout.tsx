import "./globals.css";
import type { Metadata } from "next";
import { ThemeProvider } from "../components/ThemeProvider";
import { ThemeToggle } from "../components/ThemeToggle";
import { HeaderNav } from "../components/HeaderNav";

export const metadata: Metadata = {
  title: {
    default: "DriftGuard",
    template: "%s · DriftGuard",
  },
  description:
    "Deterministic, fault-tolerant control-system simulation. Triple-redundant controllers, majority voting, and explicit safe-mode escalation, with replayable runs and an auditable mission report.",
  applicationName: "DriftGuard",
  keywords: [
    "fault tolerance",
    "control systems",
    "redundant controllers",
    "safe mode",
    "deterministic simulation",
    "replay",
    "mission report",
  ],
  authors: [{ name: "DriftGuard" }],
  openGraph: {
    type: "website",
    siteName: "DriftGuard",
    title: "DriftGuard",
    description:
      "Deterministic, fault-tolerant control-system simulation with triple-redundant controllers, majority voting, safe-mode escalation, and replayable runs.",
  },
  twitter: {
    card: "summary",
    title: "DriftGuard",
    description:
      "Deterministic, fault-tolerant control-system simulation with replayable runs and an auditable mission report.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem('driftguard-theme');var t=(s==='light'||s==='dark')?s:(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme='dark';}})();`,
          }}
        />
      </head>
      <body className="font-mono">
        <ThemeProvider>
          <header className="border-b border-dg-border bg-dg-panel/50 backdrop-blur sticky top-0 z-10">
            <nav className="max-w-6xl mx-auto px-6 py-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <HeaderNav />
              
                href="https://github.com/mpalmer79/driftguard"
                target="_blank"
                rel="noreferrer"
                className="ml-auto opacity-60 hover:opacity-100"
              >
                source
              </a>
              <ThemeToggle />
            </nav>
          </header>
          <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
