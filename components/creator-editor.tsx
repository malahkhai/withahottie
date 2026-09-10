"use client";
import { siteConfig } from "@/lib/site";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { categories, type CreatorDraft } from "@/types/creator";
import { blankCreator, catalog } from "@/lib/creators/catalog";
import { validateCreator, centsFromInput } from "@/lib/creators/validation";
import { splitPayment, PLATFORM_FEE_PERCENT } from "@/lib/payments/fees";
import { Button, Price, Badge } from "./ui";
import { Icon } from "./icon";
const countries = [
  ["FR", "France"],
  ["GB", "United Kingdom"],
  ["US", "United States"],
  ["CA", "Canada"],
  ["DE", "Germany"],
  ["ES", "Spain"],
  ["IT", "Italy"],
  ["NL", "Netherlands"],
  ["BE", "Belgium"],
  ["PT", "Portugal"],
  ["AU", "Australia"],
  ["BR", "Brazil"],
  ["IN", "India"],
  ["JP", "Japan"],
  ["NG", "Nigeria"],
  ["ZA", "South Africa"],
  ["AE", "United Arab Emirates"],
  ["SG", "Singapore"],
  ["MX", "Mexico"],
];
export function CreatorEditor({
  initial = blankCreator,
  demo,
  authenticated,
  editing = false,
}: {
  initial?: CreatorDraft;
  demo: boolean;
  authenticated: boolean;
  editing?: boolean;
}) {
  const [draft, setDraft] = useState<CreatorDraft>({
    ...initial,
    pricing:initial.pricing.map(p=>p.kind==="message"&&!demo&&!initial.payoutReady?{...p,enabled:false}:p),
    image: initial.image.startsWith("data:")
      ? "/images/avatar.svg"
      : initial.image,
  });
  const [step, setStep] = useState(editing ? 1 : 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [availability, setAvailability] = useState("");
  const [avatar, setAvatar] = useState(
    initial.image.startsWith("data:") ? initial.image : "",
  );
  const router = useRouter();
  function patch<K extends keyof CreatorDraft>(key: K, value: CreatorDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  async function checkUsername() {
    setAvailability("Checking…");
    try {
      const r = await fetch(
        `/api/creator/username?username=${encodeURIComponent(draft.username)}`,
      );
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      setAvailability(
        data.available
          ? "This username is available."
          : "That username is unavailable.",
      );
      return data.available === true;
    } catch {
      setAvailability("Could not check availability. Please try again.");
      return false;
    }
  }
  async function upload(file?: File) {
    if (!file) return;
    if (
      file.size > 2 * 1024 * 1024 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      setError("Choose a JPG, PNG or WebP under 2 MB.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (demo) {
        const data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        setAvatar(data);
        patch("image", "/images/avatar.svg");
      } else {
        const body = new FormData();
        body.set("image", file);
        const r = await fetch("/api/creator/avatar", { method: "POST", body });
        const data = await r.json();
        if (!r.ok) throw Error(data.error);
        patch("image", data.url);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Image upload failed.");
    } finally {
      setBusy(false);
    }
  }
  async function next() {
    setError("");
    if (step === 1) {
      const errors = validateCreator(draft);
      const profileErrors = errors.filter((e) => !e.startsWith("Prices"));
      if (profileErrors.length) {
        setError(profileErrors[0]);
        return;
      }
      if (!(await checkUsername())) {
        setError("Choose an available username.");
        return;
      }
    }
    if (step === 3) {
      const errors = validateCreator(draft);
      if (errors.length) {
        setError(errors[0]);
        return;
      }
    }
    setStep((s) => Math.min(5, s + 1));
  }
  async function launch() {
    const errors = validateCreator(draft);
    if (errors.length) {
      setError(errors[0]);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/creator/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      if (demo) {
        localStorage.setItem(
          "replypass:creator",
          JSON.stringify({ ...draft, image: avatar || draft.image }),
        );
        window.dispatchEvent(new Event("replypass:change"));
      }
      router.push("/creator/dashboard");
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Unable to save. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (step === 0)
    return (
      <main id="main" className="onboarding-intro">
        <div>
          <Badge>BUILT AROUND YOU</Badge>
          <h1>
            Turn your attention
            <br />
            into income<span className="pink">.</span>
          </h1>
          <p>
            Your followers already want to hear from you. ReplyPass gives them a
            better way to reach you — and gives you control over your time.
          </p>
          <div className="intro-points">
            <span>
              <Icon name="message" />
              Conversations with value
            </span>
            <span>
              <Icon name="shield" />
              Your time, on your terms
            </span>
            <span>
              <Icon name="sparkles" />A page that feels like you
            </span>
          </div>
          {authenticated || demo ? (
            <Button onClick={() => setStep(1)}>
              Become a creator <Icon name="arrow" />
            </Button>
          ) : (
            <Link
              className="button button-primary"
              href="/signup?next=%2Fcreator%2Fapply"
            >
              Become a creator <Icon name="arrow" />
            </Link>
          )}
          <small>Five small steps. One closer community.</small>
        </div>
        <div className="intro-preview">
          <Badge>YOUR NAME. YOUR PEOPLE.</Badge>
          <div className="intro-monogram">
            r<span>.</span>
          </div>
          <strong>Make room for a real connection.</strong>
          <p>Messages. Moments. More you.</p>
        </div>
      </main>
    );
  const headings = [
    "",
    "Let’s make it yours.",
    "Where can people find you?",
    "Your time. Your price.",
    "Set your own rhythm.",
    "Ready to meet your people?",
  ];
  return (
    <div
      className={`editor-page ${editing ? "editing" : ""}`}
      id={editing ? undefined : "main"}
    >
      <div className="editor-top">
        <span className="eyebrow">
          {editing ? "YOUR PUBLIC PAGE" : "BECOME A CREATOR"}
        </span>
        <span>Step {step} of 5</span>
      </div>
      <div className="step-track" aria-label={`Step ${step} of 5`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={n <= step ? "active" : ""} />
        ))}
      </div>
      <h1>{headings[step]}</h1>
      <p className="editor-description">
        {
          [
            "",
            "The basics that help your people recognize you.",
            "Optional links. Keep your community connected.",
            "Choose what you offer. Change it whenever you like.",
            "Let fans know how and when you’re available.",
            "Here’s how your ReplyPass will look on a phone.",
          ][step]
        }
      </p>
      {step === 1 && (
        <div className="editor-fields">
          <div className="avatar-upload">
            <Image
              src={avatar || draft.image || "/images/avatar.svg"}
              alt="Profile preview"
              width={76}
              height={76}
              unoptimized
            />
            <label>
              Profile image
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => upload(e.target.files?.[0])}
              />
              <small>JPG, PNG or WebP · Up to 2 MB</small>
            </label>
          </div>
          <label>
            Display name
            <input
              value={draft.displayName}
              onChange={(e) => patch("displayName", e.target.value)}
              maxLength={80}
              autoComplete="name"
              placeholder="Your name"
            />
          </label>
          <label>
            Username
            <div className="username-field">
              <span>replypass / @</span>
              <input
                value={draft.username}
                onChange={(e) => {
                  patch(
                    "username",
                    e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""),
                  );
                  setAvailability("");
                }}
                onBlur={checkUsername}
                maxLength={30}
                placeholder="yourname"
                autoComplete="off"
              />
            </div>
            <span className="field-hint" role="status">
              {availability ||
                "3–30 lowercase letters, numbers or underscores."}
            </span>
          </label>
          <label>
            Short bio
            <textarea
              value={draft.bio}
              onChange={(e) => patch("bio", e.target.value)}
              rows={3}
              maxLength={280}
              placeholder="What would you love to talk about?"
            />
          </label>
          <fieldset>
            <legend>
              Categories <span>Choose up to three</span>
            </legend>
            <div className="category-options">
              {categories.map((c) => (
                <button
                  type="button"
                  aria-pressed={draft.categories.includes(c)}
                  key={c}
                  onClick={() =>
                    patch(
                      "categories",
                      draft.categories.includes(c)
                        ? draft.categories.filter((x) => x !== c)
                        : draft.categories.length < 3
                          ? [...draft.categories, c]
                          : draft.categories,
                    )
                  }
                >
                  {c}
                </button>
              ))}
            </div>
          </fieldset>
          <label>
            Country
            <select
              value={draft.country}
              onChange={(e) => patch("country", e.target.value)}
            >
              {countries.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {step === 2 && (
        <div className="editor-fields">
          {Object.entries({
            instagram: "Instagram",
            tiktok: "TikTok",
            youtube: "YouTube",
            twitter: "X / Twitter",
            website: "Website",
          }).map(([key, label]) => (
            <label key={key}>
              {label} <span className="optional">Optional</span>
              <input
                type="url"
                value={draft.socials[key as keyof typeof draft.socials]}
                onChange={(e) =>
                  patch("socials", { ...draft.socials, [key]: e.target.value })
                }
                placeholder="https://"
                maxLength={300}
              />
            </label>
          ))}
        </div>
      )}
      {step === 3 && (
        <>
          <div className="currency-note">
            Currency <strong>EUR (€)</strong>
            <span>
              All prices include the {PLATFORM_FEE_PERCENT}% platform fee.
            </span>
          </div>
          <div className="pricing-editor">
            {catalog.map((item) => {
              const price = draft.pricing.find((p) => p.kind === item.kind)!;
              return (
                <div className="price-editor-row" key={item.kind}>
                  <div>
                    <strong>
                      {item.kind === "message"
                        ? "Guaranteed reply"
                        : item.title === "Become VIP"
                          ? "VIP subscription"
                          : item.title}
                    </strong>
                    <span>{item.unit || "Per request"}</span>
                  </div>
                  <label className="price-input">
                    <span className="sr-only">{item.title} price in EUR</span>
                    <span>€</span>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      max={["vip", "live_chat"].includes(item.kind) ? 100 : 500}
                      defaultValue={price.cents / 100}
                      onChange={(e) =>
                        patch(
                          "pricing",
                          draft.pricing.map((p) =>
                            p.kind === item.kind
                              ? { ...p, cents: centsFromInput(e.target.value) }
                              : p,
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      disabled={item.kind === "message" && !demo && !initial.payoutReady}
                      aria-label={`Enable ${item.title}`}
                      checked={price.enabled}
                      onChange={(e) =>
                        patch(
                          "pricing",
                          draft.pricing.map((p) =>
                            p.kind === item.kind
                              ? { ...p, enabled: e.target.checked }
                              : p,
                          ),
                        )
                      }
                    />
                    <span />
                  </label>
                </div>
              );
            })}
          </div>
          <div className="fee-example">
            On a €4 reply <span>Platform €0.60</span>
            <strong>
              You earn <Price cents={splitPayment(400).creatorCents} decimals />
            </strong>
          </div>
        </>
      )}
      {step === 4 && (
        <div className="editor-fields">
          <div className="availability-options">
            {(["online", "away", "offline"] as const).map((status) => (
              <button
                key={status}
                aria-pressed={draft.availability === status}
                onClick={() => patch("availability", status)}
              >
                <i className={`status-dot ${status}`} />
                {status}
              </button>
            ))}
          </div>
          {(
            [
              ["acceptingMessages", "Accepting messages"],
              ["acceptingLive", "Accepting live chats"],
              ["acceptingMedia", "Accepting media requests"],
            ] as const
          ).map(([key, label]) => (
            <div className="setting-row" key={key}>
              <span>{label}</span>
              <label className="toggle">
                <input
                  type="checkbox"
                  aria-label={label}
                  checked={draft[key]}
                  onChange={(e) => patch(key, e.target.checked)}
                />
                <span />
              </label>
            </div>
          ))}
          <label>
            Typical reply time <span className="optional">Optional</span>
            <select
              value={draft.replyTime}
              onChange={(e) => patch("replyTime", e.target.value)}
            >
              <option value="">Not specified</option>
              {["~10 minutes", "~1 hour", "within 24 hours"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
        </div>
      )}
      {step === 5 && (
        <div className="phone-preview">
          <div className="preview-phone-bar">
            {siteConfig.logo}<span className="pink">.</span>
          </div>
          <Image
            src={avatar || draft.image || "/images/avatar.svg"}
            alt="Your public profile preview"
            width={320}
            height={250}
            unoptimized
          />
          <h2>{draft.displayName}</h2>
          <span className="muted">
            @{draft.username} · {draft.availability}
          </span>
          <p>{draft.bio}</p>
          <h3>Choose how we talk.</h3>
          {draft.pricing
            .filter((p) => p.enabled)
            .map((p) => (
              <div className="preview-offering" key={p.kind}>
                <span>{catalog.find((c) => c.kind === p.kind)?.title}</span>
                <Price
                  cents={p.cents}
                  unit={catalog.find((c) => c.kind === p.kind)?.unit}
                />
              </div>
            ))}
          <small>{siteConfig.fanPromise}</small>
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="editor-actions">
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => setStep((s) => Math.max(editing ? 1 : 0, s - 1))}
        >
          Back
        </Button>
        <Button disabled={busy} onClick={step === 5 ? launch : next}>
          {busy
            ? "Saving…"
            : step === 5
              ? editing
                ? "Save my ReplyPass"
                : "Launch my ReplyPass"
              : "Continue"}
          <Icon name="arrow" size={18} />
        </Button>
      </div>
      {demo && (
        <p className="editor-demo-note">
          Demo mode · Saved in this browser. No payments are enabled.
        </p>
      )}
    </div>
  );
}
