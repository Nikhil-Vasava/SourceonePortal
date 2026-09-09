"use client";

// The client half of theming: reading the choice, changing it, and keeping
// every control on screen in step.
//
// Changing theme does not reload the page and does not touch the server. It
// rewrites one attribute on <html>; every colour in the app is a CSS variable
// hanging off that attribute, so the whole interface changes in the same frame
// — including any modal that happens to be open.

import { useCallback, useEffect, useState } from "react";
import {
  THEME_COOKIE, DEFAULT_THEME, THEME_BG,
  normaliseTheme, resolveTheme,
} from "@/lib/theme";

// Two controls exist (the sidebar toggle and the Account page picker) and can
// be on screen together. This keeps them from disagreeing: whoever changes the
// theme announces it, and the others follow.
const CHANGE_EVENT = "sourceone:theme";

const TWO_YEARS = 60 * 60 * 24 * 730;

function prefersDark() {
  return typeof window !== "undefined"
    && window.matchMedia
    && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Paints a choice. Returns the theme that actually ended up applied. */
export function applyTheme(choice) {
  const resolved = resolveTheme(choice, prefersDark());
  document.documentElement.setAttribute("data-theme", resolved);

  // Keep the browser/phone chrome in step with the page.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", THEME_BG[resolved] || THEME_BG.dark);

  return resolved;
}

/**
 * @param initial the choice the server already read from the cookie. Passing
 *   it in — rather than reading the cookie in an effect — means the control
 *   renders correct on the very first paint instead of flicking into place.
 */
export function useTheme(initial = DEFAULT_THEME) {
  const [choice, setChoice] = useState(() => normaliseTheme(initial));
  const [resolved, setResolved] = useState(() =>
    // The server can't know the OS setting, so "system" resolves to dark here
    // and is corrected in the effect below. Matches serverTheme().
    normaliseTheme(initial) === "system" ? "dark" : normaliseTheme(initial));

  // Settle "system" against the real OS value once we're in the browser.
  useEffect(() => { setResolved(applyTheme(choice)); }, [choice]);

  // Follow the OS while — and only while — the choice is "system". Someone on
  // a Windows day/night schedule gets the switch at sunset without doing
  // anything, and someone who picked a theme explicitly is left alone.
  useEffect(() => {
    if (choice !== "system" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setResolved(applyTheme("system"));
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [choice]);

  // Another control on the page changed it.
  useEffect(() => {
    const onOther = (e) => setChoice(normaliseTheme(e.detail));
    window.addEventListener(CHANGE_EVENT, onOther);
    return () => window.removeEventListener(CHANGE_EVENT, onOther);
  }, []);

  const change = useCallback((next) => {
    const value = normaliseTheme(next);
    document.cookie =
      `${THEME_COOKIE}=${value}; path=/; max-age=${TWO_YEARS}; samesite=lax`;
    setChoice(value);
    setResolved(applyTheme(value));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: value }));
  }, []);

  return { choice, resolved, change };
}
