import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { readJson, fail } from "@/lib/http";
export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return fail("Sign in required.", 401);
  if (viewer.demo) return fail("Demo messages stay in this browser.");
  try {
    const { conversationId, body } = await readJson(request);
    if (typeof body !== "string" || !body.trim() || body.length > 10000)
      return fail("Enter a message under 10,000 characters.");
    const { data, error } = await (await createClient())!.rpc(
      "send_chat_message",
      { conversation: conversationId, content: body },
    );
    if (error)
      return fail(
        "Unable to send. The conversation may no longer be available.",
        403,
      );
    return NextResponse.json({ id: data });
  } catch {
    return fail("Unable to send the message.");
  }
}
