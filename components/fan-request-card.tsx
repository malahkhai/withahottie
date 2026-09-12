"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "./icon";
import { Price } from "./ui";

export type FanRequestSummary = {
  id: string;
  creatorName: string;
  creatorHandle: string | null;
  creatorAvatar: string | null;
  gross_cents: number;
  currency: string;
  payment_state: string;
  expires_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  conversation_id: string | null;
  needs_reconciliation: boolean;
  created_at: string;
};

function timeRemaining(expiresAt: string) {
  const seconds = Math.max(0, Math.floor((Date.parse(expiresAt) - Date.now()) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return seconds === 0
    ? "Deadline reached"
    : `Expires in ${hours ? `${hours}:` : ""}${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function RequestCountdown({ expiresAt }: { expiresAt: string }) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    const update = () => setLabel(timeRemaining(expiresAt));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);
  return (
    <div>
      <span>{label || "Checking deadline…"}</span>
      <small>
        {label
          ? new Date(expiresAt).toLocaleString("en-GB", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })
          : ""}
      </small>
    </div>
  );
}

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function requestState(request: FanRequestSummary) {
  if (request.needs_reconciliation || request.payment_state === "disputed")
    return { label: "Under review", tone: "review", title: "We’re checking your payment", moneyLabel: "Protected", copy: "Your request is saved. Please don’t start another payment while we check it.", step: 1 };
  if (request.payment_state === "captured")
    return { label: "Replied", tone: "complete", title: "Your reply has arrived", moneyLabel: "Charged", copy: "You were charged after your creator completed the reply.", step: 3 };
  if (request.payment_state === "refunded")
    return { label: "Refunded", tone: "closed", title: "Your payment was refunded", moneyLabel: "Refunded", copy: "The refund is on its way to your original payment method.", step: 0 };
  if (request.payment_state === "canceled")
    return { label: request.declined_at ? "Declined" : "Expired", tone: "closed", title: request.declined_at ? "The creator declined this request" : "This request expired", moneyLabel: "Not charged", copy: "The reservation was released. Your bank may take a little time to remove the pending hold.", step: 0 };
  if (request.accepted_at)
    return { label: "Accepted", tone: "accepted", title: `${request.creatorName} accepted`, moneyLabel: "Reserved", copy: "Your money is still only reserved. You’ll be charged after the reply arrives.", step: 2 };
  if (request.payment_state === "authorized")
    return { label: "Waiting", tone: "waiting", title: `Waiting for ${request.creatorName}`, moneyLabel: "Reserved", copy: "A temporary hold is on your payment method. You haven’t been charged.", step: 1 };
  return { label: "Incomplete", tone: "closed", title: "Reservation not completed", moneyLabel: "Not charged", copy: "No payment was taken. Return to the creator’s page whenever you’re ready.", step: 0 };
}

export function FanRequestCard({ request }: { request: FanRequestSummary }) {
  const state = requestState(request);
  const active = request.payment_state === "authorized";
  const creatorHref = request.creatorHandle ? `/@${request.creatorHandle}` : "/account";
  return (
    <article className="fan-request-card">
      <header className="fan-request-creator">
        {request.creatorAvatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={request.creatorAvatar} alt="" />
        ) : (
          <span className="fan-request-avatar" aria-hidden="true">{initials(request.creatorName)}</span>
        )}
        <div>
          <span>Guaranteed reply</span>
          <strong>{request.creatorName}</strong>
          {request.creatorHandle && <small>@{request.creatorHandle}</small>}
        </div>
        <span className={`fan-request-status is-${state.tone}`}>{state.label}</span>
      </header>
      <div className="fan-request-lead">
        <div><h2>{state.title}</h2><p>{state.copy}</p></div>
        <div className="fan-request-amount">
          <span>{state.moneyLabel}</span>
          <Price cents={request.gross_cents} currency={request.currency} decimals />
        </div>
      </div>
      {state.step > 0 && (
        <ol className="request-progress" aria-label="Request progress">
          {[["Request sent", "Payment reserved"], ["Creator accepts", "Still no charge"], ["Reply arrives", "Payment completes"]].map(([title, detail], index) => {
            const position = index + 1;
            const done = position < state.step || state.step === 3;
            const current = position === state.step && state.step !== 3;
            return (
              <li key={title} className={done ? "is-done" : current ? "is-current" : ""}>
                <span className="request-progress-dot">{done ? <Icon name="check" size={13} /> : position}</span>
                <div><strong>{title}</strong><small>{detail}</small></div>
              </li>
            );
          })}
        </ol>
      )}
      <footer className="fan-request-actions">
        <div className="fan-request-deadline">
          {active && request.expires_at ? (
            <><Icon name="bolt" size={16} /><RequestCountdown expiresAt={request.expires_at} /></>
          ) : (
            <><Icon name="shield" size={16} /><span>No reply = no charge</span></>
          )}
        </div>
        <Link className="fan-request-button" href={request.conversation_id ? "/account" : creatorHref}>
          {request.conversation_id ? "Open messages" : "View creator"}<Icon name="arrow" size={16} />
        </Link>
      </footer>
    </article>
  );
}
