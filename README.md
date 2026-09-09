# withahottie

**Get paid for your attention.** A mobile-first, brand-safe creator platform for guaranteed messages, timed live text chat, voice notes, personalized photo/video requests, and monthly VIP memberships. **No reply = no charge.**

Task 1 is a working foundation, not a live payment product. Open **http://localhost:3000/@stella** to meet fictional creator Stella May. Every paid action opens an accessible checkout sheet and a clearly labeled, server-priced demo result. Nothing is charged or sent to a creator.

## Stack and architecture

- Next.js App Router, React, strict TypeScript, Tailwind CSS, ESLint; npm lockfile pins the installed versions. TypeScript 6 and ESLint 9 are pinned for compatibility with the current Next.js lint plugins.
- Server-rendered routes with a client interaction island for sheets, forms and demo checkout. Native `<dialog>` provides modal focus management, Escape dismissal, inert background and focus restoration.
- Supabase browser/server clients, cookie refresh proxy, PKCE callback and server-only role helpers. Missing credentials explicitly enable demo UI. Accounts always start as `fan`; creator/admin promotion is trusted server work.
- PostgreSQL migration with all 16 domain tables, UUIDs, constrained money/status fields, foreign keys, indexes, timestamp triggers, scoped grants and RLS.
- Plain Next.js deployment on Vercel, with security headers and no special build adapter. No Stripe SDK is needed until payment integration is implemented.
- No analytics, marketing trackers or external image requests. The fictional portrait is bundled locally.

```text
app/
  [handle]/             /@stella (unknown handles return 404)
  login/ signup/        Auth forms, real Supabase auth when configured
  creator/apply/        Explicit application preview; not submitted
  auth/callback/        Supabase confirmation-code exchange
  api/checkout/demo/    Stateless mock quote; no money or DB mutations
components/             UI primitives, navigation, profile, auth, bottom sheet
lib/
  auth/                 Verified user + role guard (server only)
  payments/             State model and authoritative demo price validation
  supabase/             Browser/server clients and config
  demo.ts               Fictional creator seed and offerings
types/                  Domain and payment types
supabase/migrations/    Database schema, grants and RLS
supabase/tests/         Rollback-only authorization checks
public/images/          Fictional demo media and provenance
tests/                  Payment-domain and request-validation tests
proxy.ts                Auth cookie refresh, scoped to auth routes
```

## Local installation

Use **Node.js 22 LTS** (also selected in `.nvmrc`; latest Supabase requires Node 22+).

```sh
nvm install
nvm use
npm ci
cp .env.example .env.local
npm run dev
```

Open `/@stella`. `/` redirects there. Leave external-service variables empty for demo mode; restart the dev server after changing them. Login and signup explain demo mode rather than pretending to create accounts. The creator application is an unsaved preview with or without credentials.

## Environment

| Variable                             | Purpose                                                    |
| ------------------------------------ | ---------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`           | Supabase project URL                                       |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`      | Public anon API key; RLS must be applied first             |
| `SUPABASE_SERVICE_ROLE_KEY`          | Future trusted server workers only; bypasses RLS           |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Future Stripe client setup                                 |
| `STRIPE_SECRET_KEY`                  | Future server-only Stripe API calls                        |
| `STRIPE_WEBHOOK_SECRET`              | Future signature validation                                |
| `NEXT_PUBLIC_APP_URL`                | App origin, e.g. `http://localhost:3000` or production URL |

Never prefix service-role or Stripe secret keys with `NEXT_PUBLIC_`. Never commit `.env.local`, credentials or payment data. The demo does not read Stripe keys or the Supabase service-role key; supplying them does not turn payments on.

## Supabase setup and migrations

1. Create a Supabase project. Apply the migration to a fresh database before enabling the app credentials.
2. In the SQL editor, execute `supabase/migrations/202609090001_foundation.sql`, or use the CLI:

   ```sh
   npx supabase login
   npx supabase init
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push
   ```

   Review generated local CLI configuration before committing it. For a fresh local Supabase instance, run `npx supabase start` and `npx supabase db reset` after `init`.

3. Copy the project URL and public anon key into `.env.local`. Configure email/password auth, email confirmation, SMTP and a strong password policy (12+ characters) in Supabase.
4. Set the Auth Site URL to your application URL and allow `http://localhost:3000/auth/callback` plus your production `/auth/callback`. Configure each trusted preview URL explicitly if testing auth on previews.
5. Keep the `private` schema out of exposed API schemas. Create private Storage buckets and access policies only when implementing uploads.
6. Generate application DB types once linked: `npx supabase gen types typescript --linked > types/database.ts`. The current domain types describe the foundation without pretending to be generated database types.

The migration creates a profile for each new auth signup and ignores user-supplied role metadata. Approvals, moderation, creator onboarding and admin screens are future work. See `supabase/README.md` for security boundaries.

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
6. Select the Connect charge/transfer model and platform fee policy before integration; implement ledger reconciliation, delayed transfers where needed, refunds, transfer reversals and payout failure handling. Add the webhook inbox, Connect mapping and endpoint tests with that task.

There is deliberately **no live checkout endpoint or webhook endpoint** in Task 1. No payment method collection, live chat session, message delivery, uploads, subscription renewal or payout processing is implemented. Locked tiles are demo media, not a real paywall. Real paid assets must never be bundled in `public/`.

References: [Next.js App Router](https://nextjs.org/docs/app), [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [Stripe authorization and capture](https://docs.stripe.com/payments/place-a-hold-on-a-payment-method), [Stripe Connect](https://docs.stripe.com/connect).

## Development and validation

```sh
npm run dev        # Development server
npm run lint       # ESLint
npm run typecheck  # Next route generation + strict TypeScript
npm test           # Payment transitions and server quote validation
npm run test:smoke # HTTP checks against npm start (TEST_APP_URL optional)
npm run build      # Production build
npm start          # Serve production build
```

Database security checks on a disposable Supabase test database after migration:

```sh
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql
```

Mobile acceptance target: 390px viewport, no horizontal overflow, all offerings + VIP open sheets, keyboard/focus/Escape work, long input and live-chat totals validated, mock result says no charge, and all auth routes render without credentials.

## Vercel

Import this GitHub repository into Vercel, choose **Next.js**, set Node **22.x**, and use the default `npm run build` command. Set `NEXT_PUBLIC_APP_URL` to the production origin; add the Supabase environment values only after migration and Auth redirect configuration. Deploy without Supabase/Stripe values to share the demo. No `vercel.json` is necessary for a standard App Router app.

Before real launch: connect/test Supabase auth and SMTP, implement creator approval and server-authorized writes, moderation and reporting workflows, private storage, rate limits, Stripe/Connect + webhook verification, and approved product/privacy/payment terms. These are intentionally outside Task 1.
