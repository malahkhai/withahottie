"use client";
import { useState } from "react";
import { Button } from "./ui";
export function PayoutSetup({ connected = false }: { connected?: boolean }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="payout-primary-action">
      <Button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await fetch("/api/creator/payouts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: "{}",
            });
            const data = await r.json();
            if (!r.ok) throw Error(data.error);
            location.assign(data.url);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Try again.");
            setBusy(false);
          }
        }}
      >
        {busy
          ? "Opening Stripe…"
          : connected
            ? "Continue Stripe setup"
            : "Set up payouts"}
      </Button>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <p className="payout-redirect-note">
        You’ll continue on Stripe’s secure website.
      </p>
    </div>
  );
}
