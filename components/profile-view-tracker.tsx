"use client";

import { useEffect } from "react";

export function ProfileViewTracker({ creatorId }: { creatorId: string }) {
  useEffect(() => {
    const key = `replypass:profile-view:${creatorId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      return;
    }
    void fetch("/api/analytics/profile-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creatorId }),
      keepalive: true,
    }).then((response) => {
      if (!response.ok) {
        try {
          sessionStorage.removeItem(key);
        } catch {}
      }
    });
  }, [creatorId]);
  return null;
}
