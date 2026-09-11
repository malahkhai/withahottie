"use client";

import { useLayoutEffect } from "react";

/** Handles older Supabase recovery links that return tokens to the site root. */
export function RecoveryRedirect() {
  useLayoutEffect(() => {
    if (!location.hash) return;
    const params = new URLSearchParams(location.hash.slice(1));
    if (
      params.get("type") === "recovery" &&
      params.has("access_token") &&
      params.has("refresh_token") &&
      location.pathname !== "/reset-password"
    ) {
      location.replace(`/reset-password${location.hash}`);
    }
  }, []);
  return null;
}
