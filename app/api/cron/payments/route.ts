import { timingSafeEqual } from "node:crypto";
import { replyService } from "@/lib/stripe/service";
export const maxDuration = 60;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const received = request.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  if (
    !secret ||
    secret.length < 32 ||
    received.length !== expected.length ||
    !timingSafeEqual(Buffer.from(received), Buffer.from(expected))
  )
    return new Response("Unauthorized", { status: 401 });
  const { db, engine } = replyService();
  const { data, error } = await db
    .from("reply_payments")
    .select("id,created_at,expires_at,payment_state,operation")
    .or(
      "payment_state.in.(pending,authorized,failed),needs_reconciliation.eq.true",
    )
    .eq("manual_review", false)
    .order("updated_at")
    .limit(50);
  if (error) return new Response("Retry required", { status: 503 });
  let processed = 0,
    attention = 0;
  const started = Date.now();
  for (const p of data || []) {
    if (Date.now() - started > 45000) break;
    try {
      if (
        p.operation === "idle" &&
        ["pending", "authorized", "failed"].includes(p.payment_state) &&
        Date.parse(p.expires_at || p.created_at) +
          (!p.expires_at ? 23 * 3600000 : 0) <=
          Date.now()
      )
        await engine.expire(p.id);
      else await engine.reconcile(p.id);
      processed++;
    } catch {
      attention++;
    } finally {
      // Rotate healthy holds as well as failed operations so a batch cannot starve later rows.
      await db
        .from("reply_payments")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", p.id);
    }
  }
  return Response.json(
    { processed, attention },
    { headers: { "Cache-Control": "no-store" } },
  );
}
