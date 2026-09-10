import { getViewer } from "@/lib/auth/session";
import { fail, readJson } from "@/lib/http";
import { ownedPayment, replyService } from "@/lib/stripe/service";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await getViewer();
  if (!viewer || viewer.demo) return fail("Sign in required.", 401);
  try {
    await readJson(request);
    const { id } = await params;
    await ownedPayment(id, viewer.id, "fan");
    const { engine, db } = replyService();
    const p = await engine.reconcile(id);
    const { data: active } = await db
      .from("interaction_requests")
      .select("id")
      .eq("id", p.request_id)
      .maybeSingle();
    return Response.json(
      {
        id: p.id,
        secured: p.payment_state === "authorized" && !!active,
        completed: p.payment_state === "captured",
        state: p.payment_state,
        expiresAt: p.expires_at,
        amountCents: p.gross_cents,
        currency: p.currency,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return fail(
      "We are still checking your reservation. Do not submit another payment; check your requests or try again.",
      409,
    );
  }
}
