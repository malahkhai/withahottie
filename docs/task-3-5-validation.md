# Task 3.5 — real Stripe sandbox validation

This document separates verified code/database facts from external sandbox results. Never mark a row passed from mocks, a browser redirect, or a manually edited database value.

## Current readiness evidence (2026-09-11)

| Check                          | Result             | Evidence                                                                                                              |
| ------------------------------ | ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Supabase payment schema        | Pass               | Required table/column fingerprints for migrations 005 and 006 respond through the service API                         |
| Published real creator         | Pass               | One Supabase creator is published; demo Stella is excluded                                                            |
| Separate real fan              | Blocked            | Production currently has no second fan profile                                                                        |
| Stripe test keys               | Blocked            | All Stripe variables are absent locally; Vercel CLI is not authenticated, so hosted values could not be inspected     |
| Connected account              | Blocked            | `creator_stripe_accounts` contains zero records                                                                       |
| Apex webhook URL               | Blocked            | POST to `getreplypass.com/api/stripe/webhook` redirects to `www`; direct unsigned POST to `www` correctly returns 400 |
| Webhook signature/replay       | Partially verified | Raw signature, timestamp, event inbox and idempotency are automated; real Stripe delivery/replay is blocked           |
| Authorization/capture/transfer | Blocked            | No real Stripe sandbox credentials or eligible connected account                                                      |
| Decline/expiry release         | Blocked externally | Provider mocks and SQL transitions pass; no real authorization exists to release                                      |

Run `npm run payment:readiness` after configuration. It reports only key shapes, counts, booleans and HTTP status; it never prints environment values, user identifiers or Stripe object IDs. The authenticated admin endpoint `/api/admin/payments/readiness` provides the same safe configuration/schema class of information for a deployed build.

## Required external setup before the proof run

1. In Vercel, make `getreplypass.com` the primary domain so the exact webhook URL responds directly. If `www` must remain primary, register `https://www.getreplypass.com/api/stripe/webhook` in Stripe and update the documented production endpoint decision consistently.
2. Add valid sandbox values for `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET`, and a 32+ character `CRON_SECRET`. Add them together and redeploy. Never paste them into source control or chat.
3. Configure the two event destinations exactly as listed in `docs/setup.md`. Snapshot and Accounts v2 thin destinations can deliver to the same final URL, but each has its own signing secret.
4. Sign into the real creator, complete `/creator/payouts`, then confirm transfers and payouts are active with no user-action requirements. Only Stripe state can set readiness. Enable Guaranteed Reply afterward in `/creator/profile`.
5. Create a separate real fan through the creator’s `@username` page. Use only Stripe test cards.
6. Configure a trusted five-minute scheduler for the protected cron route. For the expiry proof, temporarily set `REPLY_EXPIRY_SECONDS=60`, redeploy, authorize a fresh request, wait past expiry, invoke the cron with its bearer secret, then restore `86400` and redeploy.

## Evidence to record for each scenario

For success, record the internal request/payment UUID and confirm its PaymentIntent, Charge, Transfer, connected account, amount, currency, fee/net snapshot and timestamps agree in Stripe and Supabase. Do not paste card data, secrets, message content, user email, or raw webhook bodies into this document.

| Scenario         | Required proof                                                                                                                                                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Success          | `requires_capture` after authorization and after Accept; one conversation; one fulfillment claim; one €4 capture; one €3.40 transfer; €0.60 platform snapshot; matching IDs/timestamps; second simultaneous reply creates no second financial operation |
| Decline          | PaymentIntent canceled; request declined; all earnings zero; repeated Decline is safe                                                                                                                                                                   |
| Expiry           | PaymentIntent canceled after protected cron; request expired; all earnings zero; test both unaccepted and accepted-without-reply                                                                                                                        |
| Failed card      | No active creator request and no earnings                                                                                                                                                                                                               |
| SCA              | Authentication completes into `requires_capture`, or failure leaves no active request                                                                                                                                                                   |
| Duplicate/replay | Same checkout attempt, double Accept, double Decline, refresh and webhook resend create no duplicate order, conversation, capture, transfer or ledger entries                                                                                           |

Final Task 3.5 completion requires filling these rows with actual sandbox evidence. Automated provider tests remain supporting evidence, not a substitute.
