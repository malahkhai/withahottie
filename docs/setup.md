# ReplyPass setup: Supabase → Vercel → Stripe test mode

Task 3 deliberately rejects live Stripe keys. Completing this guide enables sandbox transactions only. Hosted authentication, Connect onboarding and an actual Stripe sandbox payment still need to be verified using your own accounts; automated tests use mocks and a disposable PostgreSQL database.

## 1. Supabase

1. Create a Supabase project. Save its database password privately.
2. In the SQL editor, run each file in `supabase/migrations/` in filename order, 001 through 006. Run each file once. If this project already has Task 2.5, run only **005 and 006**. Alternatively use a linked Supabase CLI project and `supabase db push`.
3. Under the project's API settings, copy the project URL, public anon/publishable key and service-role key into local `.env.local` or Vercel environment settings. Never put the service-role key in a `NEXT_PUBLIC_` variable. It is now required for trusted message and financial RPCs.
4. Enable email/password authentication. Configure email confirmation, SMTP delivery and a 12-character minimum password policy. Signup creates a fan profile automatically; creator onboarding promotes the authenticated fan through a constrained database function. Never assign admin through signup metadata.
5. Set Auth Site URL to `https://getreplypass.com`. Allow `https://getreplypass.com/auth/callback`, `http://localhost:3000/auth/callback`, and the local origin you actually use (for example `http://127.0.0.1:3003/auth/callback`). Also allow those callback URLs with `?next=%2Faccount`, `?next=%2Fcreator%2Fapply`, and `?next=%2Fcreator%2Fdashboard`. Preview deployments need an explicitly trusted app origin and matching callback allowlist.
6. The migrations create public avatar and private conversation attachment buckets. Keep the `private` schema out of exposed API schemas. Ensure `messages` belongs to `supabase_realtime` if using live conversation updates; migration 002 adds it when that publication exists.
7. Sign up as a creator through `/creator/apply`. Use a second account as a fan. Demo Stella is fictional fallback data and cannot receive a Stripe payment: use the real creator's `/@username` page.

Migration 006 disables existing Guaranteed Reply pricing until payout eligibility is established. After completing Stripe onboarding, return to `/creator/profile`, enable Guaranteed Reply and save. Other paid offerings remain demos.

## 2. Vercel and domain

1. Import `malahkhai/Replypass` from GitHub into a Vercel project named `replypass`. Use Next.js, repository root, Node.js 22.x, `npm ci`, and `npm run build`.
2. Add `NEXT_PUBLIC_APP_URL=https://getreplypass.com` and the three Supabase variables. For an initial non-payment deployment, leave **all Stripe variables absent**. Add the entire Stripe configuration together in step 3; partial configuration intentionally fails the build.
3. Add `getreplypass.com` in Vercel's domain settings. At your registrar/DNS provider, enter the exact DNS records Vercel provides. Wait for domain verification and HTTPS. The visible product name is ReplyPass.
4. The committed `vercel.json` runs `/api/cron/payments` every five minutes. This requires Vercel Pro/Enterprise; Hobby rejects sub-daily schedules. For Hobby, remove the cron entry and provide an external trusted scheduler with the same frequency before testing expiration. Do not replace it with a daily financial reconciliation job. [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing).
5. Set `CRON_SECRET` to a random value of at least 32 characters. Vercel supplies it as a bearer token to cron requests. Do not expose this value in the browser. Local cron is not automatic.
6. Redeploy whenever public environment values change. Check `/@stella`, `/signup`, email confirmation, `/creator/apply`, `/creator/payouts`, `/creator/requests` and `/account/requests`.

Do not purchase a plan or modify DNS through an automated script without reviewing the account/domain settings. No hosting, DNS or external account configuration was performed by the implementation task. Legal routes remain draft placeholders requiring review before public launch.

## 3. Stripe sandbox and Connect

