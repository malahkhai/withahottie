import "server-only";
import type Stripe from "stripe";
import { paymentBackend } from "./server";
import { connectStatus } from "./connect";
import { PaymentEngine, type Intent, type ReplyPayment } from "./engine";
import { PLATFORM_FEE_BPS } from "@/lib/payments/fees";
function snapshot(pi: Stripe.PaymentIntent): Intent {
  const charge = typeof pi.latest_charge === "object" ? pi.latest_charge : null;
  return {
    id: pi.id,
    status: pi.status,
    amount: pi.amount,
    currency: pi.currency,
    capturable: pi.amount_capturable,
    captured: pi.amount_received,
    livemode: pi.livemode,
    manual: pi.capture_method === "manual",
    charge:
      typeof pi.latest_charge === "string"
        ? pi.latest_charge
        : charge?.id || null,
    captureBefore: charge?.payment_method_details?.card?.capture_before || null,
    clientSecret: pi.client_secret,
    paymentId: pi.metadata.replypass_transaction_id,
  };
}
export function replyService() {
  const { stripe, db, config } = paymentBackend();
  const store = {
    async get(id: string): Promise<ReplyPayment> {
      const { data, error } = await db
        .from("reply_payments")
        .select("*")
        .eq("id", id)
        .single();
      if (error || !data) throw Error("Request unavailable.");
      return data;
    },
    async transition(
      id: string,
      action: string,
      actor: string | null = null,
      payload: Record<string, unknown> = {},
    ) {
      const { data, error } = await db.rpc("reply_transition", {
        payment: id,
        action,
        actor,
        payload,
      });
      if (error) throw Error(error.message);
      return data as ReplyPayment;
    },
  };
  const retrieve = async (id: string) =>
    snapshot(
      await stripe.paymentIntents.retrieve(id, { expand: ["latest_charge"] }),
    );
  const engine = new PaymentEngine(
    store,
    {
      retrieve,
      async recover(p) {
        const result = await stripe.paymentIntents.search({
          query: `metadata['replypass_transaction_id']:'${p.id}'`,
          limit: 10,
        });
        if (result.data.length > 1)
          throw Error("Multiple provider payments require investigation.");
        return result.data[0] ? retrieve(result.data[0].id) : null;
      },
      async create(p) {
        const pi = await stripe.paymentIntents.create(
          {
            amount: p.gross_cents,
            currency: p.currency,
            capture_method: "manual",
            payment_method_types: ["card"],
            transfer_group: p.id,
            metadata: {
              replypass_request_id: p.request_id,
              replypass_transaction_id: p.id,
              creator_id: p.creator_id,
              fan_id: p.fan_id,
              interaction_type: "guaranteed_reply",
            },
          },
          { idempotencyKey: `replypass:intent:${p.id}` },
        );
        return snapshot(pi);
      },
      async capture(p) {
        await stripe.paymentIntents.capture(
          p.stripe_payment_intent_id!,
          { amount_to_capture: p.gross_cents },
          { idempotencyKey: `replypass:capture:${p.id}` },
        );
        return retrieve(p.stripe_payment_intent_id!);
      },
      async cancel(p) {
        await stripe.paymentIntents.cancel(
          p.stripe_payment_intent_id!,
          { cancellation_reason: "requested_by_customer" },
          { idempotencyKey: `replypass:cancel:${p.id}` },
        );
        return retrieve(p.stripe_payment_intent_id!);
      },
      async ready(id) {
        return (await connectStatus(id)).ready;
      },
      async transfer(p) {
        // Search durable provider state before retrying beyond Stripe's idempotency retention window.
        const existing = await stripe.transfers.list({
          transfer_group: p.id,
          limit: 10,
        });
        const match = existing.data.find(
          (t) => t.metadata.replypass_transaction_id === p.id,
        );
        if (match) {
          if (
            match.amount !== p.creator_cents ||
            match.destination !== p.creator_account_id
          )
            throw Error("Transfer mismatch.");
          return match.id;
        }
        return (
          await stripe.transfers.create(
            {
              amount: p.creator_cents,
              currency: p.currency,
              destination: p.creator_account_id,
              source_transaction: p.stripe_charge_id!,
              transfer_group: p.id,
              metadata: { replypass_transaction_id: p.id },
            },
            { idempotencyKey: `replypass:transfer:${p.id}` },
          )
        ).id;
      },
      async refund(p) {
        const existing = await stripe.refunds.list({
          payment_intent: p.stripe_payment_intent_id!,
          limit: 100,
        });
        const match = existing.data.find(
          (r) => r.metadata?.replypass_transaction_id === p.id,
        );
        const refund =
          match ||
          (await stripe.refunds.create(
            {
              payment_intent: p.stripe_payment_intent_id!,
              amount: p.gross_cents,
              metadata: { replypass_transaction_id: p.id },
            },
            { idempotencyKey: `replypass:refund:${p.id}` },
          ));
        return { id: refund.id, status: refund.status || "pending" };
      },
      async reverse(p) {
        const existing = await stripe.transfers.listReversals(
          p.stripe_transfer_id!,
          { limit: 100 },
        );
        const match = existing.data.find(
          (r) => r.metadata?.replypass_transaction_id === p.id,
        );
        if (match) return match.id;
        return (
          await stripe.transfers.createReversal(
            p.stripe_transfer_id!,
            { metadata: { replypass_transaction_id: p.id } },
            { idempotencyKey: `replypass:reverse:${p.id}` },
          )
        ).id;
      },
    },
    config.expirySeconds,
  );
  return { stripe, db, engine, store, config };
}
export async function prepareCheckout(
  fanId: string,
  creatorId: string,
  attempt: string,
  message: string,
) {
  const service = replyService();
  if (!(await connectStatus(creatorId)).ready)
    throw Error(
      "This creator needs to finish payout setup before accepting paid requests.",
    );
  const { data, error } = await service.db.rpc("prepare_reply", {
    fan: fanId,
    creator: creatorId,
    attempt,
    content: message,
    fee_basis: PLATFORM_FEE_BPS,
  });
  if (error)
    throw Error(
      "This request could not be started. Check availability and try again.",
    );
  const p = data as ReplyPayment;
  if (["canceled", "refunded", "disputed", "failed"].includes(p.payment_state))
    throw Error("This attempt is closed. Start a new request.");
  const pi = await service.engine.ensureIntent(p);
  return {
    id: p.id,
    clientSecret: pi.clientSecret,
    amountCents: p.gross_cents,
    currency: p.currency,
  };
}
export async function ownedPayment(
  id: string,
  userId: string,
  side: "fan" | "creator",
) {
  const { db, store } = replyService();
  const p = await store.get(id);
  if (side === "fan" && p.fan_id === userId) return p;
  if (side === "creator") {
    const { data } = await db
      .from("creator_profiles")
      .select("id")
      .eq("id", p.creator_id)
      .eq("profile_id", userId)
      .maybeSingle();
    if (data) return p;
  }
  throw Error("Request unavailable.");
}
