import { getViewer } from "@/lib/auth/session";
import { stripeConfigurationStatus } from "@/lib/stripe/config";
import { serviceDatabase } from "@/lib/stripe/server";

export async function GET() {
  const viewer = await getViewer();
  if (!viewer || viewer.demo || viewer.role !== "admin")
    return Response.json({ error: "Admin required." }, { status: 403 });
  const configuration = stripeConfigurationStatus();
  const schema: Record<string, boolean> = {};
  try {
    const db = serviceDatabase();
    const checks = {
      creator_stripe_accounts:
        "creator_id,stripe_account_id,ready,transfers_enabled,payouts_enabled,requirements_due",
      reply_payments:
        "id,request_id,interaction_id,stripe_payment_intent_id,stripe_charge_id,stripe_transfer_id,gross_cents,fee_cents,creator_cents,currency,authorized_at,accepted_at,captured_at,completed_at,transferred_at,declined_at,expired_at,manual_review",
      stripe_webhook_events: "id,event_type,attempts,processed_at",
    };
    for (const [table, columns] of Object.entries(checks)) {
      const { error } = await db.from(table).select(columns).limit(0);
      schema[table] = !error;
    }
  } catch {
    for (const table of [
      "creator_stripe_accounts",
      "reply_payments",
      "stripe_webhook_events",
    ])
      schema[table] = false;
  }
  return Response.json(
    {
      configuration,
      schema,
      migrationsRequired: ["202609090005", "202609090006"],
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
