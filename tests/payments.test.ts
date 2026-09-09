import assert from "node:assert/strict";
import test from "node:test";
import { demoQuote } from "../lib/payments/demo.ts";
import { canTransition } from "../lib/payments/model.ts";
import { paymentStatuses } from "../types/domain.ts";
test("server owns price and ignores client-supplied totals", () => {
  assert.deepEqual(
    demoQuote({
      kind: "message",
      message: "Hello Stella",
      amountCents: 1,
      status: "captured",
    }),
    { mode: "demo", amountCents: 400, currency: "eur", charged: false },
  );
});
test("all offerings use integer EUR minor units", () => {
  for (const [kind, amount] of [
    ["message", 400],
    ["voice_note", 1000],
    ["photo", 1500],
    ["video", 3000],
    ["vip", 1900],
  ] as const) {
    assert.equal(demoQuote({ kind, message: "Hello" })?.amountCents, amount);
  }
  assert.equal(
    demoQuote({ kind: "live_chat", message: "Hello", minutes: 5 })?.amountCents,
    1500,
  );
});
test("invalid or unbounded requests cannot reach checkout", () => {
  for (const value of [
    null,
    {},
    { kind: "__proto__", message: "hello" },
    { kind: "message", message: " " },
    { kind: "message", message: "x".repeat(2001) },
    { kind: "live_chat", message: "Hi", minutes: -1 },
    { kind: "live_chat", message: "Hi", minutes: 31 },
    { kind: "live_chat", message: "Hi", minutes: 1.5 },
  ])
    assert.equal(demoQuote(value), null);
});
test("authorization and acceptance must precede capture", () => {
  assert.equal(canTransition("pending", "captured"), false);
  assert.equal(canTransition("authorized", "captured"), false);
  assert.equal(canTransition("accepted", "captured"), true);
  assert.equal(canTransition("authorized", "expired"), true);
  assert.equal(canTransition("completed", "refunded"), true);
  for (const status of paymentStatuses)
    assert.equal(canTransition(status, status), false);
  for (const status of paymentStatuses)
    assert.equal(canTransition("expired", status), false);
});
