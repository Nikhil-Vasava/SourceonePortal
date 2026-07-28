"use client";

// App shell navigation.
//
// Desktop (lg and up): a fixed 240px rail, always visible.
// Below that: the same rail slides in over the content from a hamburger in the
// top bar. One component renders both so the nav is defined once — only the
// positioning classes differ.

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  IconDashboard, IconPurchase, IconShip, IconFactory,
  IconHandshake, IconBook, IconUsers, IconLogout, IconSettings, IconX,
} from "@/components/icons";

const NAV = [
  { section: "Operations", items: [
    { href: "/", label: "Dashboard", Icon: IconDashboard },
    { href: "/purchase", label: "Purchase", Icon: IconPurchase },
    { href: "/bookings", label: "Booking", Icon: IconShip },
  ]},
  { section: "Fulfilment", items: [
    { href: "/suppliers", label: "Supplier", Icon: IconFactory },
    { href: "/buyers", label: "Buyer", Icon: IconHandshake },
  ]},
  { section: "Setup", items: [
    { href: "/info", label: "Info", Icon: IconBook },
    { href: "/users", label: "Users", Icon: IconUsers, role: ["ADMIN"] },
    { href: "/settings", label: "Settings", Icon: IconSettings, role: ["ADMIN"] },
  ]},
];

function initials(name = "") {
  return name.replace(/\(.*?\)/g, "").trim().split(/\s+/).slice(0, 2)
    .map(w => w[0]).join("").toUpperCase() || "U";
}

export default function Sidebar({ user, open, onClose }) {
  const pathname = usePathname();
  const router = useRouter();

  // Close the drawer whenever the route changes, so tapping a link doesn't
  // leave it hanging open over the page you just navigated to.
  useEffect(() => { onClose?.(); }, [pathname]);   // eslint-disable-line react-hooks/exhaustive-deps

  // Escape closes it, matching the modals elsewhere in the app.
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Stop the page behind the drawer from scrolling while it's open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* Backdrop — mobile only, and only while open */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-ink-900/50 lg:hidden animate-fade-in"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={[
          "z-50 flex w-60 shrink-0 flex-col bg-ink-900 text-white",
          // mobile: fixed drawer, slid off-screen unless open
          "fixed inset-y-0 left-0 transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "-translate-x-full",
          // desktop: part of the flex row, always in view
          "lg:static lg:translate-x-0 lg:transition-none",
        ].join(" ")}
        aria-label="Main navigation"
      >
        {/* Brand */}
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 to-teal-500 shadow-lg shadow-brand-900/40">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="white"
                 strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 18c1.6 0 1.6 1.4 3.2 1.4S7.8 18 9.4 18s1.6 1.4 3.2 1.4S14.2 18 15.8 18s1.6 1.4 3.2 1.4" />
              <path d="M4.8 14.4 12 12l7.2 2.4-1.1 3.1H5.9z" />
              <path d="M12 12V6.4M8.8 8.8h6.4" />
            </svg>
          </div>
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-tight">SourceOne</div>
            <div className="text-2xs font-medium uppercase tracking-widest text-ink-400">Trade ERP</div>
          </div>

          {/* Close — mobile only */}
          <button
            onClick={onClose}
            className="ml-auto rounded-md p-1.5 text-ink-400 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Close navigation"
          >
            <IconX size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
          {NAV.map(group => {
            const items = group.items.filter(i => !i.role || i.role.includes(user.role));
            if (!items.length) return null;
            return (
              <div key={group.section}>
                <div className="mb-1.5 px-3 text-2xs font-semibold uppercase tracking-widest text-ink-500">
                  {group.section}
                </div>
                <div className="space-y-0.5">
                  {items.map(({ href, label, Icon }) => {
                    const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
                    return (
                      <Link key={href} href={href}
                        className={`nav-link ${active ? "nav-link-active" : ""}`}
                        aria-current={active ? "page" : undefined}>
                        <Icon size={17} className={active ? "text-brand-300" : "text-ink-400"} />
                        {label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* User */}
        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-2xs font-semibold text-white">
              {initials(user.name)}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-xs font-medium text-white">{user.name}</div>
              <div className="text-2xs uppercase tracking-wide text-ink-400">{user.role}</div>
            </div>
            <button onClick={logout} title="Sign out" aria-label="Sign out"
              className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-white/10 hover:text-white">
              <IconLogout size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
