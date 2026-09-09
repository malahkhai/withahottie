# Task 2.5 — payment boundary and security review

This is a code/schema review and local regression check, not a claim of a complete security audit or production payment readiness. No Stripe calls, capture or payout processing are enabled.

| Concept | Current authority / representation |
| --- | --- |
| Interaction | `paid_interactions`: fan, creator, kind, server price, currency and payment state |
| Request | `interaction_requests`: content, expiry, acceptance/decline/fulfillment timestamps; response RPC cannot change money |
| Transaction | `transactions`: separate charge/refund/fee/transfer/dispute ledger events, provider event/object uniqueness; no client writes |
| Stripe reference | `stripe_payment_intent_id` identifies the provider object, not an authorization credential; distinct from internal UUIDs |
| Creator earnings | Derived estimate through `splitPayment`; settled transaction accounting must become authoritative in Task 3 |
| Platform fee | Central `PLATFORM_FEE_BPS=1500`; Task 3 must snapshot fees per interaction instead of recalculating historical earnings after fee changes |

Money columns are PostgreSQL integers in minor units: EUR 4.00 is 400. Currency is a separate lowercase ISO identifier (`eur`, `usd`, `gbp`); display labels can use EUR/USD/GBP. V1 pricing is deliberately EUR-only. Do not imply support for currencies with different minor-unit exponents without defining them. Browser decimal price inputs are validated and converted before storage. A transaction never shares a mutable request status field.

## Reviewed boundaries

- Browser and server Supabase clients use only URL + anon/publishable key. Privileged keys are rejected at Next.js configuration/build startup and in public config; the service-role variable is reserved and never read by client code. Do not put a secret in any `NEXT_PUBLIC_*` variable: build-time validation is not a substitute for correct deployment configuration.
- Private Supabase utilities and auth helpers use `server-only`. Stripe secret/service-role variables are currently unused. No secret-bearing endpoint exists.
- Sensitive tables have RLS and scoped grants. Users cannot write transaction rows or final payment state, and unrelated users cannot read participants’ messages/payment records.
- Signup trigger ignores role metadata. Direct role/verification writes are denied. Creator promotion occurs only in `save_creator_profile`, with `auth.uid()`, validation and row locking; admin role is preserved, never granted by onboarding. Suspended/rejected creators cannot relaunch.
- Fixed a null-action fallthrough in `respond_to_request` with migration 004 and a rollback-only regression. Accept/complete still never capture payment.
- Demo checkout resolves creator offerings through the server repository and ignores supplied totals. Production payment code must additionally enforce authenticated eligibility, blocking, limits and approved creator status rather than treating mock checkout as production authorization.
- Auth destinations are constrained; public sharing and metadata use the configured origin. Loopback callbacks remain local.

## Required in Task 3, not implemented here

Add the private Connect-account mapping, signed webhook endpoint and durable event inbox, fee snapshots, provider reconciliation, idempotent capture/refund/transfer logic, authorization deadlines, entitlement checks, rate limits and ledger-derived creator balances. Only verified provider state should control final financial status. A browser redirect or request completion must never become payment proof. Verify hosted RLS/auth/storage with real project credentials, finalize marketplace terms and review moderation requirements before launch.
