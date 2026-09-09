import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { demoCookieOptions } from "@/lib/auth/demo";
import { readJson, fail } from "@/lib/http";
export async function POST(request: Request) {
  if (getSupabaseConfig()) return fail("Demo sessions are disabled.", 404);
  try {
    const { role } = await readJson(request);
    if (!["fan", "creator"].includes(role)) return fail("Invalid demo role.");
    (await cookies()).set("replypass_demo_session", role, demoCookieOptions);
    return NextResponse.json({
      next: role === "creator" ? "/creator/dashboard" : "/account",
    });
  } catch {
    return fail("Unable to start demo session.");
  }
}
