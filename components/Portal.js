"use client";

// Renders children into <body>, outside whatever they were declared in.
//
// Needed because `position: fixed` is not always relative to the viewport. Any
// ancestor with `transform`, `filter`, `perspective` or — the one that caught us
// — `backdrop-filter` becomes the containing block for fixed descendants. The
// glass surfaces in this app all use backdrop-filter, so a modal declared inside
// a table card was being clipped to that card instead of covering the screen.
//
// Portalling to <body> sidesteps the whole class of problem: it doesn't matter
// what a modal is nested inside, it always lands at the top level.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function Portal({ children }) {
  const [mounted, setMounted] = useState(false);

  // document doesn't exist during server rendering, so wait for the client.
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!mounted) return null;
  return createPortal(children, document.body);
}
