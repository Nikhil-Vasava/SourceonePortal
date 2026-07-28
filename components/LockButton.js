"use client";

// Re-locks Settings without waiting for the timer or navigating away.

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { IconAlert } from "@/components/icons";

export default function LockButton() {
  const [pending, start] = useTransition();
  const router = useRouter();

  function lock() {
    start(async () => {
      await fetch("/api/settings-lock", { method: "DELETE" });
      router.refresh();
    });
  }

  return (
    <button type="button" onClick={lock} disabled={pending} className="btn btn-secondary btn-sm">
      <IconAlert size={14} />
      {pending ? "Locking…" : "Lock now"}
    </button>
  );
}
