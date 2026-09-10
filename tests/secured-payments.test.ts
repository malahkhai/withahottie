import assert from "node:assert/strict";
import test from "node:test";
import Stripe from "stripe";
import {
  PaymentEngine,
  type ReplyPayment,
  type Intent,
  type PaymentStore,
  type Provider,
} from "../lib/stripe/engine.ts";
import { stripeConfig } from "../lib/stripe/config.ts";
import { verifyEventSignature } from "../lib/stripe/signatures.ts";
function fixture() {
  let now = Date.now();
  const p = {
    id: "order",
    interaction_id: "interaction",
    request_id: "request",
    fan_id: "fan",
    creator_id: "creator",
    creator_account_id: "acct_test",
    attempt_key: "attempt",
    message: "A meaningful question",
    gross_cents: 400,
    fee_cents: 60,
    creator_cents: 340,
    currency: "eur",
    payment_state: "pending",
    stripe_payment_intent_id: null,
    stripe_charge_id: null,
    stripe_transfer_id: null,
    stripe_refund_id: null,
    stripe_reversal_id: null,
    operation: "idle",
    transfer_state: "not_due",
    conversation_id: null,
    fulfillment_message_id: null,
    expires_at: null,
    created_at: new Date(now).toISOString(),
    authorized_at: null,
    accepted_at: null,
    captured_at: null,
    needs_reconciliation: false,
  } as ReplyPayment;
  const i: Intent = {
    id: "pi_test",
    status: "requires_payment_method",
    amount: 400,
    currency: "eur",
    capturable: 0,
    captured: 0,
    livemode: false,
    manual: true,
    charge: "ch_test",
    captureBefore: Math.floor(now / 1000) + 7 * 86400,
    clientSecret: "test_secret",
    paymentId: "order",
  };
  let requests = 0,
    conversations = 0,
    captureFail = false,
    transferFail = false,
    ready = true;
  const operations = new Set<string>();
  const store: PaymentStore = {
    async get() {
      return { ...p };
    },
    async transition(_id, action, actor, payload = {}) {
      if (
        ["accept", "decline", "reply"].includes(action) &&
        actor !== "creator"
      )
        throw Error("Not authorized");
      if (action === "bind")
        p.stripe_payment_intent_id = String(payload.intent);
      if (action === "authorize" && p.payment_state === "pending") {
        p.payment_state = "authorized";
        p.authorized_at = new Date(now).toISOString();
        p.expires_at = new Date(now + Number(payload.ttl) * 1000).toISOString();
        requests++;
      }
      if (action === "accept" && !p.accepted_at) {
        if (
          p.payment_state !== "authorized" ||
          Date.parse(p.expires_at!) <= now ||
          p.operation !== "idle"
        )
          throw Error("Expired");
        p.accepted_at = new Date(now).toISOString();
        p.conversation_id = "conversation";
        conversations++;
      }
      if (action === "decline" || action === "expire") {
        if (p.fulfillment_message_id)
          throw Error("Fulfillment already claimed");
        if (action === "expire" && Date.parse(p.expires_at!) > now)
          throw Error("Not expired");
        if (p.payment_state === "authorized") p.operation = action;
      }
      if (action === "captured") {
        assert.ok(p.fulfillment_message_id);
        p.payment_state = "captured";
        p.stripe_charge_id = String(payload.charge);
        p.captured_at = new Date(now).toISOString();
        p.transfer_state = "pending";
      }
      if (action === "canceled") p.payment_state = "canceled";
      if (action === "transferred") {
        p.stripe_transfer_id = String(payload.transfer);
        p.transfer_state = "transferred";
        p.needs_reconciliation = false;
      }
      if (action === "attention") p.needs_reconciliation = true;
      if (action === "refund") {
        if (actor !== "admin") throw Error("Admin required");
        p.operation = "refund";
      }
      if (action === "refunded") {
        p.payment_state = "refunded";
        p.stripe_refund_id = String(payload.refund);
      }
      if (action === "reversed") {
        p.stripe_reversal_id = String(payload.reversal);
        p.transfer_state = "reversed";
      }
      return { ...p };
    },
  };
  const provider: Provider = {
    async create() {
      operations.add("create");
      return { ...i };
    },
    async retrieve() {
      return { ...i };
    },
    async ready() {
      return ready;
    },
    async capture() {
      if (captureFail) throw Error("Provider capture timeout");
      operations.add("capture");
      i.status = "succeeded";
      i.captured = 400;
      i.capturable = 0;
      return { ...i };
    },
    async cancel() {
      operations.add("cancel");
      i.status = "canceled";
      return { ...i };
    },
    async transfer(value) {
      assert.equal(i.status, "succeeded");
      assert.equal(value.creator_cents, 340);
      if (transferFail) throw Error("Transfer failed");
      operations.add("transfer");
      return "tr_test";
    },
    async refund() {
      operations.add("refund");
      return { id: "re_test", status: "succeeded" };
    },
    async reverse() {
      operations.add("reverse");
      return "trr_test";
    },
  };
  const engine = new PaymentEngine(store, provider, 86400, () => now);
  return {
    p,
    i,
    engine,
    operations,
    get requests() {
      return requests;
    },
    get conversations() {
      return conversations;
    },
    authorize() {
      i.status = "requires_capture";
      i.capturable = 400;
    },
    reply() {
      assert.ok(p.accepted_at);
      p.fulfillment_message_id = "message";
      p.operation = "capture";
    },
    advance() {
      now += 86401000;
    },
    captureFailure() {
      captureFail = true;
    },
    transferFailure() {
      transferFail = true;
    },
    disablePayouts() {
      ready = false;
    },
  };
}
test("secured reply: authorize, accept without capture, first reply captures and transfers snapshot net", async () => {
  const f = fixture();
  await f.engine.ensureIntent(f.p);
  assert.equal(f.requests, 0);
  f.authorize();
  await f.engine.reconcile("order");
  assert.equal(f.requests, 1);
  await f.engine.accept("order", "creator");
  assert.equal(f.p.payment_state, "authorized");
  assert.ok(!f.operations.has("capture"));
  f.reply();
  await f.engine.reconcile("order");
  assert.equal(f.p.payment_state, "captured");
  assert.equal(f.p.transfer_state, "transferred");
  assert.equal(f.p.gross_cents, f.p.fee_cents + f.p.creator_cents);
});
test("insufficient funds or declined authorization never reaches creator", async () => {
  const f = fixture();
  await f.engine.reconcile("order");
  assert.equal(f.requests, 0);
  assert.equal(f.p.payment_state, "pending");
  assert.ok(!f.operations.has("capture"));
});
test("decline cancels hold and repeated decline is safe", async () => {
  const f = fixture();
  f.authorize();
  await f.engine.reconcile("order");
  await f.engine.decline("order", "creator");
  await f.engine.decline("order", "creator");
  assert.equal(f.p.payment_state, "canceled");
  assert.ok(!f.operations.has("capture"));
});
for (const accepted of [false, true])
  test(`expiration releases funds with accepted=${accepted}`, async () => {
    const f = fixture();
    f.authorize();
    await f.engine.reconcile("order");
    if (accepted) await f.engine.accept("order", "creator");
    f.advance();
    await f.engine.expire("order");
    await f.engine.reconcile("order");
    assert.equal(f.p.payment_state, "canceled");
    assert.ok(!f.operations.has("capture"));
  });
