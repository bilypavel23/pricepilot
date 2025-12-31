"use client";

import Link from "next/link";

export function AppFooter() {
  return (
    <footer className="border-t border-border bg-background dark:bg-[#0c0e16] mt-auto">
      <div className="mx-auto max-w-7xl flex flex-col items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 py-6 text-sm text-muted-foreground sm:flex-row">
        <span>© {new Date().getFullYear()} PricePilot. All rights reserved.</span>
        <div className="flex flex-wrap items-center justify-center gap-6">
          <Link href="/terms" className="hover:text-foreground transition-colors">
            Terms of Service
          </Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            Privacy Policy
          </Link>
        </div>
      </div>
    </footer>
  );
}

