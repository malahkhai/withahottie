"use client";
import { useEffect, useState } from "react";
// Tab-local only: never put private request text in URLs, analytics or auth metadata.
export function useRequestDraft(handle: string, kind: string) {
  const key = `replypass:draft:${handle}:${kind}`;
  const [message, update] = useState("");
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        const saved = JSON.parse(sessionStorage.getItem(key) || "null");
        if (
          saved &&
          Date.now() - saved.at < 86400000 &&
          typeof saved.message === "string"
        )
          update(saved.message);
        else sessionStorage.removeItem(key);
      } catch {
        /* Storage may be unavailable; keep the form usable. */
      }
    });
    return () => {
      active = false;
    };
  }, [key]);
  function setMessage(value: string) {
    update(value);
    try {
      sessionStorage.setItem(
        key,
        JSON.stringify({ message: value, at: Date.now() }),
      );
    } catch {}
  }
  function clearDraft() {
    setMessage("");
    try {
      sessionStorage.removeItem(key);
    } catch {}
  }
  return { message, setMessage, clearDraft };
}
