"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useWorkspace } from "./workspace-provider";
import { WorkspaceHeading } from "./creator-workspace";
import { Badge, Button, Price } from "./ui";
import { Icon } from "./icon";
import { LogoutButton } from "./logout-button";
import type { PublicCreator } from "@/types/creator";
type SavedCreator = { id: string; name: string; handle: string };
const savedKey = "replypass:saved";
function demoSaved(fallback: SavedCreator[]): SavedCreator[] {
  try {
    const raw = localStorage.getItem(savedKey);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
export function FanAccount({
  saved,
}: {
  saved: { id: string; name: string; handle: string }[];
}) {
  const { data, send } = useWorkspace();
  const [tab, setTab] = useState("Messages");
  const [active, setActive] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savedItems, setSavedItems] = useState(saved);
  useEffect(() => {
    if (data.demo)
      void Promise.resolve().then(() => setSavedItems(demoSaved(saved)));
  }, [data.demo, saved]);
  const conversations = data.demo
    ? data.conversations.filter((c) => c.fanId === "alex")
    : data.conversations;
  const requests = data.demo
    ? data.requests.filter((r) => r.fanId === "alex")
    : data.requests;
  const selected = conversations.find((c) => c.id === active);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await send(active, message);
      setMessage("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to send.");
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    if (data.demo) {
      const next = savedItems.filter((x) => x.id !== id);
      try {
        localStorage.setItem(savedKey, JSON.stringify(next));
        setSavedItems(next);
      } catch {
        setError("Browser storage is full. Please try again.");
      }
      return;
    }
    const r = await fetch("/api/account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unsave", creatorId: id }),
    });
    if (r.ok) setSavedItems((items) => items.filter((x) => x.id !== id));
    else setError("Could not update saved creators.");
  }
  return (
    <main id="main" className="fan-account">
      <WorkspaceHeading
        eyebrow="YOUR LITTLE CORNER"
        title={`Hey, ${data.viewer.displayName.split(" ")[0]}.`}
        description="The people you follow. The conversations you keep."
      >
        {data.demo && <Badge>DEMO ACCOUNT</Badge>}
      </WorkspaceHeading>
      <div
        className="account-tabs"
        role="tablist"
        aria-label="Account sections"
      >
        {[
          "Messages",
          "Requests",
          "Subscriptions",
          "Purchases",
          "Saved creators",
          "Settings",
        ].map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => {
              setTab(t);
              setActive("");
            }}
          >
            {t}
          </button>
        ))}
      </div>
      <section className="account-panel" role="tabpanel">
        {tab === "Messages" && !selected && (
          <>
            {conversations.map((c) => (
              <button
                className="conversation-row"
                key={c.id}
                onClick={() => setActive(c.id)}
              >
                <span className="initial-avatar sage">
                  {data.demo
                    ? "SM"
                    : data.fans.find((f) => f.id === c.fanId)?.name[0] || "R"}
                </span>
                <div className="conversation-summary">
                  <strong>
                    {data.demo
                      ? "Stella May"
                      : data.fans.find((f) => f.id === c.fanId)?.name ||
                        "Creator"}
                  </strong>
                  <p>{c.messages.at(-1)?.body}</p>
                </div>
                <Icon name="arrow" size={17} />
              </button>
            ))}
            {!conversations.length && (
              <AccountEmpty text="Your conversations will appear here." />
            )}
          </>
        )}
        {tab === "Messages" && selected && (
          <>
            <button className="back-link" onClick={() => setActive("")}>
              ← All messages
            </button>
            <div className="message-list">
              {selected.messages.map((m) => (
                <div
                  className={`message-line ${m.senderId === data.viewer.id ? "own" : ""}`}
                  key={m.id}
                >
                  <div className="message-bubble">
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
            </div>
            <form onSubmit={submit} className="message-composer">
              <input
                aria-label="Message creator"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={10000}
                placeholder="Say a little hello…"
              />
              <Button disabled={busy || !message.trim()}>
                Send <Icon name="arrow" />
              </Button>
            </form>
          </>
        )}
        {tab === "Requests" && (
          <>
            {requests.map((r) => (
              <div className="fan-request" key={r.id}>
                <div>
                  <Badge>{r.status}</Badge>
                  <h3>{r.kind.replaceAll("_", " ")} request</h3>
                  <p>{r.body}</p>
                </div>
                <Price cents={r.amountCents} decimals />
              </div>
            ))}
            {!requests.length && (
              <AccountEmpty text="Your requests will appear here after you reach out." />
            )}
          </>
        )}
        {tab === "Subscriptions" && (
          <>
            {data.subscribers
              .filter((s) => !data.demo || s.fanId === "jordan")
              .map((s) => (
                <div className="setting-row" key={s.id}>
                  <div>
                    <strong>
                      {data.demo ? "Stella May VIP" : "VIP membership"}
                    </strong>
                    <p>{s.status} · Basic messaging and private posts</p>
                  </div>
                  <Price cents={s.amountCents} unit="/month" />
                </div>
              ))}
            {!data.subscribers.length && (
              <AccountEmpty text="No subscriptions yet. Find a creator you want to stay closer to." />
            )}
            <p className="workspace-footnote">
              Subscriptions are shown for context. Billing changes are not
              enabled in Task 2.
            </p>
          </>
        )}
        {tab === "Purchases" && (
          <>
            {requests
              .filter((r) => r.status === "completed")
              .map((r) => (
                <div className="setting-row" key={r.id}>
                  <div>
                    <strong>{r.kind.replaceAll("_", " ")} request</strong>
                    <p>
                      {data.demo
                        ? "Demo purchase · No real charge"
                        : r.paymentStatus}
                    </p>
                  </div>
                  <Price cents={r.amountCents} decimals />
                </div>
              ))}
            {!requests.some((r) => r.status === "completed") && (
              <AccountEmpty text="Your completed purchases will live here." />
            )}
          </>
        )}
        {tab === "Saved creators" && (
          <>
            {savedItems.map((c) => (
              <div className="saved-row" key={c.id}>
                <Link href={`/@${c.handle}`}>
                  <span className="initial-avatar sage">
                    {c.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </span>
                  <div>
                    <strong>{c.name}</strong>
                    <span>@{c.handle}</span>
                  </div>
                </Link>
                <button
                  className="icon-button"
                  aria-label={`Unsave ${c.name}`}
                  onClick={() => remove(c.id)}
                >
                  <Icon name="heart" />
                </button>
              </div>
            ))}
            {!savedItems.length && (
              <AccountEmpty text="Save a creator from their page to find them here." />
            )}
          </>
        )}
        {tab === "Settings" && (
          <div className="settings-panel">
            <div className="setting-row">
              <div>
                <strong>{data.viewer.displayName}</strong>
                <p>
                  {data.demo
                    ? "Demo session. No real account was created."
                    : "Signed in with Supabase."}
                </p>
              </div>
              <Badge>{data.viewer.role}</Badge>
            </div>
            <Link href="/creator/apply" className="setting-row">
              Turn your attention into income <Icon name="arrow" />
            </Link>
            <LogoutButton />
          </div>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </section>
      <Link className="fan-discover" href="/@stella">
        Find your next conversation <Icon name="arrow" size={17} />
      </Link>
    </main>
  );
}
function AccountEmpty({ text }: { text: string }) {
  return (
    <div className="workspace-empty">
      <Icon name="heart" size={28} />
      <h3>A little space for what’s next.</h3>
      <p>{text}</p>
      <Link href="/@stella">Meet Stella →</Link>
    </div>
  );
}
export function SaveCreator({ creator }: { creator: PublicCreator }) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (creator.demo)
      void Promise.resolve().then(() =>
        setSaved(
          demoSaved([
            { id: "stella", name: "Stella May", handle: "stella" },
          ]).some((c) => c.id === creator.id),
        ),
      );
  }, [creator.demo, creator.id]);
  const [error, setError] = useState("");
  return (
    <div className="save-creator">
      <button
        className="button button-secondary"
        onClick={async () => {
          try {
            const r = await fetch("/api/account", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: saved ? "unsave" : "save",
                creatorId: creator.id,
              }),
            });
            if (r.status === 401) {
              router.push("/login");
              return;
            }
            if (!r.ok) throw Error();
            const result = await r.json();
            if (result.demo) {
              const items = demoSaved([
                { id: "stella", name: "Stella May", handle: "stella" },
              ]).filter((c) => c.id !== creator.id);
              if (!saved)
                items.push({
                  id: creator.id,
                  name: creator.name,
                  handle: creator.handle.replace(/^@/, ""),
                });
              localStorage.setItem(savedKey, JSON.stringify(items));
            }
            setSaved(!saved);
          } catch {
            setError("Please try again.");
          }
        }}
      >
        <Icon name="heart" size={17} />
        {saved ? "Saved" : "Save creator"}
      </button>
      {error && <span role="alert">{error}</span>}
    </div>
  );
}
