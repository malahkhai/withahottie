import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth/session";
import { demoCreator } from "@/lib/auth/demo";
import { validUsername } from "@/lib/creators/validation";
import { fail } from "@/lib/http";
export async function GET(request: Request) {
  const username = new URL(request.url).searchParams.get("username") || "";
  if (!validUsername(username)) return NextResponse.json({ available: false });
  const supabase = await createClient();
  if (!supabase) {
    const own = await demoCreator();
    return NextResponse.json({
      available:
        username !== "stella" ||
        ((await getViewer())?.role === "creator" && own.username === "stella"),
      demo: true,
    });
  }
  const { data, error } = await supabase.rpc("username_available", {
    candidate: username,
  });
  if (error) return fail("Availability could not be checked. Try again.", 503);
  return NextResponse.json({ available: data });
}
