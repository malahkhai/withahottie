import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth/paths";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const supabase = await createClient();
  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(
        new URL(
          `/auth/continue?next=${encodeURIComponent(safeNext(url.searchParams.get("next")))}`,
          url.origin,
        ),
      );
  }
  return NextResponse.redirect(
    new URL("/login?error=confirmation", url.origin),
  );
}
