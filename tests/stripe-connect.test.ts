import assert from "node:assert/strict";
import test from "node:test";
import { payoutReadiness } from "../lib/stripe/connect-state.ts";

test("active payout capabilities make a connected account ready", () => {
  assert.deepEqual(
    payoutReadiness({
      transfersStatus: "active",
      payoutsStatus: "active",
      requirements: [
        {
          awaiting_action_from: "user",
          minimum_deadline: { status: "eventually_due" },
        },
      ],
    }),
    {
      transfers: true,
      payouts: true,
      requirementsDue: false,
      ready: true,
    },
  );
});

test("current requirements remain visible without overriding capability state", () => {
  assert.deepEqual(
    payoutReadiness({
      transfersStatus: "active",
      payoutsStatus: "active",
      requirements: [
        {
          awaiting_action_from: "user",
          minimum_deadline: { status: "currently_due" },
        },
      ],
    }),
    {
      transfers: true,
      payouts: true,
      requirementsDue: true,
      ready: true,
    },
  );
});

test("inactive capabilities keep payout setup incomplete", () => {
  assert.deepEqual(payoutReadiness({ transfersStatus: "pending" }), {
    transfers: false,
    payouts: false,
    requirementsDue: false,
    ready: false,
  });
});
