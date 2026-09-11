import { verifyEventSignature } from "./signatures";
import "server-only";
import type Stripe from "stripe";
import { replyService } from "./service";
import { connectStatus } from "./connect";
import { paymentLog } from "./log";
import { accountEvents, paymentEvents } from "./events";
export { accountEvents, paymentEvents } from "./events";
export async function processWebhook(raw: string, signature: string) {
  const { stripe, db, engine, store, config } = replyService();
  const secrets = [
    config.webhook,
    process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
  ].filter((x): x is string => !!x);
  verifyEventSignature(raw, signature, secrets);
  const event = JSON.parse(raw) as {
    id: string;
    type: string;
    livemode?: boolean;
    data: Stripe.Event["data"];
    related_object?: { id: string };
  };
  if (event.livemode === true || !event.id || !event.type)
    throw Error("Only test events are accepted.");
  if (!paymentEvents.has(event.type) && !accountEvents.has(event.type)) {
    paymentLog(event.type, "ignored");
    return;
  }
  const { error: insertError } = await db
    .from("stripe_webhook_events")
    .upsert(
      { id: event.id, event_type: event.type },
      { onConflict: "id", ignoreDuplicates: true },
    );
  if (insertError) throw Error("Event inbox unavailable.");
  const { data: inbox } = await db
    .from("stripe_webhook_events")
    .select("processed_at,attempts")
    .eq("id", event.id)
    .single();
  if (inbox?.processed_at) {
    paymentLog(event.type, "duplicate");
    return;
  }
  await db
    .from("stripe_webhook_events")
    .update({ attempts: (inbox?.attempts || 0) + 1 })
    .eq("id", event.id);
  if (accountEvents.has(event.type)) {
    const id = event.related_object?.id;
    if (!id) throw Error("Missing account reference.");
    const { data: account } = await db
      .from("creator_stripe_accounts")
      .select("creator_id")
      .eq("stripe_account_id", id)
      .maybeSingle();
    if (account) {
      if (event.type === "v2.core.account.closed") {
        const { error } = await db
          .from("creator_stripe_accounts")
          .update({
            ready: false,
            transfers_enabled: false,
            payouts_enabled: false,
            requirements_due: true,
          })
          .eq("creator_id", account.creator_id);
        if (error) throw Error("Account update pending.");
      } else await connectStatus(account.creator_id);
      paymentLog(event.type, "succeeded");
    } else paymentLog(event.type, "unmatched");
  } else {
    const obj = event.data.object;
    let intentId: string | undefined, paymentId: string | undefined;
    if (obj.object === "payment_intent") {
      intentId = obj.id;
      paymentId = obj.metadata.replypass_transaction_id;
    } else if (obj.object === "transfer")
      paymentId = obj.metadata.replypass_transaction_id;
    else if (
      obj.object === "charge" ||
      obj.object === "refund" ||
      obj.object === "dispute"
    ) {
      intentId =
        typeof obj.payment_intent === "string"
          ? obj.payment_intent
          : obj.payment_intent?.id;
    }
    let p;
    if (paymentId) {
      const { data } = await db
        .from("reply_payments")
        .select("id")
        .eq("id", paymentId)
        .maybeSingle();
      if (data) p = await store.get(data.id);
    }
    if (!p && intentId) {
      const { data } = await db
        .from("reply_payments")
        .select("id")
        .eq("stripe_payment_intent_id", intentId)
        .maybeSingle();
      if (data) p = await store.get(data.id);
    }
    if (p) {
      // Ignore snapshot order: retrieve current provider state and reconcile durable operation claims.
      if (intentId) {
        const pi = await stripe.paymentIntents.retrieve(intentId);
        if (
          pi.livemode ||
          pi.metadata.replypass_transaction_id !== p.id ||
          pi.amount !== p.gross_cents ||
          pi.currency !== p.currency
        )
          throw Error("Payment identity mismatch.");
        // A refund/dispute notification can arrive before the capture notification.
        // Record verified capture evidence first, without initiating a transfer.
        if (
          pi.status === "succeeded" &&
          ["pending", "authorized", "failed"].includes(p.payment_state)
        ) {
          const charge =
            typeof pi.latest_charge === "string"
              ? pi.latest_charge
              : pi.latest_charge?.id;
          if (pi.amount_received !== p.gross_cents || !charge)
            throw Error("Captured amount needs investigation.");
          p = await store.transition(p.id, "captured", null, { charge });
        }
      }
      if (obj.object === "dispute") {
        const dispute = await stripe.disputes.retrieve(obj.id);
        // Won disputes still require an explicit reconciliation decision; never silently re-transfer.
        if (dispute.status !== "won")
          p = await store.transition(p.id, "disputed");
        else
          p = await store.transition(p.id, "attention", null, {
            manual_review: true,
          });
      }
      if (obj.object === "charge" || obj.object === "refund") {
        const refunds = await stripe.refunds.list({
          payment_intent: p.stripe_payment_intent_id!,
          limit: 100,
        });
        const successful = refunds.data.filter((r) => r.status === "succeeded");
        const total = successful.reduce((sum, r) => sum + r.amount, 0);
        for (const refund of successful) {
          if (total >= p.gross_cents)
            p = await store.transition(p.id, "refunded", null, {
              refund: refund.id,
              amount: refund.amount,
            });
          else {
            const { error } = await db.from("transactions").upsert(
              {
                interaction_id: p.interaction_id,
                kind: "refund",
                amount_cents: refund.amount,
                currency: p.currency,
                stripe_event_id: `refund:${refund.id}`,
                stripe_object_id: refund.id,
              },
              {
                onConflict: "stripe_event_id,stripe_object_id,kind",
                ignoreDuplicates: true,
              },
            );
            if (error) throw Error("Refund ledger requires retry.");
            p = await store.transition(p.id, "attention", null, {
              manual_review: true,
            });
          }
        }
      }
      if (obj.object === "transfer") {
        const transfer = await stripe.transfers.retrieve(obj.id);
        if (
          transfer.destination !== p.creator_account_id ||
          transfer.amount !== p.creator_cents ||
          transfer.currency !== p.currency ||
          transfer.source_transaction !== p.stripe_charge_id
        )
          throw Error("Transfer verification failed.");
        if (
          transfer.amount_reversed > 0 &&
          transfer.amount_reversed < p.creator_cents
        )
          p = await store.transition(p.id, "attention", null, {
            manual_review: true,
          });
        else if (transfer.reversed)
          p = await store.transition(p.id, "reversed", null, {
            reversal: transfer.reversals.data[0]?.id,
          });
        else if (
          !p.stripe_transfer_id &&
          ["captured", "refunded", "disputed"].includes(p.payment_state)
        )
          p = await store.transition(p.id, "transferred", null, {
            transfer: transfer.id,
          });
      }
      await engine.reconcile(p.id);
      paymentLog(event.type, "succeeded", p.id);
    } else paymentLog(event.type, "unmatched");
  }
  const { error } = await db
    .from("stripe_webhook_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("id", event.id);
  if (error) throw Error("Event processing needs retry.");
}
