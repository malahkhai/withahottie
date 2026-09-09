# Database and authorization

Apply migrations in filename order. Existing Task 1 databases need only 002 and 003. Supabase auth, storage and standard roles must exist first.

- 001: original 16 UUID domain tables, profile signup trigger, money constraints, grants and RLS. Signup role metadata is ignored.
- 002: creator onboarding/availability/social fields, saved creators, request timestamps, validated atomic creator/profile/pricing RPC, request response RPC, member-only messaging RPC, avatar bucket and Realtime publication membership.
- 003: private chat attachment bucket and member-authorized attachment RPC. Signed URLs expire after five minutes.

Completed onboarding promotes a fan to creator and publishes an unverified pending application. Only trusted moderation can verify/approve a creator. Rejected and suspended creators cannot relaunch themselves. Admin is never a signup option.

Public access covers published creator profiles and enabled pricing. Fan profiles, conversations, subscriptions and requests remain scoped to participants. Transactions are admin-readable; payouts are scoped to the creator/admin. No browser role can capture money or write the ledger.

The request response RPC changes only request state/timestamps, never payment status. Payment capture, refunds, disputes and payouts remain reserved for future trusted Stripe webhook processing. Currency is separate from integer minor-unit prices.

The `private` schema must stay outside exposed API schemas. Security-definer functions use fixed search paths and explicit authorization. Public avatar objects are intentional; chat attachment objects require membership. Object policies enforce upload ownership and conversation membership. Message sends also enforce blocks.

Demo users/data live in application fixtures and browser storage. No fake auth users are automatically inserted into production. Run `tests/rls.sql` and `tests/creator-experience.sql` only on a disposable test database; both roll back all fixtures.