1. Create/sign in to Stripe and select a sandbox/test environment. Configure it as a Connect marketplace with Accounts v2 support. Use the same sandbox for the platform keys and connected creators. Stripe must support the platform and creator countries you select.
2. Add `STRIPE_SECRET_KEY=sk_test_…` and `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_…`. Never enter a live key. Create webhook destinations as below and set their signing secrets before rebuilding. A prefix alone cannot verify that a key is valid: invalid credentials produce an error, never fake success.
3. This integration creates an Accounts v2 **recipient** configuration with an **Express dashboard**, hosted v2 Account Links, and application responsibility for Stripe fees/losses. Stripe hosts identity/bank collection. ReplyPass stores the account ID privately and exposes only eligibility booleans. [Stripe marketplace architecture](https://docs.stripe.com/connect/marketplace/quickstart).
4. From the real creator account, open `/creator/payouts` → **Set up payouts**, complete Stripe's sandbox onboarding using its test data, and return. Both transfers and payouts must be active with no user-action requirements. Returning from Stripe alone does not mark the creator ready.
5. Enable Guaranteed Reply in `/creator/profile`. Use another real Supabase fan account to test checkout. Do not use real card details. Cards are handled by Stripe's Payment Element; the app's server never receives card numbers.
6. Apple Pay/Google Pay can appear for supported card wallets after the relevant Stripe payment-method domain registration and browser/device setup. Plain card checkout is the baseline. No asynchronous bank methods are enabled.

## 4. Webhooks and local CLI

Hosted endpoint: `https://getreplypass.com/api/stripe/webhook`.

Create a sandbox snapshot event destination for the platform payments and a sandbox thin event destination for Accounts v2 account changes. Both deliver to this route; put their signing secrets in `STRIPE_WEBHOOK_SECRET` and `STRIPE_CONNECT_WEBHOOK_SECRET` respectively. Use the API version matching the pinned Stripe SDK for snapshot events. Ensure deployment protection does not intercept signed webhook requests.

Snapshot event subscriptions:

```text
payment_intent.amount_capturable_updated
payment_intent.succeeded
payment_intent.canceled
payment_intent.payment_failed
charge.refunded
charge.dispute.created
charge.dispute.updated
charge.dispute.closed
refund.created
refund.updated
refund.failed
transfer.created
transfer.updated
transfer.reversed
```

Accounts v2 thin event subscriptions:

```text
v2.core.account.updated
v2.core.account.closed
v2.core.account[configuration.recipient].capability_status_updated
v2.core.account[configuration.recipient].updated
v2.core.account[requirements].updated
```

For local development, install the official Stripe CLI, then:

```sh
stripe login
stripe listen --forward-to http://localhost:3000/api/stripe/webhook \
  --thin-events '*' --forward-thin-to http://localhost:3000/api/stripe/webhook
```

Use the listener's displayed signing secret in `.env.local`; if separate listeners/destinations provide separate secrets, set the Connect variable as well. CLI signing secrets differ from hosted destination secrets. Restart Next.js after editing environment values. Only supported events listed above are processed. [Official CLI flags](https://docs.stripe.com/cli/listen).

A generated `stripe trigger` payment is unrelated to a ReplyPass order and is deliberately ignored. Test through ReplyPass checkout so metadata and internal payment identity match. Use Stripe's resend operation to replay a real sandbox event and verify no duplicate ledger entry or transfer.

## 5. Run the complete sandbox scenario

1. As fan, request a €4 guaranteed reply on the real creator profile. Use `4242 4242 4242 4242`, a future expiry and any three-digit CVC. Expect **reserved**, not charged; the creator request appears only after server verification.
2. As creator, accept. A conversation opens; Stripe must still show an uncaptured authorization.
3. Send the first substantive reply before the deadline. Expect one €4 capture, one €3.40 creator transfer and a €0.60 platform fee snapshot. The 15% platform amount is **before Stripe processing/Connect fees**. A transfer to the connected Stripe balance is not a completed bank payout.
4. Repeat with insufficient-funds card `4000 0000 0000 9995`: expect an error and no active creator request. Use `4000 0025 0000 3155` to exercise authentication. [Official test cards](https://docs.stripe.com/testing).
5. Test decline: the hold is canceled, not refunded. For expiry, temporarily use `REPLY_EXPIRY_SECONDS=60`, restart, create a fresh request and wait past its deadline. Invoke the protected cron locally or wait for the deployed scheduler. Repeat with a request that was accepted but received no reply. Both must cancel without capture. Restore `86400` afterward.
6. Local reconciliation, with the secret already set in your shell (do not share it):

```sh
curl --fail -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/payments
```

7. Full post-capture refunds are available only through the authenticated admin route `POST /api/admin/payments/<internal-payment-uuid>/refund` with a same-origin JSON body `{}`. Assign the admin role only through trusted database administration. A refund is followed by reversal of any creator transfer. There is no fan refund API.
8. Inspect `reply_payments`, `transactions`, `stripe_webhook_events` with trusted database access. Monitor `needs_reconciliation=true`, webhook failures and cron failures. `manual_review=true` pauses automatic financial operations for cases such as partial external refunds/reversals and won disputes; reconcile the Stripe objects and ledger through trusted operations before clearing it. Never fabricate provider success by editing a state field.

Bank hold release timing is determined by the issuer. The fulfillment deadline is enforced immediately by the database; cancellation runs on the next reconciliation, normally within the scheduler interval. The deadline is capped before Stripe's actual card authorization expiry. Processing failures retain the creator's message and retry the existing payment/transfer.

The automated completion checks do not substitute for this hosted sandbox run. This run, SMTP delivery, actual SCA, wallet availability and country-specific Connect eligibility remain configuration-dependent verification.
