"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function LogoutButton() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <>
      <button
        className="logout-button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await fetch("/api/auth/logout", { method: "POST" });
            if (!r.ok) throw Error();
            router.push("/login");
            router.refresh();
          } catch {
            setError("Logout failed. Try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Logging out…" : "Log out"}
      </button>
      {error && <span role="alert">{error}</span>}
    </>
  );
}
