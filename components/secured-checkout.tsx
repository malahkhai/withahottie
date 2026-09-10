"use client";
import { useState } from "react";
import Link from "next/link";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Button, Price, Badge } from "./ui";
import type { PublicCreator } from "@/types/creator";
const stripePromise =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.startsWith("pk_test_")
    ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)
    : null;
type Quote = {
  id: string;
  clientSecret: string;
  amountCents: number;
  currency: string;
};
export function SecuredCheckout({ creator }: { creator: PublicCreator }) {
  const [message, setMessage] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function prepare(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const fingerprint = Array.from(
        new Uint8Array(
          await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(message.trim()),
          ),
        ),
      )
        .map((n) => n.toString(16).padStart(2, "0"))
        .join("");
      const key = `replypass:attempt:${creator.id}`;
      let saved;
      try {
        saved = JSON.parse(sessionStorage.getItem(key) || "null");
      } catch {}
      const attemptKey =
        saved?.fingerprint === fingerprint
          ? saved.attemptKey
          : crypto.randomUUID();
      sessionStorage.setItem(key, JSON.stringify({ fingerprint, attemptKey }));
      const r = await fetch("/api/payments/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorId: creator.id, attemptKey, message }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      setQuote(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  if (!stripePromise)
    return (
      <p role="alert">
        Test payment setup is unavailable. No payment was submitted.
      </p>
    );
  return (
    <div className="checkout-form">
      <Badge>STRIPE TEST MODE</Badge>
      {!quote ? (
        <form onSubmit={prepare} className="auth-form">
          <p>
            You’re requesting a guaranteed reply. We’ll temporarily reserve the
            price on your payment method. You’re only charged if{" "}
            {creator.name.split(" ")[0]} replies.
          </p>
          <label>
            What do you want to say?
            <textarea
              required
              maxLength={2000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
            />
          </label>
          <Button disabled={busy}>
            {busy ? "Checking availability…" : "Continue to payment"}
          </Button>
        </form>
      ) : (
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret: quote.clientSecret,
            appearance: {
              theme: "stripe",
              variables: { colorPrimary: "#d6483c", borderRadius: "14px" },
            },
          }}
        >
          <Confirmation quote={quote} name={creator.name.split(" ")[0]} />
        </Elements>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error} <Link href="/login">Sign in</Link>
        </p>
      )}
      <p className="checkout-footnote">
        No reply = no charge. Test cards only.
      </p>
    </div>
  );
}
function Confirmation({ quote, name }: { quote: Quote; name: string }) {
  const stripe = useStripe(),
    elements = useElements();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [reserved, setReserved] = useState(false),
    [confirmed, setConfirmed] = useState(false),
    [expires, setExpires] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setError("");
    try {
      if (!confirmed) {
        const result = await stripe.confirmPayment({
          elements,
          confirmParams: { return_url: `${location.origin}/account/requests` },
          redirect: "if_required",
        });
        if (result.error)
          throw Error(
            result.error.message ||
              "Your card could not be authorized. No request was sent.",
          );
        setConfirmed(true);
      }
      const response = await fetch(`/api/payments/reply/${quote.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const result = await response.json();
      if (!response.ok || !result.secured)
        throw Error(
          result.error ||
            "We are checking your reservation. Check your requests before starting another payment.",
        );
      setExpires(result.expiresAt);
      setReserved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  if (reserved)
    return (
      <div className="checkout-done" role="status">
        <h3>Request sent ✓</h3>
        <p>
          <Price cents={quote.amountCents} currency={quote.currency} /> has been
          temporarily reserved. You haven’t been charged.
        </p>
        <p>
          {name} has until {new Date(expires).toLocaleString()} to reply. If
          they don’t reply, the reservation will be released automatically.
        </p>
        <strong>No reply = no charge.</strong>
        <Link className="button" href="/account/requests">
          View my requests
        </Link>
      </div>
    );
  return (
    <form className="auth-form" onSubmit={submit}>
      <p>
        We’ll temporarily reserve{" "}
        <Price cents={quote.amountCents} currency={quote.currency} />. You’re
        only charged if {name} replies.
      </p>
      <PaymentElement options={{ layout: "tabs" }} />
      <Button disabled={!stripe || busy}>
        {busy ? (
          "Checking reservation…"
        ) : confirmed ? (
          "Check reservation"
        ) : (
          <>
            Request reply —{" "}
            <Price cents={quote.amountCents} currency={quote.currency} />
          </>
        )}
      </Button>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </form>
  );
}
