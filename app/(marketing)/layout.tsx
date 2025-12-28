"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-slate-950 text-slate-50">
      {/* Navbar */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 py-4">
          <Link href="/" prefetch={false} className="flex items-center">
            <Image
              src="/landing/pricepilot.png"
              alt="PricePilot"
              height={32}
              width={120}
              className="h-7 sm:h-8 w-auto object-contain"
              priority
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-8 text-sm text-slate-300 md:flex">
            <Link href="/#features" className="hover:text-white transition-colors">
              Features
            </Link>
            <Link href="/#how-it-works" className="hover:text-white transition-colors">
              How it works
            </Link>
            <Link href="/#pricing" className="hover:text-white transition-colors">
              Pricing
            </Link>
          </nav>

          {/* Desktop CTA Buttons */}
          <div className="hidden items-center gap-3 md:flex">
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="text-sm text-slate-200 hover:bg-slate-900 hover:text-white"
            >
              <Link href="/login">Log in</Link>
            </Button>
            <Button
              asChild
              size="sm"
              className="text-sm rounded-full bg-blue-500 px-5 font-medium text-white hover:bg-blue-600"
            >
              <Link href="/register">Get started</Link>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-slate-300 hover:text-white"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-800 bg-slate-950/95 backdrop-blur">
            <nav className="mx-auto max-w-7xl px-4 py-4 space-y-3">
              <Link
                href="/#features"
                className="block text-sm text-slate-300 hover:text-white transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Features
              </Link>
              <Link
                href="/#how-it-works"
                className="block text-sm text-slate-300 hover:text-white transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                How it works
              </Link>
              <Link
                href="/#pricing"
                className="block text-sm text-slate-300 hover:text-white transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                Pricing
              </Link>
              <div className="pt-3 space-y-2 border-t border-slate-800">
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="w-full text-sm text-slate-200 hover:bg-slate-900 hover:text-white"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Link href="/login">Log in</Link>
                </Button>
                <Button
                  asChild
                  size="sm"
                  className="w-full text-sm rounded-full bg-blue-500 font-medium text-white hover:bg-blue-600"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Link href="/register">Get started</Link>
                </Button>
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* Content */}
      <main className="w-full bg-gradient-to-b from-slate-950 via-slate-950 to-slate-950">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950">
        <div className="mx-auto max-w-7xl flex flex-col items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 py-8 text-sm text-slate-500 sm:flex-row">
          <span>© {new Date().getFullYear()} PricePilot. All rights reserved.</span>
          <div className="flex flex-wrap items-center justify-center gap-6">
            <Link href="/pricing" className="hover:text-slate-300 transition-colors">
              Pricing
            </Link>
            <Link href="/features" className="hover:text-slate-300 transition-colors">
              Features
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
