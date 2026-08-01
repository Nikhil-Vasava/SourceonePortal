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
        <header className="glass-surface flex items-center gap-3 px-4 py-3 lg:hidden">
          <button
            onClick={() => setNavOpen(true)}
            className="icon-btn"
            aria-label="Open navigation"
          >
            <IconMenu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <img src="/logo-mark.svg" alt="" width={28} height={28} className="h-7 w-7 shrink-0" />
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
