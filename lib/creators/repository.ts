import { stripeConfig } from '@/lib/stripe/config';
import { connectStatus } from '@/lib/stripe/connect';
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { demoCreator } from "@/lib/auth/demo";
import { blankCreator, demoStella, toPublic } from "./catalog";
import type { CreatorDraft, PublicCreator } from "@/types/creator";
import { validUsername } from "./validation";
export function draftFromRow(
  row: Record<string, unknown>,
  profile: { display_name: string; avatar_path: string | null },
  pricing: {
    kind: CreatorDraft["pricing"][number]["kind"];
    amount_cents: number;
    active: boolean;
  }[],
): CreatorDraft {
  return {
    ...blankCreator,
    displayName: profile.display_name,
    username: String(row.handle),
    image: profile.avatar_path || "",
    bio: String(row.bio || ""),
    categories: row.categories as string[],
    country: String(row.country || "FR"),
    socials: { ...blankCreator.socials, ...(row.social_links as object) },
    pricing: blankCreator.pricing.map((p) => {
      const saved = pricing.find((x) => x.kind === p.kind);
      return saved
        ? { kind: p.kind, cents: saved.amount_cents, enabled: saved.active }
        : { ...p, enabled: false };
    }),
    availability:
      (row.availability as CreatorDraft["availability"]) || "offline",
    acceptingMessages: row.accepting_messages === true,
    acceptingLive: row.accepting_live_chats === true,
    acceptingMedia: row.accepting_media_requests === true,
    replyTime: String(row.reply_time || ""),
  };
}
export async function creatorForUser(
  userId: string,
): Promise<CreatorDraft | null> {
  const supabase = await createClient();
  if (!supabase) return demoCreator();
  const { data: row, error } = await supabase
    .from("creator_profiles")
    .select("*")
    .eq("profile_id", userId)
    .maybeSingle();
  if (error) throw Error("Unable to load your creator profile.");
  if (!row) return null;
  const [
    { data: profile, error: pError },
    { data: prices, error: priceError },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name,avatar_path")
      .eq("id", userId)
      .single(),
    supabase
      .from("creator_pricing")
      .select("kind,amount_cents,active")
      .eq("creator_id", row.id),
  ]);
  if (pError || priceError || !profile)
    throw Error("Unable to load creator settings.");
  const draft=draftFromRow(row, profile, prices || []);
  try {draft.payoutReady=!!stripeConfig() && (await connectStatus(row.id)).ready;} catch {draft.payoutReady=false;}
  return draft;
}
export async function findCreator(raw: string): Promise<PublicCreator | null> {
  let username: string;
  try {
    username = decodeURIComponent(raw).replace(/^@/, "");
  } catch {
    return null;
  }
  if (!validUsername(username)) return null;
  const supabase = await createClient();
  if (!supabase) {
    const own = await demoCreator();
    return username === own.username
      ? username === "stella"
        ? {
            ...demoStella,
            ...toPublic(own),
            verified: true,
            rating: "4.9",
            responseRate: "98%",
            responseTime: "~8 min",
            completedChats: "2.4K",
          }
        : toPublic(own)
      : username === "stella"
        ? demoStella
        : null;
  }
  try {
    const { data: row, error } = await supabase
      .from("creator_profiles")
      .select("*")
      .eq("handle", username)
      .eq("onboarding_complete", true)
      .maybeSingle();
    if (error) throw error;
    // Keep the fictional showcase available on a healthy, newly configured database.
    if (!row) return username === "stella" ? demoStella : null;
    const [
      { data: profile, error: pError },
      { data: prices, error: priceError },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("display_name,avatar_path")
        .eq("id", row.profile_id)
        .single(),
      supabase
        .from("creator_pricing")
        .select("kind,amount_cents,active")
        .eq("creator_id", row.id),
    ]);
    if (pError || priceError || !profile) throw Error();
    const result = toPublic(draftFromRow(row, profile, prices || []), false);
    return {
      ...result,
      id: row.id,
      verified: row.verified,
      responseRate: row.response_rate === null ? "—" : `${row.response_rate}%`,
      responseTime: row.reply_time || "Not set",
      completedChats: String(row.completed_chats),
    };
  } catch {
    return username === "stella" ? demoStella : null;
  }
}
