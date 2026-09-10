# Task 3 — test payment boundaries and security review

This records the implementation and local checks, not a comprehensive security audit or live-payment launch approval. Real Stripe sandbox onboarding/payment and hosted Supabase authentication remain unverified until account configuration. Live Stripe keys are rejected.

| Concept | Authority |
| --- | --- |
| Interaction | `paid_interactions`: offering, fan, creator and immutable payment snapshot linkage |
| Request | `interaction_requests`: created only after authorization, independently accepted/fulfilled/declined/expired |
| Payment | `reply_payments`: immutable integer minor-unit gross/fee/net/currency/account snapshot, Stripe references, durable capture/refund claims and reconciliation state |
| Ledger | `transactions`: unique charge, fee, transfer and refund entries, no client writes |
| Payout account | `creator_stripe_accounts`: service-only Accounts v2 recipient mapping and eligibility flags; no public KYC details |
| Event inbox | `stripe_webhook_events`: verified event ID/type, attempts and completion timestamp; no raw sensitive event payload |

## Enforced boundaries

- Supabase service-role and Stripe secret/signing keys are imported only by server-only utilities. Public configuration rejects privileged Supabase keys. A build using fake privileged sentinel strings was scanned to verify those values were absent from client artifacts.
- Server authentication supplies fan/creator IDs. APIs enforce ownership and same-origin mutations. Admin refunds require a trusted profile role; onboarding and signup cannot grant admin. Browser totals, currency, fee percentage and destination account are ignored.
- Service-only financial tables have RLS and no anon/authenticated grants. Legacy user-executable request/message mutation RPCs are revoked so they cannot bypass the qualifying-reply handler. Ordinary messages still use trusted server submission with SQL membership/block checks, even when Stripe is absent.
- Checkout atomically reads enabled pricing, creator availability, blocks and stored eligibility; server code refreshes Stripe eligibility before it. Financial snapshots are immutable. Currency is separate lowercase ISO (`eur`, `usd`, `gbp`); current pricing UI is EUR-only. Amounts and fee rounding use integers.
- Unique fan/attempt keys plus advisory locks prevent duplicated order preparation. Creator/message parameters are checked when reusing the same attempt. Stripe operations use deterministic idempotency keys; provider recovery searches precede retrying an unknown creation. Unknown creation older than 23 hours stops for investigation rather than risking a second authorization/account after key retention expires.
- Acceptance and first reply lock the payment row. The first non-empty creator reply in the correct accepted conversation, before its deadline, is persisted with one capture claim. Concurrent replies retain both messages but have one fulfillment claim. Capture happens afterward. No manual completion endpoint exists for secured requests.
- Stripe state and exact amount/currency/metadata are verified before financial transitions. Signatures cover the raw body with timestamp tolerance. Inbox completion occurs only after successful reconciliation; repeated or out-of-order notifications use current provider state and idempotent writes.
- Capture failures retain the reply for retry. Transfer failures retain captured earnings liability. Declines/expiry cancel a hold; admin refunds after capture reverse transferred earnings. Partial external refunds/reversals and won disputes pause automation for manual review.
- The protected cron uses a timing-safe bearer comparison, bounded batches, rotating update timestamps and idempotent operations. Database deadlines reject late acceptance/replies even if the scheduler is delayed. The scheduler must actually be deployed or invoked locally for automatic cancellation.

## Checks and practical limits

Unit tests exercise provider mismatch/tampering, failed authorization, replayed transitions, duplicate mutation keys, deadlines, capture/transfer failure recovery, refunds and forged signatures. SQL suites exercise role escalation, RLS, IDOR, direct financial mutation, immutable prices/currency/fee/account snapshots and legacy bypass revocation. Concurrent SQL connections test checkout, accept and first-reply races. Mobile browser tests cover demo regressions and mocked Stripe checkout confirmation semantics.

Mocks do not validate Stripe account country availability, hosted KYC, actual SCA/wallet behavior, issuer hold release or deployed webhook delivery. Follow `docs/setup.md` for the hosted sandbox acceptance run. Monitor rows requiring reconciliation and webhook/cron failures. Manual review is an operator workflow, not an automatic assertion of success. Transfers reflect the creator's Stripe balance; bank payout completion is not claimed.

Before any later live launch, complete legal/trust policies, operational monitoring and recovery procedures, account/country approvals, abuse/rate controls and a separate production security review. No live payment mode or Task 4 features are enabled here.
