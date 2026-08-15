"use client";

// Submitting a server action from inside a modal.
//
// `<form action={serverAction}>` posts and revalidates, but the client never
// learns when it finished — so the modal has no moment at which to close and
// nothing to confirm with. Calling the action directly gives us that moment:
// await it, then close and report.
//
// Extracted because three modals need the same four things (busy, error,
// close-on-success, confirmation) and each hand-rolled copy is a chance for one
// of them to quietly stop closing.

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function useModalForm(action, { onSuccess, successMessage } = {}) {
  const formRef = useRef(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);

  // `busy` state drives the disabled button, but state updates are async: a
  // fast double-click can fire the second submit before React has re-rendered,
  // sending the same save twice. A ref changes synchronously, so it closes that
  // window.
  const inFlight = useRef(false);

  const submit = useCallback(async (e) => {
    e.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");

    try {
      const data = new FormData(formRef.current);
      await action(data);

      onSuccess?.();
      if (successMessage) {
        setToast({
          kind: "success",
          message: typeof successMessage === "function" ? successMessage(data) : successMessage,
        });
      }
      // Pull the fresh server-rendered rows in behind the closed modal.
      router.refresh();
    } catch (err) {
      // A server action that redirects signals it by throwing. That's a
      // success pretending to be a failure: the work is done and Next is about
      // to navigate. Close first — otherwise the modal survives the navigation
      // and sits open over the page it redirected to — then rethrow so Next
      // can complete the redirect.
      if (err?.digest?.startsWith?.("NEXT_REDIRECT")) {
        onSuccess?.();
        throw err;
      }
      setError(err?.message || "Couldn't save. Please try again.");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, [action, onSuccess, successMessage, router]);

  return {
    formRef,
    busy,
    error,
    setError,
    toast,
    clearToast: useCallback(() => setToast(null), []),
    submit,
  };
}
