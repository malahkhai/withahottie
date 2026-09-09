import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/session";
import { demoCookieOptions } from "@/lib/auth/demo";
import { validateCreator } from "@/lib/creators/validation";
import { readJson, fail } from "@/lib/http";
export async function POST(request: Request) {
  try {
    const draft = await readJson(request);
    const errors = validateCreator(draft);
    if (errors.length) return fail(errors[0]);
    const supabase = await createClient();
    if (!supabase) {
      if (
        draft.username === "stella" &&
        (await getViewer())?.role !== "creator"
      )
        return fail("That username is taken.", 409);
      const encoded = Buffer.from(JSON.stringify(draft)).toString("base64url");
      if (encoded.length > 3600)
        return fail("Please shorten your bio or links for the local demo.");
      const jar = await cookies();
      jar.set("replypass_demo_creator", encoded, demoCookieOptions);
      jar.set("replypass_demo_session", "creator", demoCookieOptions);
      return NextResponse.json({ ok: true, demo: true });
    }
    const viewer = await getViewer();
    if (!viewer) return fail("Sign in before launching your page.", 401);
    const { error } = await supabase.rpc("save_creator_profile", { draft });
    if (error)
      return fail(
        error.code === "23505"
          ? "That username was just taken. Please choose another."
          : "Your profile could not be saved. Check the fields and try again.",
        409,
      );
    return NextResponse.json({ ok: true });
  } catch {
    return fail("Unable to save. Please try again.");
  }
}
