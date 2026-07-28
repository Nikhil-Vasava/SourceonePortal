"use client";

// Holds the one piece of state the shell needs — whether the mobile drawer is
// open — so app/layout.js can stay a server component and keep reading the
// session cookie.

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import { IconMenu } from "@/components/icons";

export default function AppShell({ user, children }) {
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar user={user} open={navOpen} onClose={() => setNavOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar — mobile only; the sidebar carries the branding on desktop */}
        <header className="flex items-center gap-3 border-b border-ink-200/70 bg-white px-4 py-3 lg:hidden">
          <button
            onClick={() => setNavOpen(true)}
            className="rounded-md p-1.5 text-ink-600 hover:bg-ink-100"
            aria-label="Open navigation"
          >
            <IconMenu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-brand-400 to-teal-500">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white"
                   strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 18c1.6 0 1.6 1.4 3.2 1.4S7.8 18 9.4 18s1.6 1.4 3.2 1.4S14.2 18 15.8 18s1.6 1.4 3.2 1.4" />
                <path d="M4.8 14.4 12 12l7.2 2.4-1.1 3.1H5.9z" />
                <path d="M12 12V6.4M8.8 8.8h6.4" />
              </svg>
            </div>
            <span className="text-sm font-semibold tracking-tight text-ink-900">SourceOne</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
