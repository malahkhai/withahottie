"use client";
import Image from "next/image";
import { useState } from "react";
import { stella, offerings, vip } from "@/lib/demo";
import type { Offering } from "@/types/domain";
import { Avatar, Badge, Button, Card, CreatorStat, Price } from "./ui";
import { Icon, type IconName } from "./icon";
import { BottomSheet } from "./bottom-sheet";
import { BottomNavigation } from "./navigation";

const titles = {
  message: "Message Stella",
  live_chat: "Live chat with Stella",
  voice_note: "A voice note from Stella",
  photo: "Request a photo",
  video: "Request a video",
  vip: "A little closer to Stella",
};
function Checkout({
  offering,
  onClose,
}: {
  offering: Offering;
  onClose: () => void;
}) {
  const [message, setMessage] = useState("");
  const [minutes, setMinutes] = useState(5);
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState("");
  const [quotedAmount, setQuotedAmount] = useState(0);
  const total = offering.cents * (offering.kind === "live_chat" ? minutes : 1);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setState("loading");
    try {
      const response = await fetch("/api/checkout/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: offering.kind, message, minutes }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error || "Something went wrong. Please try again.",
        );
      setQuotedAmount(result.amountCents);
      setState("done");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Please try again.");
      setState("idle");
    }
  }
  if (state === "done")
    return (
      <div className="checkout-done" role="status">
        <span className="success-icon">
          <Icon name="check" size={30} />
        </span>
        <Badge>Demo checkout</Badge>
        <h3>You’re all set to connect.</h3>
        <p>
          This is a preview of checkout. No payment was taken and no request was
          sent.
        </p>
        <div className="checkout-total">
          <span>Preview total</span>
          <Price cents={quotedAmount} decimals />
        </div>
        <Button onClick={onClose}>
          Back to Stella <Icon name="heart" size={17} />
        </Button>
      </div>
    );
  return (
    <form onSubmit={submit} className="checkout-form">
      <div className="checkout-creator">
        <Avatar src={stella.image} name="Stella May" />
        <div>
          <strong>
            Stella May <span className="pink">✓</span>
          </strong>
          <span>
            <i className="online-dot" /> Usually replies in ~8 min
          </span>
        </div>
        <Badge>Demo</Badge>
      </div>
      <p className="checkout-explanation">
        {offering.kind === "vip"
          ? "Your monthly pass to basic messaging and private posts. Paid requests are separate. This preview won’t start a subscription."
          : "You're paying for a guaranteed reply. If Stella doesn't accept your request, you won't be charged."}
      </p>
      {offering.kind !== "vip" && (
        <p className="promise-note">
          <Icon name="shield" size={16} /> No reply = no charge.
        </p>
      )}
      <div className="checkout-total">
        <span>
          {offering.kind === "vip" ? "Monthly membership" : offering.title}
        </span>
        <Price
          cents={total}
          decimals
          unit={offering.kind === "vip" ? "/month" : undefined}
        />
      </div>
      {offering.kind === "live_chat" && (
        <label>
          How many minutes?
          <select
            value={minutes}
            onChange={(event) => setMinutes(Number(event.target.value))}
          >
            {[5, 10, 15, 30].map((value) => (
              <option key={value} value={value}>
                {value} minutes · €{value * 3}
              </option>
            ))}
          </select>
        </label>
      )}
      {offering.kind !== "vip" && (
        <label htmlFor="request-message">
          {offering.kind === "message"
            ? "What do you want to say?"
            : "What do you have in mind?"}
          <textarea
            id="request-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={
              offering.kind === "message"
                ? "Hey Stella! I’d love to know…"
                : "Tell Stella a little about your request…"
            }
            maxLength={2000}
            required
            rows={4}
          />
          <span className="field-hint">
            Keep it kind. Make it personal. <span>{message.length}/2000</span>
          </span>
        </label>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <Button disabled={state === "loading"} type="submit">
        {state === "loading" ? (
          "Preparing preview…"
        ) : (
          <>
            Continue — <Price cents={total} /> <Icon name="arrow" size={18} />
          </>
        )}
      </Button>
      <p className="checkout-footnote">
        <Icon name="lock" size={13} /> Demo only. No card details or payment
        required.
      </p>
    </form>
  );
}
export function CreatorProfile() {
  const [selected, setSelected] = useState<Offering | null>(null);
  const [shareStatus, setShareStatus] = useState("");
  async function share() {
    try {
      if (navigator.share)
        await navigator.share({
          title: "Meet Stella May on Withahottie",
          url: location.href,
        });
      else {
        await navigator.clipboard.writeText(location.href);
        setShareStatus("Profile link copied");
      }
    } catch {
      setShareStatus("You can share the URL from your address bar.");
    }
  }
  return (
    <>
      <main id="main" className="profile-page">
        <div className="profile-breadcrumb">
          <span>A little closer to your favorite people</span>
          <span>
            GOOD CONVERSATIONS START HERE <Icon name="heart" size={13} />
          </span>
        </div>
        <div className="profile-layout">
          <section className="profile-intro" aria-label="About Stella">
            <div className="hero-image">
              <Image
                src={stella.image}
                alt="Stella May smiling on a sunny Mediterranean terrace"
                fill
                loading="eager"
                sizes="(max-width: 760px) 100vw, 480px"
              />
              <div className="hero-topline">
                <Badge className="online-badge">
                  <i className="online-dot" /> Online now
                </Badge>
                <button
                  className="share-button"
                  aria-label="Share Stella’s profile"
                  onClick={share}
                >
                  <Icon name="share" size={18} />
                </button>
              </div>
              <div className="hero-bottom">
                <span>YOUR NEXT GOOD CONVERSATION</span>
                <span>
                  Say hello <Icon name="arrow" size={18} />
                </span>
              </div>
            </div>
            {shareStatus && (
              <p role="status" className="share-status">
                {shareStatus}
              </p>
            )}
            <div className="creator-details">
              <div className="name-row">
                <h1>
                  {stella.name}
                  <span className="verified" aria-label="Verified creator">
                    <Icon name="check" size={14} />
                  </span>
                </h1>
                <span className="handle">{stella.handle}</span>
              </div>
              <div className="categories">
                {stella.categories.map((category) => (
                  <span key={category}>{category}</span>
                ))}
              </div>
              <p className="bio">{stella.bio}</p>
              <div className="stats">
                <CreatorStat value={`★ ${stella.rating}`} label="Fan rating" />
                <CreatorStat value={stella.responseTime} label="Avg. reply" />
                <CreatorStat
                  value={stella.responseRate}
                  label="Response rate"
                />
              </div>
              <p className="completed">
                <Icon name="message" size={15} />
                <strong>{stella.completedChats}</strong> completed chats. A lot
                of happy hellos.
              </p>
            </div>
            <div className="desktop-promise">
              <Icon name="shield" size={23} />
              <div>
                <strong>Good energy. Guaranteed.</strong>
                <p>No reply = no charge. It’s that simple.</p>
              </div>
            </div>
          </section>
          <section
            className="interaction-column"
            aria-label="Connect with Stella"
          >
            <div className="section-heading">
              <span className="eyebrow">MAKE A CONNECTION</span>
              <h2>
                Choose how we talk<span className="pink">.</span>
              </h2>
              <p>Big questions. Little hellos. I’m here for it.</p>
            </div>
            <div className="offering-list">
              {offerings.map((offering, index) => (
                <button
                  key={offering.kind}
                  className={`offering ${index === 0 ? "offering-featured" : ""}`}
                  onClick={() => setSelected(offering)}
                >
                  <span className={`offering-icon icon-${offering.kind}`}>
                    <Icon name={offering.icon as IconName} size={23} />
                  </span>
                  <span className="offering-info">
                    <strong>
                      {offering.title}
                      {index === 0 && (
                        <span className="popular">FAN FAVORITE</span>
                      )}
                    </strong>
                    <span>{offering.subtitle}</span>
                  </span>
                  <Price cents={offering.cents} unit={offering.unit} />
                  <Icon name="arrow" size={18} />
                </button>
              ))}
            </div>
            <p className="payment-promise">
              <Icon name="shield" size={15} /> No reply = no charge. Always.
            </p>
            <Card className="vip-card">
              <div className="vip-top">
                <Badge>
                  <Icon name="sparkles" size={13} /> THE INNER CIRCLE
                </Badge>
                <Price cents={vip.cents} unit="/month" />
              </div>
              <h2>A little more us.</h2>
              <p>
                Unlimited/basic messaging and private posts.
                <br />
                Your all-access pass to my everyday.
              </p>
              <Button onClick={() => setSelected(vip)}>
                Become VIP <Icon name="arrow" size={18} />
              </Button>
              <span className="vip-note">
                Monthly membership · Cancel anytime
              </span>
            </Card>
            <section
              className="private-section"
              aria-label="VIP content previews"
            >
              <div className="private-title">
                <h3>
                  Just between us <Icon name="lock" size={15} />
                </h3>
                <Badge>VIP ONLY</Badge>
              </div>
              <div className="preview-grid">
                {["Life lately", "Behind the scenes", "A little getaway"].map(
                  (title, index) => (
                    <button
                      className={`preview-tile preview-${index}`}
                      key={title}
                      onClick={() => setSelected(vip)}
                      aria-label={`Unlock ${title} with VIP`}
                    >
                      <Image src={stella.image} alt="" fill sizes="160px" />
                      <span className="preview-lock">
                        <Icon name="lock" size={18} />
                      </span>
                      <span className="preview-label">{title}</span>
                    </button>
                  ),
                )}
              </div>
              <p className="demo-caption">
                Fictional creator · Demo media and activity
              </p>
            </section>
          </section>
        </div>
        <footer className="profile-footer">
          <span>Real attention. A little connection.</span>
          <span>
            withahottie<span className="pink">.</span>
          </span>
        </footer>
      </main>
      <BottomNavigation />
      <BottomSheet
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? titles[selected.kind] : ""}
      >
        {selected && (
          <Checkout
            key={selected.kind}
            offering={selected}
            onClose={() => setSelected(null)}
          />
        )}
      </BottomSheet>
    </>
  );
}
