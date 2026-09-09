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
}: {
  mode: "login" | "signup" | "apply";
  configured: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setFeedback("");
    const form = new FormData(event.currentTarget);
    if (!configured) {
      setFeedback(
        mode === "apply"
          ? "Application preview complete. Nothing was submitted. Creator applications will open when the platform is connected."
          : "You’re exploring the demo. No account was created or signed in. Visit Stella to try the experience.",
      );
      return;
    }
    // Applications are a UI preview until an approved moderation workflow exists.
    if (mode === "apply") {
      setFeedback(
        "Creator applications are not open yet. This preview has not submitted your information.",
      );
      return;
    }
    const supabase = createClient();
    if (!supabase) {
      setError("Authentication is unavailable. Please try again later.");
      return;
    }
    setBusy(true);
    try {
      const email = String(form.get("email")).trim();
      const password = String(form.get("password"));
      const result =
        mode === "login"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({
              email,
              password,
              options: {
                data: { display_name: String(form.get("name")).trim() },
                emailRedirectTo: `${location.origin}/auth/callback`,
              },
            });
      if (result.error) throw result.error;
      if (mode === "login" || result.data.session) {
        router.push("/@stella");
        router.refresh();
      } else
        setFeedback(
          "Check your email to confirm your account, then come say hello.",
        );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to sign in. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <form onSubmit={submit} className="auth-form">
        {mode !== "login" && (
          <label htmlFor="name">
            Your name
            <input
              id="name"
              name="name"
              autoComplete="name"
              maxLength={80}
              required
              placeholder="Your name"
            />
          </label>
        )}
        <label htmlFor="email">
          Email address
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
          />
        </label>
        {mode !== "apply" && (
          <label htmlFor="password">
            Password
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              minLength={mode === "signup" ? 12 : 1}
              maxLength={128}
              required
              placeholder={
                mode === "signup" ? "At least 12 characters" : "Your password"
              }
            />
          </label>
        )}
        {mode === "apply" && (
          <>
            <label htmlFor="social">
              Your social profile
              <input
                id="social"
                name="social"
                type="url"
                required
                placeholder="https://instagram.com/you"
              />
            </label>
            <label htmlFor="about">
              Tell us about your community
              <textarea
                id="about"
                name="about"
                maxLength={2000}
                required
                rows={3}
                placeholder="What do you love sharing?"
              />
            </label>
          </>
        )}
        {(!configured || mode === "apply") && (
          <div className="demo-notice">
            {mode === "apply"
              ? "Application preview. Your details won’t be saved or submitted yet."
              : "Demo mode. You can explore without an account. Login and signup will be enabled when authentication is connected."}
          </div>
        )}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <Button disabled={busy} type="submit">
          {busy
            ? "One moment…"
            : mode === "login"
              ? "Log in"
              : mode === "signup"
                ? "Create account"
                : "Preview application"}
          <Icon name="arrow" size={18} />
        </Button>
        {feedback && (
          <div role="status" className="form-success">
            {feedback} <Link href="/@stella">Meet Stella →</Link>
          </div>
        )}
      </form>
      <p className="auth-switch">
        {mode === "login" ? (
          <>
            New here? <Link href="/signup">Join Withahottie</Link>
          </>
        ) : (
          <>
            Already part of the club? <Link href="/login">Log in</Link>
          </>
        )}
      </p>
    </>
  );
}
