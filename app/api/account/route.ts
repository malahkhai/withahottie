import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { readJson, fail } from "@/lib/http";
export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return fail("Sign in required.", 401);
  try {
    const { action, creatorId } = await readJson(request);
    if (!["save", "unsave"].includes(action) || typeof creatorId !== "string")
      return fail("Invalid action.");
    if (viewer.demo) return NextResponse.json({ ok: true, demo: true });
    const client = (await createClient())!;
    const { error } =
      action === "save"
        ? await client
            .from("saved_creators")
            .upsert(
              { fan_id: viewer.id, creator_id: creatorId },
              { onConflict: "fan_id,creator_id", ignoreDuplicates: true },
            )
        : await client
            .from("saved_creators")
            .delete()
            .eq("fan_id", viewer.id)
            .eq("creator_id", creatorId);
    if (error) return fail("Unable to update saved creators.");
    return NextResponse.json({ ok: true });
  } catch {
    return fail("Unable to update your account.");
  }
}