test("duplicate authorization, accept, capture and transfer are idempotent", async () => {
  const f = fixture();
  f.authorize();
  await f.engine.reconcile("order");
  await f.engine.reconcile("order");
  assert.equal(f.requests, 1);
  await Promise.all([
    f.engine.accept("order", "creator"),
    f.engine.accept("order", "creator"),
  ]);
  assert.equal(f.conversations, 1);
  f.reply();
  await Promise.all([f.engine.reconcile("order"), f.engine.reconcile("order")]);
  await f.engine.reconcile("order");
  assert.deepEqual([...f.operations].sort(), ["capture", "create", "transfer"]);
});
test("capture failure retains reply and reconciliation flag without fake earnings", async () => {
  const f = fixture();
  f.authorize();
  await f.engine.reconcile("order");
  await f.engine.accept("order", "creator");
  f.reply();
  f.captureFailure();
  await assert.rejects(f.engine.reconcile("order"));
  assert.equal(f.p.fulfillment_message_id, "message");
  assert.equal(f.p.payment_state, "authorized");
  assert.equal(f.p.needs_reconciliation, true);
  assert.ok(!f.operations.has("transfer"));
});
test("transfer failure preserves captured earnings liability without declaring a transfer", async () => {
  const f = fixture();
  f.authorize();
  await f.engine.reconcile("order");
  await f.engine.accept("order", "creator");
  f.reply();
  f.transferFailure();
  await assert.rejects(f.engine.reconcile("order"));
  assert.equal(f.p.payment_state, "captured");
  assert.equal(f.p.stripe_transfer_id, null);
  assert.equal(f.p.needs_reconciliation, true);
});
test("ineligible creator cannot receive transfer; funds remain a recorded liability", async () => {
  const f = fixture();
  f.authorize();
  await f.engine.reconcile("order");
  await f.engine.accept("order", "creator");
  f.reply();
  f.disablePayouts();
  await assert.rejects(f.engine.reconcile("order"));
  assert.equal(f.p.stripe_transfer_id, null);
});
test("refund after capture and transfer reverses creator share; fan cannot refund", async () => {
  const f = fixture();
  f.authorize();
  await f.engine.reconcile("order");
  await f.engine.accept("order", "creator");
  f.reply();
  await f.engine.reconcile("order");
  await assert.rejects(f.engine.refund("order", "fan"));
  await f.engine.refund("order", "admin");
  assert.equal(f.p.payment_state, "refunded");
  assert.equal(f.p.transfer_state, "reversed");
});
test("wrong creator and expired acceptance fail; mismatched provider money never authorizes", async () => {
  const f = fixture();
  f.authorize();
  await f.engine.reconcile("order");
  await assert.rejects(f.engine.accept("order", "intruder"));
  f.advance();
  await assert.rejects(f.engine.accept("order", "creator"));
  for (const change of [
    { amount: 1 },
    { currency: "usd" },
    { paymentId: "another" },
    { livemode: true },
    { manual: false },
  ]) {
    const g = fixture();
    g.authorize();
    Object.assign(g.i, change);
    await assert.rejects(g.engine.reconcile("order"));
    assert.equal(g.requests, 0);
  }
});
test("Stripe configuration is absent or test-only; partial/live configuration never enables demo fallback", () => {
  assert.equal(stripeConfig({}), null);
  for (const env of [
    { STRIPE_SECRET_KEY: "sk_live_bad" },
    { NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: "pk_test_incomplete" },
    { STRIPE_WEBHOOK_SECRET: "whsec_only" },
  ])
    assert.throws(() => stripeConfig(env));
});
test("raw Stripe signatures reject forged, modified and stale events", () => {
  const stripe = new Stripe("sk_test_fake");
  const secret = "whsec_test_signing_secret";
  const body = JSON.stringify({
    id: "evt_test",
    type: "payment_intent.succeeded",
  });
  const header = stripe.webhooks.generateTestHeaderString({
    payload: body,
    secret,
  });
  verifyEventSignature(body, header, [secret]);
  assert.throws(() => verifyEventSignature(body, header, ["whsec_wrong"]));
  assert.throws(() => verifyEventSignature(body + " ", header, [secret]));
  const stale = stripe.webhooks.generateTestHeaderString({
    payload: body,
    secret,
    timestamp: 1,
  });
  assert.throws(() => verifyEventSignature(body, stale, [secret]));
});
