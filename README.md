# ReplyPass

**A little closer to the people you follow.**

Creator proposition: **Get paid for your attention.** Fan promise: **No reply = no charge.** ReplyPass is a brand-safe, mobile-first creator platform for guaranteed messages, live text chat, voice notes, photo/video requests and VIP subscriptions.

Task 3 adds **test-mode secured Guaranteed Reply payments** with Stripe Connect. Funds are reserved first, acceptance never captures, and the first qualifying creator reply triggers capture and an 85% creator transfer. Other offerings remain demos. Live Stripe keys are rejected.

Start with the step-by-step [Supabase, Vercel and Stripe setup guide](docs/setup.md).

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
                            earnings, payouts, analytics, profile and settings
  account/                  Fan messages, requests, subscriptions, purchases,
                            saved creators and settings
  api/                      Authorized auth/profile/request/message APIs
components/                 Shared UI, responsive workspace and editors
lib/
  auth/                     Server role guards, demo sessions, safe redirects
  creators/                 Repository, validation, catalog and profile mapping
  workspace/                Supabase data loading and fictional fixtures
  payments/                 Centralized fees, state model and mock quotes
  stripe/                   Test-mode Connect, authorization/capture, webhooks,
                            reconciliation and private payment summaries
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

| Variable                             | Purpose                                                    |
| ------------------------------------ | ---------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`           | Supabase project URL                                       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`      | Public anon key, protected by RLS                          |
| `SUPABASE_SERVICE_ROLE_KEY`          | Trusted server-only message and financial operations       |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Test publishable key (`pk_test_`)                          |
| `STRIPE_SECRET_KEY`                  | Test secret key (`sk_test_`); server-only                  |
| `STRIPE_WEBHOOK_SECRET`              | Snapshot webhook signing secret (`whsec_`)                 |
| `NEXT_PUBLIC_APP_URL`                | Public sharing/metadata origin: `https://getreplypass.com` |

Never commit secrets or `.env.local`. All Stripe keys must be absent for mock checkout, or supplied together with all three Supabase values to enable test payments. Also configure `STRIPE_CONNECT_WEBHOOK_SECRET` for a separate Accounts v2 destination, `CRON_SECRET` (32+ random characters) for reconciliation, and optional `REPLY_EXPIRY_SECONDS` (30–86400; default 86400). Invalid/partial/live configuration fails closed. Supabase-only ordinary messaging requires the server service-role key after migration 005.

## Supabase setup

1. Create a Supabase project and apply **all migrations in filename order**. Existing Task 1 projects need migrations 002–006; existing Task 2.5 projects need 005–006. Use the SQL editor, or initialize/link the Supabase CLI and run `npx supabase db push`.
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

## Secured Guaranteed Reply architecture

The server reads active creator pricing, blocks, account readiness and currency. It snapshots integer gross/fee/net amounts and the 15% fee policy for each immutable order. The frontend submits only a creator ID, message and retry UUID. No private message is copied to Stripe metadata.

1. Create or reuse one manual-capture card PaymentIntent. No creator request exists before verified authorization.
2. Stripe confirmation/webhooks reconcile the provider and publish the request with a 24-hour acceptance-and-fulfillment deadline, capped by the actual card capture window.
3. Creator acceptance atomically creates one conversation; funds remain reserved.
4. Persist the first qualifying creator reply and acquire the capture claim in one database transaction. Capture the existing intent, then separately transfer the snapshotted 85% net with `source_transaction` bound to the captured charge.
5. Declines and unanswered deadlines cancel authorizations. Post-capture admin refunds reverse any creator transfer. Capture/transfer failures preserve the reply and pending liability for retries.

