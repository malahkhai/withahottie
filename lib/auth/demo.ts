import "server-only";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { validateCreator } from "@/lib/creators/validation";
import { stellaDraft } from "@/lib/creators/catalog";
import type { CreatorDraft, Viewer } from "@/types/creator";
export const demoCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure:
    process.env.NODE_ENV === "production" &&
    (process.env.NEXT_PUBLIC_APP_URL || "").startsWith("https:"),
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
};
export async function demoViewer(): Promise<Viewer | null> {
  if (getSupabaseConfig()) return null;
  const raw = (await cookies()).get("replypass_demo_session")?.value;
  if (raw !== "fan" && raw !== "creator") return null;
  const draft = await demoCreator();
  return {
    id: raw === "creator" ? "demo-creator" : "alex",
    role: raw,
    displayName: raw === "creator" ? draft.displayName : "Alex Morgan",
    demo: true,
  };
}
export async function demoCreator(): Promise<CreatorDraft> {
  if (getSupabaseConfig()) return stellaDraft;
  const raw = (await cookies()).get("replypass_demo_creator")?.value;
  try {
    if (!raw) return stellaDraft;
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString());
    return validateCreator(parsed).length ? stellaDraft : parsed;
  } catch {
    return stellaDraft;
  }
}
