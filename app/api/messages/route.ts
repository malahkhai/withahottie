import { sendSecuredMessage } from "@/lib/stripe/messages";
import { getViewer } from "@/lib/auth/session";
import { readJson, fail } from "@/lib/http";
export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return fail("Sign in required.", 401);
  if (viewer.demo) return fail("Demo messages stay in this browser.");
  try {
    const { conversationId, body } = await readJson(request);
    if (typeof body !== "string" || !body.trim() || body.length > 10000)
      return fail("Enter a message under 10,000 characters.");
    return Response.json(
      await sendSecuredMessage(viewer.id, conversationId, body),
    );
  } catch {
    return fail("Unable to send the message.");
  }
}
