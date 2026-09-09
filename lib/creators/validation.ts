import { categories, type CreatorDraft } from "../../types/creator.ts";
export const priceLimits = {
  min: 100,
  max: 50000,
  liveMax: 10000,
  vipMax: 10000,
};
export const kinds = [
  "message",
  "live_chat",
  "voice_note",
  "photo",
  "video",
  "vip",
] as const;
export function validUsername(value: string) {
  return (
    /^[a-z0-9_]{3,30}$/.test(value) &&
    ![
      "admin",
      "account",
      "login",
      "signup",
      "creator",
      "replypass",
      "support",
    ].includes(value)
  );
}
export function centsFromInput(value: string): number {
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(value)) return NaN;
  const [whole, fraction = ""] = value.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
export function validateCreator(input: unknown): string[] {
  if (!input || typeof input !== "object") return ["Invalid profile."];
  const d = input as CreatorDraft;
  const errors: string[] = [];
  if (
    typeof d.displayName !== "string" ||
    !d.displayName.trim() ||
    d.displayName.length > 80
  )
    errors.push("Enter a display name up to 80 characters.");
  if (typeof d.username !== "string" || !validUsername(d.username))
    errors.push(
      "Use 3–30 lowercase letters, numbers or underscores for your username.",
    );
  if (typeof d.bio !== "string" || !d.bio.trim() || d.bio.length > 280)
    errors.push("Add a short bio, up to 280 characters.");
  if (
    !Array.isArray(d.categories) ||
    d.categories.length < 1 ||
    d.categories.length > 3 ||
    d.categories.some((c) => !(categories as readonly string[]).includes(c))
  )
    errors.push("Choose 1–3 categories.");
  if (typeof d.country !== "string" || !/^[A-Z]{2}$/.test(d.country))
    errors.push("Choose your country.");
  if (d.currency !== "eur") errors.push("EUR is the supported V1 currency.");
  if (
    !["online", "away", "offline"].includes(d.availability) ||
    !["", "~10 minutes", "~1 hour", "within 24 hours"].includes(d.replyTime)
  )
    errors.push("Choose a valid availability and reply time.");
  if (
    ["acceptingMessages", "acceptingLive", "acceptingMedia"].some(
      (k) => typeof d[k as keyof CreatorDraft] !== "boolean",
    )
  )
    errors.push("Check your availability settings.");
  if (
    typeof d.image !== "string" ||
    d.image.length > 2048 ||
    (d.image && !d.image.startsWith("/") && !d.image.startsWith("https://"))
  )
    errors.push("Choose a valid profile image.");
  if (
    !Array.isArray(d.pricing) ||
    d.pricing.length !== 6 ||
    new Set(d.pricing.map((p) => p.kind)).size !== 6 ||
    d.pricing.some(
      (p) =>
        !kinds.includes(p.kind) ||
        typeof p.enabled !== "boolean" ||
        !Number.isInteger(p.cents) ||
        p.cents < priceLimits.min ||
        p.cents >
          (["live_chat", "vip"].includes(p.kind)
            ? priceLimits.vipMax
            : priceLimits.max),
    )
  )
    errors.push("Prices must be €1–€500 (€100 maximum for live chat and VIP).");
  if (!d.socials || typeof d.socials !== "object")
    errors.push("Invalid social links.");
  else
    for (const [key, value] of Object.entries(d.socials)) {
      if (
        !["instagram", "tiktok", "youtube", "twitter", "website"].includes(
          key,
        ) ||
        typeof value !== "string" ||
        value.length > 300
      ) {
        errors.push("Check your social links.");
        continue;
      }
      if (!value) continue;
      try {
        const url = new URL(value);
        if (url.protocol !== "https:" || url.username || url.password)
          throw Error();
        const domains: Record<string, string[]> = {
          instagram: ["instagram.com"],
          tiktok: ["tiktok.com"],
          youtube: ["youtube.com", "youtu.be"],
          twitter: ["x.com", "twitter.com"],
        };
        if (
          domains[key] &&
          !domains[key].some(
            (domain) =>
              url.hostname === domain || url.hostname.endsWith("." + domain),
          )
        )
          throw Error();
      } catch {
        errors.push(`Enter a valid HTTPS ${key} URL.`);
      }
    }
  return errors;
}
