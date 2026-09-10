"use client";
import Image from "next/image";
import {SecuredCheckout} from "./secured-checkout";
import { creatorUrl, siteConfig } from "@/lib/site";
import { useState, useEffect } from "react";
import type { PublicCreator } from "@/types/creator";
import type { Offering } from "@/types/domain";
import { Avatar, Badge, Button, Card, CreatorStat, Price } from "./ui";
import { Icon, type IconName } from "./icon";
import { BottomSheet } from "./bottom-sheet";
import { SaveCreator } from "./fan-account";
import { BottomNavigation } from "./navigation";

function Checkout({
  offering,
  creator,
  onClose,
}: {
  offering: Offering;
  creator: PublicCreator;
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
        body: JSON.stringify({
          kind: offering.kind,
          message,
          minutes,
          handle: creator.handle,
        }),
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
          Back to {creator.name.split(" ")[0]} <Icon name="heart" size={17} />
        </Button>
      </div>
    );
  return (
    <form onSubmit={submit} className="checkout-form">
      <div className="checkout-creator">
        <Avatar src={creator.image} name={creator.name} />
        <div>
          <strong>
            {creator.name} {creator.verified && <span className="pink">✓</span>}
          </strong>
          <span>
            <i className="online-dot" /> Typical reply: {creator.responseTime}
          </span>
        </div>
        <Badge>Demo</Badge>
      </div>
      <p className="checkout-explanation">
        {offering.kind === "vip"
          ? "Your monthly pass to basic messaging and private posts. Paid requests are separate. This preview won’t start a subscription."
          : `You’re paying for a guaranteed reply. If ${creator.name.split(" ")[0]} doesn’t accept your request, you won’t be charged.`}
      </p>
      {offering.kind !== "vip" && (
        <p className="promise-note">
          <Icon name="shield" size={16} /> {siteConfig.fanPromise}
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
                {value} minutes · €{(value * offering.cents) / 100}
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
                ? `Hey ${creator.name.split(" ")[0]}! I’d love to know…`
                : "Tell us a little about your request…"
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
export function CreatorProfile({
  creator: initial, paymentsEnabled = false,
}: {
  creator: PublicCreator; paymentsEnabled?: boolean;
}) {
  const [demoImage, setDemoImage] = useState("");
  useEffect(() => {
    if (!initial.demo) return;
    void Promise.resolve().then(() => {
      try {
        const draft = JSON.parse(
          localStorage.getItem("replypass:creator") || "null",
        );
        if (
          "@" + draft?.username === initial.handle &&
          /^data:image\/(jpeg|png|webp);base64,/.test(draft.image)
        )
          setDemoImage(draft.image);
      } catch {
        /* Demo media is optional. */
      }
    });
  }, [initial.demo, initial.handle]);
  const creator = demoImage ? { ...initial, image: demoImage } : initial;
  const { offerings, vip } = creator;
  const firstName = creator.name.split(" ")[0];
  const titles = {
    message: `Message ${firstName}`,
    live_chat: `Live chat with ${firstName}`,
    voice_note: `A voice note from ${firstName}`,
    photo: "Request a photo",
    video: "Request a video",
    vip: `Your ${firstName} VIP pass`,
  };
  const [selected, setSelected] = useState<Offering | null>(null);
  const [shareStatus, setShareStatus] = useState("");
  async function share() {
    try {
      if (navigator.share)
        await navigator.share({
          title: `Meet ${creator.name} on ${siteConfig.name}`,
          url: creatorUrl(creator.handle),
        });
      else {
        await navigator.clipboard.writeText(creatorUrl(creator.handle));
        setShareStatus("Profile link copied");
      }
    } catch {
      setShareStatus(`Share this profile: ${creatorUrl(creator.handle)}`);
    }
  }
  return (
    <>
      <main id="main" className="profile-page">
        <div className="profile-breadcrumb">
          <span>{siteConfig.tagline}</span>
          <span>
            GOOD CONVERSATIONS START HERE <Icon name="heart" size={13} />
          </span>
        </div>
        <div className="profile-layout">
          <section
            className="profile-intro"
            aria-label={`About ${creator.name}`}
          >
            <div className="hero-image">
              <Image
                src={creator.image}
                alt={`${creator.name} profile photo`}
                fill
                loading="eager"
                unoptimized={creator.image.startsWith("http")}
                sizes="(max-width: 760px) 100vw, 480px"
              />
              <div className="hero-topline">
                <Badge className="online-badge">
                  <i className={`status-dot ${creator.availability}`} />{" "}
                  {creator.availability}
                </Badge>
                <button
                  className="share-button"
                  aria-label={`Share ${creator.name}’s profile`}
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
                  {creator.name}
                  {creator.verified && (
                    <span className="verified" aria-label="Verified creator">
                      <Icon name="check" size={14} />
                    </span>
                  )}
                </h1>
                <span className="handle">{creator.handle}</span>
              </div>
              <div className="categories">
                {creator.categories.map((category) => (
                  <span key={category}>{category}</span>
                ))}
              </div>
              <p className="bio">{creator.bio}</p>
              <div className="stats">
                <CreatorStat value={`★ ${creator.rating}`} label="Fan rating" />
                <CreatorStat value={creator.responseTime} label="Avg. reply" />
                <CreatorStat
                  value={creator.responseRate}
                  label="Response rate"
                />
              </div>
              <p className="completed">
                <Icon name="message" size={15} />
                <strong>{creator.completedChats}</strong> completed chats. A lot
                of happy hellos.
              </p>
            </div>
            <SaveCreator creator={creator} />
            <div className="desktop-promise">
              <Icon name="shield" size={23} />
              <div>
                <strong>Good energy. Guaranteed.</strong>
                <p>{siteConfig.fanPromise} It’s that simple.</p>
              </div>
            </div>
          </section>
          <section
            className="interaction-column"
            aria-label={`Connect with ${creator.name}`}
          >
            <div className="section-heading">
              <span className="eyebrow">MAKE A CONNECTION</span>
              <h2>
                Choose how we talk<span className="pink">.</span>
              </h2>
              <p>Big questions. Little hellos. I’m here for it.</p>
            </div>
            {offerings.length === 0 && (
              <p className="empty-inline">
                Requests are paused. Check back soon.
              </p>
            )}
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
              <Icon name="shield" size={15} /> {siteConfig.fanPromise} Always.
            </p>
            {vip && (
              <>
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
                    {[
                      "Life lately",
                      "Behind the scenes",
                      "A little getaway",
                    ].map((title, index) => (
                      <button
                        className={`preview-tile preview-${index}`}
                        key={title}
                        onClick={() => setSelected(vip)}
                        aria-label={`Unlock ${title} with VIP`}
                      >
                        <Image
                          src={creator.image}
                          alt=""
                          fill
                          sizes="160px"
                          unoptimized={creator.image.startsWith("http")}
                        />
                        <span className="preview-lock">
                          <Icon name="lock" size={18} />
                        </span>
                        <span className="preview-label">{title}</span>
                      </button>
                    ))}
                  </div>
                  <p className="demo-caption">
                    {creator.demo
                      ? "Fictional creator · Demo media and activity"
                      : "Preview media · Payments are not yet enabled"}
                  </p>
                </section>
              </>
            )}
          </section>
        </div>
        <footer className="profile-footer">
          <span>Real attention. A little connection.</span>
          <span>
            {siteConfig.logo}<span className="pink">.</span>
          </span>
        </footer>
      </main>
      <BottomNavigation />
      <BottomSheet
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? titles[selected.kind] : ""}
      >
        {selected && (paymentsEnabled && selected.kind === "message" ? <SecuredCheckout creator={creator}/> :
          <Checkout
            key={selected.kind}
            offering={selected}
            creator={creator}
            onClose={() => setSelected(null)}
          />
        )}
      </BottomSheet>
    </>
  );
}
