import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sameOrigin, fail } from "@/lib/http";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail("Invalid origin.", 403);
  const supabase = await createClient();
  if (supabase) {
    const { error } = await supabase.auth.signOut();
    if (error) return fail("Unable to log out. Please try again.", 503);
  }
  (await cookies()).delete("replypass_demo_session");
  return NextResponse.json({ ok: true });
}
