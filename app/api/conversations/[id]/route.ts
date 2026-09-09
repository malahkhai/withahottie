import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth/session";
import { loadWorkspace } from "@/lib/workspace/repository";
import { fail } from "@/lib/http";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await getViewer();
  if (!viewer) return fail("Sign in required.", 401);
  const data = await loadWorkspace(viewer);
  const { id } = await params;
  const conversation = data.conversations.find((c) => c.id === id);
  if (!conversation) return fail("Conversation not found.", 404);
  return NextResponse.json(conversation, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
