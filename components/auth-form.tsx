"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "./ui";
import { Icon } from "./icon";
export function AuthForm({
  mode,
  configured,
  next = "/account",
}: {
  mode: "login" | "signup";
  configured: boolean;
  next?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  async function demo(role: "fan" | "creator") {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error);
      router.push(next === "/creator/apply" ? next : data.next);
      router.refresh();
    } catch {
      setError("Could not start the demo. Try again.");
    } finally {
      setBusy(false);
    }
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const supabase = createClient();
    if (!supabase) {
      setBusy(false);
      return;
    }
    try {
      const email = String(data.get("email")).trim();
      const password = String(data.get("password"));
      const result =
        mode === "login"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({
              email,
              password,
              options: {
                data: { display_name: String(data.get("name")).trim() },
                emailRedirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
              },
            });
      if (result.error) throw result.error;
      if (result.data.session) {
        router.push(`/auth/continue?next=${encodeURIComponent(next)}`);
        router.refresh();
      } else
        setFeedback(
          "Check your email to confirm your account. Your creator setup will be waiting here.",
        );
    } catch (error) {
      setError(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {configured ? (
        <form onSubmit={submit} className="auth-form">
          {mode === "signup" && (
            <label>
              Your name
              <input name="name" autoComplete="name" maxLength={80} required />
            </label>
          )}
          <label>
            Email address
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              minLength={mode === "signup" ? 12 : 1}
              maxLength={128}
              required
            />
            {mode === "signup" && (
              <span className="field-hint">At least 12 characters.</span>
            )}
          </label>
          <Button disabled={busy}>
            {busy
              ? "One moment…"
              : mode === "login"
                ? "Log in"
                : "Create account"}
            <Icon name="arrow" size={18} />
          </Button>
        </form>
      ) : (
        <div className="demo-auth">
          <div className="demo-notice">
            <strong>Explore ReplyPass</strong>
            <p>
              Local demo mode. No real account or password is needed. Your demo
              session stays in this browser.
            </p>
          </div>
          <Button disabled={busy} onClick={() => demo("creator")}>
            Explore creator demo <Icon name="arrow" size={18} />
          </Button>
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => demo("fan")}
          >
            Explore fan demo
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {feedback && (
        <p role="status" className="form-success">
          {feedback}
        </p>
      )}
      <p className="auth-switch">
        {mode === "login" ? (
          <>
            New here?{" "}
            <Link href={`/signup?next=${encodeURIComponent(next)}`}>
              Join ReplyPass
            </Link>
          </>
        ) : (
          <>
            Already here?{" "}
            <Link href={`/login?next=${encodeURIComponent(next)}`}>Log in</Link>
          </>
        )}
      </p>
    </>
  );
}
