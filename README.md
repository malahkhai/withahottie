# ReplyPass

**A little closer to the people you follow.**

Creator proposition: **Get paid for your attention.** Fan promise: **No reply = no charge.** ReplyPass is a brand-safe, mobile-first creator platform for guaranteed messages, live text chat, voice notes, photo/video requests and VIP subscriptions.

Task 2 adds authentication and the creator experience. **Payments remain mocked.** Accepting or completing requests never captures money; future Stripe webhooks control final financial state.

## Local installation

Use Node.js 22 (see `.nvmrc`).

```sh
nvm install
nvm use
npm ci
cp .env.example .env.local
npm run dev
```

Open `/@stella`, or `/login` and choose the creator or fan demo. Leave both Supabase variables empty for demo mode. Demo sessions use HTTP-only cookies; fictional conversations and request changes persist in browser storage. Creator onboarding saves a demo profile locally. Demo data is browser-specific and is never inserted into production. Clear site data to reset it. Partial or invalid Supabase configuration fails closed instead of enabling demo authentication.

## Architecture and routes

Next.js App Router, React, strict TypeScript, Tailwind CSS and ESLint. Production builds use the supported webpack compiler because Turbopack build workers cannot bind their local port in this environment. Supabase SSR clients verify users on the server; route guards read trusted profile roles. New auth users receive a `profiles` row with role `fan`; the validated onboarding RPC atomically saves creator details/pricing and promotes fans to creators. Client metadata cannot grant admin privileges.

```text
app/
  [handle]/                 Dynamic /@username public profiles
  login/ signup/ auth/      Email/password, confirmation and session routes
  creator/apply/            Multi-step onboarding and mobile preview
  creator/(workspace)/      Dashboard, inbox/[id], requests, subscribers,
                            earnings, analytics, profile and settings
  account/                  Fan messages, requests, subscriptions, purchases,
                            saved creators and settings
  api/                      Authorized auth/profile/request/message APIs
components/                 Shared UI, responsive workspace and editors
lib/
  auth/                     Server role guards, demo sessions, safe redirects
  creators/                 Repository, validation, catalog and profile mapping
  workspace/                Supabase data loading and fictional fixtures
  payments/                 Centralized fees, state model and mock quotes
  supabase/                 Browser/server clients and configuration
  requests.ts               Expiry formatting and request state transitions
types/                      Typed creator, workspace and payment domains
supabase/migrations/        Incremental schema, grants, RPCs and RLS
supabase/tests/             Rollback-only database authorization checks
public/images/              Fictional local demo imagery
tests/                     Unit and HTTP smoke checks
proxy.ts                    Auth cookie refresh and private route handling
```

Public profiles load through a repository. When Supabase is unavailable, Stella remains available as a demo; unknown usernames return a 404. Real database writes require authenticated, authorized users. Messaging uses member-only reads, a validated send RPC, and Supabase Realtime subscriptions. Images use public avatars and private, member-authorized chat attachments with short-lived signed URLs.

All amounts are integer minor units; currency is stored separately. `lib/payments/fees.ts` centralizes the 15% platform fee and 85% creator share. Request acceptance/completion and payment state are separate. Analytics are fictional in demo mode; unavailable real metrics are not fabricated.

## Environment

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key, protected by RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Reserved for future trusted server workers |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Reserved for Task 3 |
| `STRIPE_SECRET_KEY` | Reserved for Task 3; server-only |
| `STRIPE_WEBHOOK_SECRET` | Reserved for future webhook verification |
| `NEXT_PUBLIC_APP_URL` | Public sharing/metadata origin: `https://getreplypass.com` |

Never commit secrets or `.env.local`. The service-role and Stripe keys are unused in Task 2; setting them does not enable payments.

## Supabase setup

1. Create a Supabase project and apply **all migrations in filename order**. Existing Task 1 projects need migrations 002–004; existing Task 2 projects need only 004. Use the SQL editor, or initialize/link the Supabase CLI and run `npx supabase db push`.
2. Set the URL and anon key, then restart Next.js. Enable email/password authentication, email confirmation, SMTP and a 12-character minimum password policy.
3. Set Supabase Auth **Site URL** to `https://getreplypass.com`. Add these **Redirect URLs**:
   - `https://getreplypass.com/auth/callback`
   - `http://localhost:3000/auth/callback`
   - If using the current local preview: `http://127.0.0.1:3003/auth/callback`
   The app appends a constrained `next` query parameter. Allow the exact callback variants with `?next=%2Faccount`, `?next=%2Fcreator%2Fapply`, and `?next=%2Fcreator%2Fdashboard` for each origin in use. Do not add broad production host wildcards. Explicitly configure a trusted preview origin in `NEXT_PUBLIC_APP_URL` and allow that callback when testing email confirmation on previews.
4. Migration 001 creates the original 16 domain tables and signup profile trigger. Migration 002 adds onboarding, availability, social links, saved creators, request timestamps, constrained creator RPCs, public avatar storage and member-only Realtime messages. Migration 003 adds private chat attachment storage and its send RPC.
5. Keep the `private` schema out of exposed API schemas. Verify `messages` is enabled in the `supabase_realtime` publication. Migrations add it when the publication exists.
6. Optionally generate database types: `npx supabase gen types typescript --linked > types/database.ts`.

Completed onboarding publishes an **unverified** creator profile with application status `pending`. Verification and approval remain trusted moderation decisions; suspended/rejected creators cannot relaunch themselves. Admin roles must be assigned through trusted operations. Hosted Supabase email delivery and authentication need end-to-end verification with your own project credentials.

