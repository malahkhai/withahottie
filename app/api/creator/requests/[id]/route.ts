import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { readJson, fail } from "@/lib/http";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await getViewer();
  if (!viewer) return fail("Sign in required.", 401);
  if (!["creator", "admin"].includes(viewer.role))
    return fail("Creator access required.", 403);
  if (viewer.demo)
    return fail("Demo request changes are local to this browser.");
  try {
    const { action } = await readJson(request);
    if (!["accept", "decline", "complete"].includes(action))
      return fail("Invalid action.");
    const { error } = await (await createClient())!.rpc("respond_to_request", {
      request_id: (await params).id,
      action,
    });
    if (error)
      return fail(
        "This request is unavailable, expired or already handled.",
        409,
      );
    return NextResponse.json({ ok: true });
  } catch {
    return fail("Unable to update the request.");
  }
}
