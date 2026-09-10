import { getViewer } from "@/lib/auth/session";
import { readJson, fail } from "@/lib/http";
import { replyService } from "@/lib/stripe/service";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await getViewer();
  if (!viewer || viewer.demo || viewer.role !== "admin")
    return fail("Admin required.", 403);
  try {
    await readJson(request);
    const p = await replyService().engine.refund((await params).id, viewer.id);
    return Response.json({ state: p.payment_state });
  } catch {
    return fail(
      "Refund requires reconciliation. No additional charge was created.",
      409,
    );
  }
}