## Planned Stripe / Stripe Connect architecture

The frontend is never a payment source of truth. The browser will submit an offering and request; the server must derive the approved creator, current price, duration limit and currency, enforce auth/blocking/rate limits, and create idempotent records. Never accept browser totals, creator ownership or payment status.

One-off interaction states:

```text
pending → authorized → accepted → captured → completed
                  ↘ declined / expired
captured or completed → refunded / disputed
```

All valid states are `pending`, `authorized`, `accepted`, `captured`, `completed`, `declined`, `expired`, `refunded`, `disputed`. `lib/payments/model.ts` defines allowed domain transitions; it is not a webhook handler. Dispute resolution requires restoring the reconciled previous successful state or refunding, not blindly advancing state.

Planned flow:

1. Onboard approved creators with Stripe Connect hosted onboarding and verify charges/payout capabilities. Store Connect account IDs in a **private** server-owned table, not public creator profiles.
2. Create PaymentIntents with manual capture and server-side idempotency. Authorization may place a temporary bank hold; it is not a captured charge. Restrict payment methods to those supporting the required authorization/capture flow.
3. Accept a request within a deadline shorter than the actual authorization window; capture only when the promised reply/deliverable is fulfilled. For live text chat, authorize a user-selected duration cap and capture only the agreed delivered duration. Acceptance alone never earns a charge. Declines/timeouts release authorizations; missed promises after capture require refunds.
4. Verify Stripe webhook signatures against the raw body. Persist event IDs in a durable inbox, process transactionally and idempotently, handle out-of-order events by retrieving/reconciling provider state, and retry safely. Webhooks control final capture, refund, dispute and payout state; browser redirects do not.
5. VIP uses Stripe Billing subscription/invoice events and its own subscription lifecycle. Entitlements require active/trialing status and an unexpired period. The one-off guaranteed reply promise does not silently extend to unlimited basic VIP messaging; product terms must define this before charging.
6. Select the Connect charge/transfer model and apply the centralized 15% platform / 85% creator fee policy before integration; implement ledger reconciliation, delayed transfers where needed, refunds, transfer reversals and payout failure handling. Add the webhook inbox, Connect mapping and endpoint tests with that task.

There is deliberately **no live checkout endpoint or webhook endpoint** in Task 2. No payment method collection, timed live chat billing, subscription renewal or payout processing is implemented. Locked tiles are demo media, not a real paywall. Real paid assets must never be bundled in `public/`.

References: [Next.js App Router](https://nextjs.org/docs/app), [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [Stripe authorization and capture](https://docs.stripe.com/payments/place-a-hold-on-a-payment-method), [Stripe Connect](https://docs.stripe.com/connect).

## Development and validation

```sh
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
npm start
npm run test:smoke # Set TEST_APP_URL for a non-default port
```

On a disposable Supabase test database, after migrations:

```sh
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/creator-experience.sql
```

`tests/browser.mjs` is an optional browser acceptance script. Run it with an externally installed Playwright module (`PLAYWRIGHT_MODULE=/absolute/path/to/playwright node tests/browser.mjs`); set `CHROME_EXECUTABLE` to an existing Chrome binary or install Playwright Chromium. Screenshots are written to the OS temporary directory. `TEST_APP_URL` selects the running server.

Unit tests cover payment transitions, server quotes, fee rounding, creator validation, expiry and request transitions. Browser acceptance covers 390px/desktop layout, protected routes, demo role isolation, creator onboarding, dynamic profiles, mock checkout, inbox persistence and request actions. Database fixtures must never be run against production.

## Vercel and remaining setup

Import the existing GitHub repository into Vercel, select Next.js and Node 22.x, and retain the default build command. Configure app origin, Supabase values and auth redirects before testing real accounts. Standard App Router configuration requires no custom hosting adapter.

Task 3 will implement Stripe/Connect and webhook-controlled financial workflows. Real payment capture, payouts, background expiration, subscription billing, moderation operations and production rate limiting are not implemented in Task 2. Locked preview tiles are demo media, not a payment entitlement system.

## Production identity — Task 2.5

The product is **ReplyPass**; `getreplypass.com` is its domain, not a different product name. `lib/site.ts` centralizes the identity, public URL, promises and creator sharing. Set `NEXT_PUBLIC_APP_URL=https://getreplypass.com` in Vercel. Local routing remains relative, and authentication callbacks preserve loopback origins. Optionally set `NEXT_PUBLIC_APP_URL=http://localhost:3000` when testing local share links. Public environment values are baked into client bundles, so rebuild after changing them.

Creator canonical/share URLs use `https://getreplypass.com/@username`. `lib/metadata.ts` supplies per-page social/canonical metadata; `/og` generates a local 1200×630 text-based PNG with no external font/image requests. Replace its artwork in `app/og/route.tsx` when approved. The existing SVG favicon remains in place. Draft trust pages live at `/terms`, `/privacy`, `/community-guidelines`, and `/creator-terms`, with footer links and noindex metadata. They require review and completion before public launch.

Attach `getreplypass.com` to the Vercel project and configure the DNS records Vercel provides; no DNS or domain ownership changes were made in this task. GitHub still uses the legacy repository name. Rename it manually to `replypass` if desired, then update origin to the URL GitHub reports. The existing remote is intentionally preserved.

Use `/Users/admin/Developer/ReplyPass` as the working repository; the older Documents folder is an iCloud source mirror and may be evicted. See `docs/payment-readiness.md` for the Task 3 boundary and security review. Task 2.5 does not enable Stripe or make draft policies final.
