"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { authOrigin } from "@/lib/site";
import { Button } from "./ui";
import { Icon } from "./icon";

export function ForgotPasswordForm({ configured }: { configured: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = createClient();
    if (!supabase) return;
    setBusy(true);
    setError("");
    const email = String(new FormData(event.currentTarget).get("email")).trim();
    const redirectTo = `${authOrigin(location.origin)}/auth/callback?next=${encodeURIComponent("/reset-password")}`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    setBusy(false);
    if (resetError) {
      setError("We couldn’t send the reset email. Please try again.");
      return;
    }
    setSent(true);
  }

  if (!configured)
    return <p className="demo-notice">Password recovery requires Supabase configuration.</p>;

  if (sent)
    return (
      <div className="demo-notice" role="status">
        <strong>Check your email.</strong>
        <p>If an account exists for that address, we sent a password reset link.</p>
      </div>
    );

  return (
    <>
      <form className="auth-form" onSubmit={submit}>
        <label>
          Email address
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <Button disabled={busy}>
          {busy ? "Sending…" : "Send reset link"} <Icon name="arrow" size={18} />
        </Button>
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}
      <p className="auth-switch"><Link href="/login">Back to login</Link></p>
    </>
  );
}

export function ResetPasswordForm({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function prepare() {
      const supabase = createClient();
      if (!supabase) return;
      const hash = new URLSearchParams(location.hash.slice(1));
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      if (accessToken && refreshToken && hash.get("type") === "recovery") {
        history.replaceState({}, "", `${location.pathname}${location.search}`);
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (sessionError) {
          if (active) setError("This reset link is invalid or expired. Request a new one.");
          return;
        }
      }
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (data.session) setReady(true);
      else setError("This reset link is invalid or expired. Request a new one.");
    }
    void prepare();
    return () => { active = false; };
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password"));
    const confirmation = String(data.get("confirmation"));
    if (password.length < 12) {
      setError("Use at least 12 characters.");
      return;
    }
    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }
    const supabase = createClient();
    if (!supabase) return;
    setBusy(true);
    setError("");
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setBusy(false);
      return;
    }
    await supabase.auth.signOut({ scope: "local" });
    router.replace("/login?password=updated");
    router.refresh();
  }

  if (!configured)
    return <p className="demo-notice">Password recovery requires Supabase configuration.</p>;

  return (
    <>
      {ready ? (
        <form className="auth-form" onSubmit={submit}>
          <label>
            New password
            <input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required />
            <span className="field-hint">At least 12 characters.</span>
          </label>
          <label>
            Confirm new password
            <input name="confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={128} required />
          </label>
          <Button disabled={busy}>{busy ? "Updating…" : "Update password"} <Icon name="arrow" size={18} /></Button>
        </form>
      ) : !error ? (
        <p role="status">Checking your reset link…</p>
      ) : null}
      {error && <p className="form-error" role="alert">{error} <Link href="/forgot-password">Send another reset link</Link></p>}
    </>
  );
}
