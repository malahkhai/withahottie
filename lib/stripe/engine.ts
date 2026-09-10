/** Provider-independent orchestration. The Store implements atomic, service-only DB transitions. */
export type PaymentState =
  | "pending"
  | "authorized"
  | "captured"
  | "canceled"
  | "refunded"
  | "disputed"
  | "failed";
export interface ReplyPayment {
  id: string;
  interaction_id: string;
  request_id: string;
  fan_id: string;
  creator_id: string;
  creator_account_id: string;
  attempt_key: string;
  message: string;
  gross_cents: number;
  fee_cents: number;
  creator_cents: number;
  currency: string;
  payment_state: PaymentState;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  stripe_transfer_id: string | null;
  stripe_refund_id: string | null;
  stripe_reversal_id: string | null;
  operation: "idle" | "capture" | "decline" | "expire" | "refund";
  transfer_state: string;
  conversation_id: string | null;
  fulfillment_message_id: string | null;
  expires_at: string | null;
  created_at: string;
  authorized_at: string | null;
  accepted_at: string | null;
  captured_at: string | null;
  needs_reconciliation: boolean;
  manual_review?: boolean;
}
export interface Intent {
  id: string;
  status: string;
  amount: number;
  currency: string;
  capturable: number;
  captured: number;
  livemode: boolean;
  manual: boolean;
  charge: string | null;
  captureBefore: number | null;
  clientSecret: string | null;
  paymentId: string;
}
export interface PaymentStore {
  get(id: string): Promise<ReplyPayment>;
  transition(
    id: string,
    action: string,
    actor?: string | null,
    payload?: Record<string, unknown>,
  ): Promise<ReplyPayment>;
}
export interface Provider {
  recover?(p: ReplyPayment): Promise<Intent | null>;
  create(p: ReplyPayment): Promise<Intent>;
  retrieve(id: string): Promise<Intent>;
  capture(p: ReplyPayment): Promise<Intent>;
  cancel(p: ReplyPayment): Promise<Intent>;
  ready(creatorId: string): Promise<boolean>;
  transfer(p: ReplyPayment): Promise<string>;
  refund(p: ReplyPayment): Promise<{ id: string; status: string }>;
  reverse(p: ReplyPayment): Promise<string>;
}
export class PaymentEngine {
  readonly store: PaymentStore;
  readonly provider: Provider;
  readonly ttl: number;
  readonly clock: () => number;
  constructor(
    store: PaymentStore,
    provider: Provider,
    ttl = 86400,
    clock = Date.now,
  ) {
    this.store = store;
    this.provider = provider;
    this.ttl = ttl;
    this.clock = clock;
  }
  async ensureIntent(p: ReplyPayment) {
    const recovered = !p.stripe_payment_intent_id
      ? await this.provider.recover?.(p)
      : null;
    if (
      !p.stripe_payment_intent_id &&
      !recovered &&
      this.clock() - Date.parse(p.created_at) > 23 * 3600000
    )
      throw Error(
        "Checkout has expired. Please contact support before retrying.",
      );
    const intent = p.stripe_payment_intent_id
      ? await this.provider.retrieve(p.stripe_payment_intent_id)
      : recovered || (await this.provider.create(p));
    this.validate(p, intent);
    if (!p.stripe_payment_intent_id)
      await this.store.transition(p.id, "bind", null, { intent: intent.id });
    return intent;
  }
  validate(p: ReplyPayment, i: Intent) {
    if (
      i.livemode ||
      !i.manual ||
      i.paymentId !== p.id ||
      i.amount !== p.gross_cents ||
      i.currency !== p.currency ||
      (p.stripe_payment_intent_id && p.stripe_payment_intent_id !== i.id)
    )
      throw Error("Payment verification failed.");
  }
  async reconcile(id: string) {
    let p = await this.store.get(id);
    if (p.manual_review) return p;
    try {
      let intent = await this.ensureIntent(p);
      p = await this.store.get(id);
      if (intent.status === "requires_capture") {
        if (intent.capturable !== p.gross_cents || !intent.captureBefore)
          throw Error("Authorization is not fully secured.");
        if (
          ["pending", "failed"].includes(p.payment_state) &&
          !p.fulfillment_message_id
        )
          p = await this.store.transition(id, "authorize", null, {
            ttl: this.ttl,
            capture_before: new Date(intent.captureBefore * 1000).toISOString(),
          });
        if (
          p.operation === "idle" &&
          p.expires_at &&
          Date.parse(p.expires_at) <= this.clock()
        )
          p = await this.store.transition(id, "expire");
        if (p.operation === "capture" && p.fulfillment_message_id)
          intent = await this.provider.capture(p);
        else if (["decline", "expire"].includes(p.operation))
          intent = await this.provider.cancel(p);
      } else if (
        ["decline", "expire"].includes(p.operation) &&
        [
          "requires_payment_method",
          "requires_confirmation",
          "requires_action",
        ].includes(intent.status)
      )
        intent = await this.provider.cancel(p);
      if (intent.status === "succeeded") {
        if (intent.captured !== p.gross_cents || !intent.charge)
          throw Error("Captured amount needs investigation.");
        if (!["captured", "refunded", "disputed"].includes(p.payment_state))
          p = await this.store.transition(id, "captured", null, {
            charge: intent.charge,
          });
      } else if (
        intent.status === "requires_payment_method" &&
        p.fulfillment_message_id
      )
        p = await this.store.transition(id, "failed");
      else if (intent.status === "canceled")
        p = await this.store.transition(id, "canceled");
      // A failed authorization never creates a creator-visible request. Card retries use this same intent.
      if (
        p.payment_state === "captured" &&
        p.operation !== "refund" &&
        !p.stripe_transfer_id
      ) {
        if (!(await this.provider.ready(p.creator_id)))
          throw Error("Creator earnings are awaiting payout eligibility.");
        const transfer = await this.provider.transfer(p);
        p = await this.store.transition(id, "transferred", null, { transfer });
      }
      if (p.operation === "refund" && p.payment_state === "captured") {
        const refund = await this.provider.refund(p);
        if (refund.status === "succeeded")
          p = await this.store.transition(id, "refunded", null, {
            refund: refund.id,
            amount: p.gross_cents,
          });
        else throw Error("Refund awaits provider reconciliation.");
      }
      if (
        ["refunded", "disputed"].includes(p.payment_state) &&
        p.stripe_transfer_id &&
        !p.stripe_reversal_id
      ) {
        const reversal = await this.provider.reverse(p);
        p = await this.store.transition(id, "reversed", null, { reversal });
      }
      return p;
    } catch (error) {
      await this.store.transition(id, "attention");
      throw error;
    }
  }
  async accept(id: string, creator: string) {
    let p = await this.store.get(id);
    if (p.accepted_at) return this.store.transition(id, "accept", creator);
    const intent = await this.ensureIntent(p);
    if (
      intent.status !== "requires_capture" ||
      intent.capturable !== p.gross_cents
    )
      throw Error("Funds are no longer secured.");
    p = await this.store.transition(id, "accept", creator);
    return p;
  }
  async decline(id: string, creator: string) {
    await this.store.transition(id, "decline", creator);
    return this.reconcile(id);
  }
  async expire(id: string) {
    await this.store.transition(id, "expire");
    return this.reconcile(id);
  }
  async refund(id: string, admin: string) {
    await this.store.transition(id, "refund", admin);
    return this.reconcile(id);
  }
}
