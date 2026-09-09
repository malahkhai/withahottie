# Database foundation

Apply `migrations/202609090001_foundation.sql` to a fresh Supabase project. It expects Supabase's `auth.users`, `auth.uid()`, and roles (`anon`, `authenticated`, `service_role`). All 16 requested domain tables use UUIDs and RLS.

- Anonymous access: approved creator profiles and active pricing only. Fan profiles are private.
- Self-service writes: display name/avatar, creator bio/categories, reports, blocks, and notification read timestamps. Column grants prevent role/verification escalation.
- Messages, memberships, requests, prices, subscriptions, ratings and money: trusted server writes only. Build authorization, blocking, moderation, rate limiting and entitlement checks before adding write endpoints.
- Messages: members only. Subscriptions/interactions: participants only. Ledger: admin read only. Payouts: owning creator/admin. No public financial records.
- `private` contains fixed-search-path, security-definer RLS helpers. Do not add it to Supabase's exposed API schemas.
- Financial references use restrictive deletes to preserve accounting history. Account deletion needs an explicit anonymization/retention workflow rather than cascading away financial records.
- Role promotion is a trusted operational task after approval, never a signup field. Insert/approve `creator_profiles` and promote `profiles.role` transactionally from a trusted server or SQL editor.
- `transactions` is append-only by convention for server workers and has no client writes. Event/object/kind uniqueness prevents duplicate ledger effects. Before Stripe integration, add a webhook inbox for event claiming/replay, and a private creator-to-Connect-account mapping.
- Storage is intentionally unconfigured. Create private buckets and storage-object policies before uploads. SQL media visibility alone does not protect a public bucket.

Stella is deterministic application demo data in `lib/demo.ts`, so the UI works without inserting fake auth users into a real database. No SQL demo seed is automatically inserted into production.

`tests/rls.sql` is a rollback-only verification script for a **disposable test database**, run after the migration. It seeds auth fixtures and checks privacy and write-denial boundaries. Never run test fixtures against production.
