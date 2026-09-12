"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "./workspace-provider";
import { Icon } from "./icon";
import { Badge, Button, Price } from "./ui";
import {
  splitPayment,
  PLATFORM_FEE_PERCENT,
  CREATOR_SHARE_PERCENT,
} from "@/lib/payments/fees";
import { expiryLabel, requestState } from "@/lib/requests";
import { createClient } from "@/lib/supabase/client";
import { catalog } from "@/lib/creators/catalog";
import type {
  CreatorRequest,
  Conversation,
  Fan,
  RequestState,
} from "@/types/creator";
import { creatorNav } from "./workspace-shell";
import { CreatorEditor } from "./creator-editor";
import { LogoutButton } from "./logout-button";
export function WorkspaceHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="workspace-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children}
    </div>
  );
}
export function FanAvatar({ fan }: { fan?: Fan }) {
  return (
    <span
      className={`initial-avatar ${fan?.color || "sage"}`}
      aria-label={fan?.name || "Member"}
    >
      {(fan?.name || "Member")
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)}
    </span>
  );
}
function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="workspace-empty">
      <Icon name="message" size={28} />
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}
export function RequestCard({
  request,
  compact = false,
}: {
  request: CreatorRequest;
  compact?: boolean;
}) {
  const { data, respond } = useWorkspace();
  const [now, setNow] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const fan = data.fans.find((f) => f.id === request.fanId);
  const state = now === null ? request.status : requestState(request, now);
  const earning = request.creatorCents ?? splitPayment(request.amountCents).creatorCents;
  const title =
    catalog.find((c) => c.kind === request.kind)?.title || "Request";
  async function act(action: string) {
    setBusy(true);
    setError("");
    try {
      await respond(request.id, action);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className={`request-card ${compact ? "compact" : ""}`}>
      <div className="request-card-top">
        <FanAvatar fan={fan} />
        <div>
          <strong>{fan?.name || "Member"}</strong>
          <span>@{fan?.username || "member"}</span>
        </div>
        <Badge className={`request-status status-${state}`}>{state}</Badge>
      </div>
      <h3>
        {fan?.name.split(" ")[0] || "A fan"} wants{" "}
        {request.kind === "message"
          ? "a guaranteed reply"
          : request.kind === "live_chat"
            ? "a live chat"
            : `a ${title.toLowerCase()}`}
      </h3>
      <p className="request-body">{request.body}</p>
      {request.needsReconciliation && <p role="status">Your reply is saved. Payment reconciliation is in progress; earnings are not confirmed yet.</p>}
      <div className="request-money">
        <div>
          <span>You earn if you reply</span>
          <strong>
            <Price cents={earning} currency={request.currency} decimals />
          </strong>
        </div>
        <div>
          <span>
            Fan{" "}
            {request.paymentStatus === "authorized" ? "secured" : "amount"}
          </span>
          <Price cents={request.amountCents} currency={request.currency} decimals />
        </div>
      </div>
      {["pending", "accepted"].includes(state) && (
        <p className="expiry">
          <Icon name="bolt" size={14} />
          {now === null
            ? "Time remaining…"
            : expiryLabel(request.expires_at, now)}
        </p>
      )}
      {state === "pending" && (
        <div className="request-actions">
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => act("decline")}
          >
            Decline
          </Button>
          <Button disabled={busy} onClick={() => act("accept")}>
            {busy ? "Updating…" : "Accept"}
            <Icon name="check" size={16} />
          </Button>
        </div>
      )}
      {state === "accepted" && !data.demo && request.conversationId && <Link className="button" href={`/creator/inbox/${request.conversationId}`}>Reply to earn</Link>}
      {state === "accepted" && data.demo && (
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => act("complete")}
        >
          Mark completed <Icon name="check" size={16} />
        </Button>
      )}
      {state === "completed" && (
        <p className="request-result">
          Completed{" "}
          {request.completed_at
            ? new Date(request.completed_at).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
              })
            : ""}
        </p>
      )}
      {["declined", "expired"].includes(state) && (
        <p className="request-result">
          {state === "declined" ? "Declined." : "Time ran out."} No payment
          action taken.
        </p>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
    </article>
  );
}
export function DashboardHome() {
  const { data } = useWorkspace();
  const pending = data.requests.filter((r) => r.status === "pending");
  return (
    <>
      <WorkspaceHeading
        eyebrow="YOUR PEOPLE ARE HERE"
        title={`Good to see you, ${data.creator.displayName.split(" ")[0]}.`}
        description="A little attention can make someone’s day."
      >
        <Link
          href={`/@${data.creator.username}`}
          className="button button-secondary"
        >
          View your page <Icon name="arrow" size={17} />
        </Link>
      </WorkspaceHeading>
      <div className="today-label">
        Today{" "}
        <span>
          {data.demo
            ? "A snapshot of your demo community"
            : "Your latest activity"}
        </span>
      </div>
      <div className="metric-grid">
        <Metric
          label="Earned"
          value={<Price cents={data.earnedToday} />}
          note={`Your ${CREATOR_SHARE_PERCENT}% share`}
          icon="star"
        />
        <Metric
          label="Open requests"
          value={pending.length}
          note="Make a connection"
          icon="bolt"
        />
        <Metric
          label="Waiting for reply"
          value={data.conversations.filter((c) => c.unread > 0).length}
          note="People in your inbox"
          icon="message"
        />
        <Metric
          label="Profile views"
          value={data.demo ? data.profileViews : "—"}
          note={
            data.demo ? "A little more discovery" : "Tracking not connected"
          }
          icon="user"
        />
      </div>
      <div className="dashboard-columns">
        <section>
          <div className="section-line">
            <h2>Your next conversations</h2>
            <Link href="/creator/requests">
              View all <Icon name="arrow" size={15} />
            </Link>
          </div>
          <div className="request-grid">
            {pending.slice(0, 2).map((r) => (
              <RequestCard key={r.id} request={r} compact />
            ))}
          </div>
          {pending.length === 0 && (
            <Empty
              title="You’re all caught up."
              body="Share your ReplyPass to start your next conversation."
            />
          )}
          <div className="section-line">
            <h2>Keep the conversation going</h2>
            <Link href="/creator/inbox">
              Open inbox <Icon name="arrow" size={15} />
            </Link>
          </div>
          <div className="inbox-preview">
            {data.conversations.slice(0, 3).map((c) => (
              <ConversationRow key={c.id} conversation={c} />
            ))}
          </div>
        </section>
        <aside className="dashboard-aside">
          <div className="community-card">
            <Badge>YOUR INNER CIRCLE</Badge>
            <Icon name="sparkles" size={28} />
            <h2>
              Good people.
              <br />
              Closer connections.
            </h2>
            <p>
              {data.subscribers.length} members have a monthly pass to your
              world.
            </p>
            <Link href="/creator/subscribers">
              Meet your VIPs <Icon name="arrow" size={16} />
            </Link>
          </div>
          <RevenueCard />
          <div className="quiet-note">
            <Icon name="shield" />
            <p>
              <strong>Your time stays yours.</strong>
              <br />
              Accept what works for you. Decline what doesn’t.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
function Metric({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  note: string;
  icon: React.ComponentProps<typeof Icon>["name"];
}) {
  return (
    <div className="metric-card">
      <span>
        <Icon name={icon} size={17} />
        {label}
      </span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
function RevenueCard() {
  const { data } = useWorkspace();
  const max = Math.max(...data.revenue, 1);
  return (
    <div className="revenue-card">
      <div>
        <h3>This week</h3>
        <Badge>{data.demo ? "DEMO" : "EARNINGS"}</Badge>
      </div>
      <strong>
        <Price cents={data.revenue.reduce((a, b) => a + b, 0)} decimals />
      </strong>
      <div
        className="revenue-bars"
        role="img"
        aria-label={`Seven-day creator revenue: ${data.revenue.map((n) => "€" + (n / 100).toFixed(2)).join(", ")}`}
      >
        {data.revenue.map((n, i) => (
          <div key={i}>
            <span style={{ height: `${Math.max((n / max) * 100, 3)}%` }} />
            <small>{["M", "T", "W", "T", "F", "S", "S"][i]}</small>
          </div>
        ))}
      </div>
      <p>
        {data.demo
          ? "Fictional earnings. No real money moved."
          : "Settled interactions only. No new payments are processed."}
      </p>
    </div>
  );
}
export function RequestsPage() {
  const { data } = useWorkspace();
  const [tab, setTab] = useState<RequestState>("pending");
  const [now, setNow] = useState<number | undefined>(undefined);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const requests = data.requests.map((r) => ({
    ...r,
    status: now === undefined ? r.status : requestState(r, now),
  }));
  return (
    <>
      <WorkspaceHeading
        eyebrow="MAKE SOMEONE’S DAY"
        title="Your requests."
        description="Real attention starts with a small yes."
      />
      <div
        className="workspace-tabs"
        role="tablist"
        aria-label="Request status"
      >
        {(["pending", "accepted", "completed", "expired"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={t === tab}
            onClick={() => setTab(t)}
          >
            {t}
            <span>
              {
                requests.filter(
                  (r) =>
                    r.status === t ||
                    (t === "expired" && r.status === "declined"),
                ).length
              }
            </span>
          </button>
        ))}
      </div>
      <div className="request-grid full" role="tabpanel">
        {requests
          .filter(
            (r) =>
              r.status === tab ||
              (tab === "expired" && r.status === "declined"),
          )
          .map((r) => (
            <RequestCard key={r.id} request={r} />
          ))}
      </div>
      {!requests.some(
        (r) =>
          r.status === tab || (tab === "expired" && r.status === "declined"),
      ) && (
        <Empty
          title={`No ${tab} requests.`}
          body="New connections will appear here when they’re ready."
        />
      )}
      <p className="workspace-footnote">
        {PLATFORM_FEE_PERCENT}% platform fee · You keep {CREATOR_SHARE_PERCENT}
        %. Accepting or completing a request does not capture a payment.
      </p>
    </>
  );
}
function ConversationRow({ conversation }: { conversation: Conversation }) {
  const { data } = useWorkspace();
  const fan = data.fans.find((f) => f.id === conversation.fanId);
  const last = conversation.messages.at(-1);
  return (
    <Link
      href={`/creator/inbox/${conversation.id}`}
      className="conversation-row"
    >
      <FanAvatar fan={fan} />
      <div className="conversation-summary">
        <div>
          <strong>{fan?.name || "Member"}</strong>
          {fan?.vip && <Badge>VIP</Badge>}
        </div>
        <p>{last?.body || "Start a conversation."}</p>
      </div>
      <div className="conversation-meta">
        <time>
          {last
            ? new Date(last.createdAt).toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              })
            : ""}
        </time>
        {conversation.unread > 0 && (
          <span
            className="unread-dot"
            aria-label={`${conversation.unread} unread messages`}
          />
        )}
      </div>
    </Link>
  );
}
export function InboxPage() {
  const { data } = useWorkspace();
  const [search, setSearch] = useState("");
  const conversations = data.conversations.filter((c) => {
    const fan = data.fans.find((f) => f.id === c.fanId);
    return (fan?.name || "").toLowerCase().includes(search.toLowerCase());
  });
  return (
    <>
      <WorkspaceHeading
        eyebrow="GOOD CONVERSATIONS LIVE HERE"
        title="Your inbox."
        description="Less noise. More connection."
      />
      <label className="inbox-search">
        <Icon name="message" size={18} />
        <input
          aria-label="Search conversations"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Find a conversation…"
        />
      </label>
      <div className="inbox-list">
        {conversations.map((c) => (
          <ConversationRow key={c.id} conversation={c} />
        ))}
      </div>
      {!conversations.length && (
        <Empty
          title="A little quiet here."
          body={
            search
              ? "No conversations match that name."
              : "Your conversations will appear here."
          }
        />
      )}
    </>
  );
}
export function ConversationPage({ id }: { id: string }) {
  const { data, send } = useWorkspace();
  const initial = data.conversations.find((c) => c.id === id);
  const [live, setLive] = useState<Conversation | null>(null);
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [connection, setConnection] = useState(
    data.demo ? "Demo conversation" : "Connecting…",
  );
  const end = useRef<HTMLDivElement>(null);
  const conversation = live || initial;
  const fan = data.fans.find((f) => f.id === conversation?.fanId);
  useEffect(() => {
    if (data.demo) return;
    const supabase = createClient();
    if (!supabase) return;
    async function refresh() {
      try {
        const r = await fetch(`/api/conversations/${id}`);
        if (r.ok) setLive(await r.json());
      } catch {
        setConnection("Connection interrupted. Refresh to retry.");
      }
    }
    const channel = supabase
      .channel(`conversation:${id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${id}`,
        },
        refresh,
      )
      .subscribe((status) =>
        setConnection(
          status === "SUBSCRIBED"
            ? "Connected"
            : status === "CHANNEL_ERROR"
              ? "Connection interrupted. Refresh to retry."
              : "Connecting…",
        ),
      );
    void supabase
      .from("conversation_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", id)
      .eq("profile_id", data.viewer.id);
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [id, data.demo, data.viewer.id]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [conversation?.messages.length]);
  if (!conversation)
    return (
      <Empty
        title="Conversation not found."
        body="This conversation isn’t available to your account."
      />
    );
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim() && !attachment) return;
    setBusy(true);
    setError("");
    try {
      await send(id, text.trim() || "Shared an image", attachment || undefined);
      setText("");
      setAttachment("");
      if (!data.demo) {
        const r = await fetch(`/api/conversations/${id}`);
        if (r.ok) setLive(await r.json());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Message not sent. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="conversation-page">
      <Link href="/creator/inbox" className="back-link">
        ← All conversations
      </Link>
      <div className="chat-header">
        <FanAvatar fan={fan} />
        <div>
          <h1>{fan?.name || "Member"}</h1>
          <span>
            @{fan?.username || "member"} · {connection}
          </span>
        </div>
        {fan?.vip && <Badge>VIP MEMBER</Badge>}
      </div>
      <div className="chat-context">
        <Icon name="shield" size={16} />
        {conversation.context}
      </div>
      <div className="message-list" aria-label="Messages">
        {conversation.messages.map((m) => (
          <div
            key={m.id}
            className={`message-line ${m.senderId === data.viewer.id ? "own" : ""}`}
          >
            <div className="message-bubble">
              {m.attachment && (
                <Image
                  src={m.attachment}
                  alt="Shared attachment"
                  width={240}
                  height={180}
                  unoptimized
                />
              )}
              <p>{m.body}</p>
              <time>
                {new Date(m.createdAt).toLocaleTimeString("en-GB", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      {attachment && (
        <div className="attachment-preview">
          <Image
            src={attachment}
            alt="Attachment preview"
            width={70}
            height={55}
            unoptimized
          />
          <button onClick={() => setAttachment("")}>Remove attachment</button>
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <form className="message-composer" onSubmit={submit}>
        <label className="attachment-button" title="Attach an image">
          <Icon name="camera" />
          <input
            type="file"
            aria-label="Attach an image"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (
                file.size > 1024 * 1024 ||
                !["image/png", "image/jpeg", "image/webp"].includes(file.type)
              ) {
                setError("Choose a JPG, PNG or WebP under 1 MB.");
                return;
              }
              const reader = new FileReader();
              reader.onload = () => setAttachment(String(reader.result));
              reader.readAsDataURL(file);
            }}
          />
        </label>
        <input
          aria-label="Your message"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              event.preventDefault();
              if (!busy && (text.trim() || attachment))
                event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="Give them a little of your attention…"
          maxLength={10000}
          enterKeyHint="send"
          autoComplete="off"
        />
        <Button
          disabled={busy || (!text.trim() && !attachment)}
          type="submit"
          aria-label="Send message"
        >
          <Icon name="arrow" size={20} />
        </Button>
      </form>
    </div>
  );
}
export function SubscribersPage() {
  const { data } = useWorkspace();
  return (
    <>
      <WorkspaceHeading
        eyebrow="YOUR INNER CIRCLE"
        title="Your subscribers."
        description="The people who choose to stay a little closer."
      />
      <div className="subscriber-list">
        {data.subscribers.map((s) => {
          const fan = data.fans.find((f) => f.id === s.fanId);
          return (
            <div className="subscriber-row" key={s.id}>
              <FanAvatar fan={fan} />
              <div>
                <strong>{fan?.name || "Member"}</strong>
                <span>@{fan?.username || "member"}</span>
              </div>
              <Badge>{s.status}</Badge>
              <div>
                <Price cents={s.amountCents} unit="/month" />
                <span>
                  {s.renewsAt
                    ? "Renews " +
                      new Date(s.renewsAt).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                      })
                    : "No renewal scheduled"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      {!data.subscribers.length && (
        <Empty
          title="Your inner circle starts here."
          body="Share your VIP offering with your community."
        />
      )}
    </>
  );
}
export function EarningsPage() {
  const { data } = useWorkspace();
  return (
    <>
      <WorkspaceHeading
        eyebrow="YOUR ATTENTION HAS VALUE"
        title="Your earnings."
        description="Clear numbers. Your share, always visible."
      />
      <div className="metric-grid two">
        <Metric
          label="This week"
          value={
            <Price cents={data.revenue.reduce((a, b) => a + b, 0)} decimals />
          }
          note={data.demo ? "Demo earnings" : "Settled interactions"}
          icon="star"
        />
        <Metric
          label="Your share"
          value={`${CREATOR_SHARE_PERCENT}%`}
          note={`${PLATFORM_FEE_PERCENT}% platform fee`}
          icon="shield"
        />
      </div>
      <div className="earnings-columns">
        <RevenueCard />
        <div className="fee-breakdown">
          <h2>Every €4 reply.</h2>
          <div>
            <span>Fan price</span>
            <Price cents={splitPayment(400).fanCents} decimals />
          </div>
          <div>
            <span>Platform fee · {PLATFORM_FEE_PERCENT}%</span>
            <Price cents={splitPayment(400).platformCents} decimals />
          </div>
          <div>
            <strong>You keep · {CREATOR_SHARE_PERCENT}%</strong>
            <Price cents={splitPayment(400).creatorCents} decimals />
          </div>
          <p>
            Payouts and payment processing are not enabled yet. No bank details
            are needed.
          </p>
        </div>
      </div>
    </>
  );
}
export function AnalyticsPage() {
  const { data } = useWorkspace();
  return (
    <>
      <WorkspaceHeading
        eyebrow="GET TO KNOW YOUR COMMUNITY"
        title="A closer look."
        description="Small signals from the connections you’re making."
      />
      <div className="metric-grid">
        <Metric
          label="Profile views"
          value={data.demo ? 386 : "—"}
          note={data.demo ? "Demo data" : "Tracking not connected"}
          icon="user"
        />
        <Metric
          label="Conversations"
          value={data.conversations.length}
          note="People who reached out"
          icon="message"
        />
        <Metric
          label="Completed requests"
          value={data.requests.filter((r) => r.status === "completed").length}
          note="Attention delivered"
          icon="check"
        />
        <Metric
          label="VIP members"
          value={data.subscribers.filter((s) => s.status === "active").length}
          note="Your inner circle"
          icon="heart"
        />
      </div>
      <RevenueCard />
    </>
  );
}
export function ProfileEditorPage() {
  const { data } = useWorkspace();
  return (
    <>
      <WorkspaceHeading eyebrow="MAKE IT YOURS" title="Your profile.">
        <Link
          className="button button-secondary"
          href={`/@${data.creator.username}`}
        >
          View public profile <Icon name="arrow" size={16} />
        </Link>
      </WorkspaceHeading>
      <CreatorEditor
        initial={data.creator}
        demo={data.demo}
        editing
      />
    </>
  );
}
export function SettingsPage() {
  const { data } = useWorkspace();
  return (
    <>
      <WorkspaceHeading
        eyebrow="ON YOUR TERMS"
        title="Your settings."
        description="A little control goes a long way."
      />
      <div className="settings-panel">
        <div className="setting-row">
          <div>
            <strong>Account</strong>
            <p>
              {data.viewer.displayName} · {data.viewer.role}
            </p>
          </div>
          <Badge>{data.demo ? "Demo session" : "Signed in"}</Badge>
        </div>
        <div className="setting-row">
          <div>
            <strong>Payments</strong>
            <p>Guaranteed replies can use Stripe test mode. Other services remain demo-only.</p>
          </div>
          <Badge>NOT CONNECTED</Badge>
        </div>
        <Link className="setting-row" href="/creator/profile">
          <div>
            <strong>Profile, pricing & availability</strong>
            <p>Update what you offer and when you’re around.</p>
          </div>
          <Icon name="arrow" />
        </Link>
        <div className="settings-more">
          {creatorNav
            .filter((n) =>
              ["Subscribers", "Earnings", "Analytics", "Payouts"].includes(n.name),
            )
            .map((n) => (
              <Link href={n.path} key={n.path}>
                <Icon name={n.icon} />
                {n.name}
                <Icon name="arrow" size={16} />
              </Link>
            ))}
        </div>
        <Link className="setting-row" href="/account">
          View your fan account <Icon name="arrow" />
        </Link>
        <LogoutButton />
      </div>
    </>
  );
}