Accounts v2 recipient configuration, Express dashboard and hosted onboarding were selected for Stripe's current marketplace architecture. Separate charges and transfers allow fulfillment-controlled capture followed by a creator transfer; the platform retains the fee and bears processor fees/loss responsibility. Connect readiness is checked before checkout and again before transfer. See [Stripe's marketplace guide](https://docs.stripe.com/connect/marketplace/quickstart) and [separate charges and transfers](https://docs.stripe.com/connect/separate-charges-and-transfers).

`reply_payments` separates payment states (`pending`, `authorized`, `captured`, `canceled`, `refunded`, `disputed`, `failed`) from request states (`pending`, `accepted`, `fulfilled`, `declined`, `expired`). Existing `fulfilled` is displayed as Completed; historical migrations are preserved. `transactions` stores charge/fee/transfer/refund ledger entries separately. `creator_stripe_accounts` and the webhook inbox are service-only under RLS. Snapshot amounts cannot be mutated even by routine server updates.

`/api/stripe/webhook` verifies raw signatures and persists event IDs. It retrieves current Stripe state instead of trusting event arrival order or browser success. Database locks/constraints and deterministic Stripe operation keys prevent duplicate orders, conversations, captures and transfers. `/api/cron/payments` rotates batches of unresolved payments using a protected bearer secret. No scheduler is enabled by the default deployment configuration; configure an external five-minute scheduler (or Vercel Pro cron) before enabling Stripe test payments. Manual-review cases pause automation. Full event subscriptions and operator steps are in [setup.md](docs/setup.md); security boundaries are in [payment-readiness.md](docs/payment-readiness.md).

Cards and supported card wallets only. No paid live chat, paid media, real VIP subscription, wallet, coins or bank-payment methods are implemented. Preview media remains demo content. This is a sandbox integration, not authorization to enable live payments.

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
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/secured-replies.sql
python3 tests/db-concurrency.py # also set PSQL if psql is not on PATH
```

`tests/browser.mjs` is an optional browser acceptance script. Run it with an externally installed Playwright module (`PLAYWRIGHT_MODULE=/absolute/path/to/playwright node tests/browser.mjs`); set `CHROME_EXECUTABLE` to an existing Chrome binary or install Playwright Chromium. Screenshots are written to the OS temporary directory. `TEST_APP_URL` selects the running server.

Unit tests cover payment transitions, server quotes, fee rounding, creator validation, expiry and request transitions. Browser acceptance covers 390px/desktop layout, protected routes, demo role isolation, creator onboarding, dynamic profiles, mock checkout, inbox persistence and request actions. Database fixtures must never be run against production.

## Vercel and remaining setup

Import the existing GitHub repository into Vercel, select Next.js and Node 22.x, and retain the default build command. Configure app origin, Supabase values and auth redirects before testing real accounts. Standard App Router configuration requires no custom hosting adapter.

Task 3 implements test-mode Guaranteed Reply capture, Connect transfers and protected scheduled reconciliation. External Supabase/Stripe/Vercel setup and the full hosted sandbox scenario remain manual. Production rate limiting, finalized legal policies and live-payment launch review remain outside this task. Locked preview tiles are demo media, not a payment entitlement system.

## Production identity — Task 2.5

The product is **ReplyPass**; `getreplypass.com` is its domain, not a different product name. `lib/site.ts` centralizes the identity, public URL, promises and creator sharing. Set `NEXT_PUBLIC_APP_URL=https://getreplypass.com` in Vercel. Local routing remains relative, and authentication callbacks preserve loopback origins. Optionally set `NEXT_PUBLIC_APP_URL=http://localhost:3000` when testing local share links. Public environment values are baked into client bundles, so rebuild after changing them.

Creator canonical/share URLs use `https://getreplypass.com/@username`. `lib/metadata.ts` supplies per-page social/canonical metadata; `/og` generates a local 1200×630 text-based PNG with no external font/image requests. Replace its artwork in `app/og/route.tsx` when approved. The existing SVG favicon remains in place. Draft trust pages live at `/terms`, `/privacy`, `/community-guidelines`, and `/creator-terms`, with footer links and noindex metadata. They require review and completion before public launch.

Attach `getreplypass.com` to the Vercel project and configure the DNS records Vercel provides; no DNS or domain ownership changes were made in this task. GitHub confirmed the repository is now `malahkhai/Replypass`. The local origin uses `https://github.com/malahkhai/Replypass.git`; no manual repository rename is needed.

Use `/Users/admin/Developer/ReplyPass` as the working repository; the older Documents folder is an iCloud source mirror and may be evicted. See `docs/payment-readiness.md` for the implemented security boundaries and `docs/setup.md` for configuration. Draft policies are not final.

## Task 3 validation

`tests/secured-payments.test.ts` uses a mocked Stripe provider for holds, declines, expiry, capture/transfer retries, signatures and idempotency. SQL suites cover permissions, ownership, immutable prices and fulfillment claims; `tests/db-concurrency.py` uses concurrent database connections. `tests/stripe-browser.mjs` mocks Stripe.js and checkout responses to verify the Payment Element UI contract, insufficient funds, retry identity and server-confirmed success. It requires a test-configured app and `TEST_CREATOR_HANDLE` identifying a published, non-demo creator with Guaranteed Reply enabled; see its header. The ordinary browser suite requires credentials absent. No automated test sends money or establishes hosted service readiness.

Task 3.5 sandbox readiness and the evidence still required for a real authorization/capture/transfer are recorded in [docs/task-3-5-validation.md](docs/task-3-5-validation.md). Run `npm run payment:readiness` for a secret-safe configuration, schema, webhook and account summary. An authenticated admin can also call `/api/admin/payments/readiness`; neither diagnostic returns credentials or financial object IDs.

## Creator-led acquisition and navigation

- `/` is the detailed platform homepage for organic visitors. `/creators` is the creator recruitment landing page for ads. Both offer creator onboarding and existing-account login, with no generic fan signup CTA.
- Fans arrive at `/@username`. The profile logo returns to that same profile; the footer's About ReplyPass link opens `/`. Fan conversations include a back-to-creator link where a published creator is available.
- `/signup` without a valid creator destination or `/creator/apply` shows entry guidance instead of a signup form. Creator-linked signup validates that the public profile resolves. This controls the product journey; Supabase authentication itself remains enabled.
- Authentication carries an allowlisted `next` path such as `/@username?interaction=message`. Login, confirmation and account continuation preserve that destination rather than sending everyone to a dashboard.
- Request text is retained in tab-local session storage for up to 24 hours, scoped to creator and interaction, never in URLs or auth metadata. It is restored when the request reopens after login/signup. This does not sync drafts between browsers/devices; when email confirmation opens elsewhere, return and log in in the original tab. No payment is submitted automatically after authentication.
- Stella remains explicitly demo data and cannot enter Stripe checkout. The landing pages distinguish test-mode Guaranteed Reply from upcoming paid formats.

Run `tests/marketing-browser.mjs` with the same external Playwright/Chrome environment as the other browser tests. It covers both landing pages, no-context signup, creator logo behavior, About navigation, draft restoration and mobile/desktop overflow.

## Analytics and consent

See [the GA4 page/event map and setup](docs/analytics.md). Basic Consent Mode blocks Google until acceptance. Set `NEXT_PUBLIC_GA_ENABLED=true` only after the documented GA4 stream setup; default is disabled. No message contents or identifying route parameters are tracked.
