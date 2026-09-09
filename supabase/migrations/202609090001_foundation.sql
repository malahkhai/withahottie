-- ReplyPass V1. Money is integer minor units. UTC timestamps throughout.
begin;
create extension if not exists pgcrypto;
create type public.user_role as enum ('fan', 'creator', 'admin');
create type public.creator_status as enum ('pending', 'approved', 'rejected', 'suspended');
create type public.interaction_kind as enum ('message', 'live_chat', 'voice_note', 'photo', 'video', 'vip');
create type public.payment_status as enum ('pending', 'authorized', 'accepted', 'captured', 'completed', 'declined', 'expired', 'refunded', 'disputed');
create type public.request_status as enum ('pending', 'accepted', 'declined', 'expired', 'fulfilled');
create type public.subscription_status as enum ('incomplete', 'trialing', 'active', 'past_due', 'canceled', 'unpaid');
create type public.media_kind as enum ('image', 'audio', 'video');
create type public.media_visibility as enum ('private', 'vip', 'public');
create type public.payout_status as enum ('pending', 'in_transit', 'paid', 'failed', 'canceled');

-- Email and auth credentials stay in auth.users, never in public-facing profiles.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'fan',
  display_name text not null check (char_length(display_name) between 1 and 80),
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.creator_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  handle text not null unique check (handle ~ '^[a-z0-9_]{3,30}$'),
  bio text not null default '' check (char_length(bio) <= 1000),
  categories text[] not null default '{}',
  status public.creator_status not null default 'pending',
  verified boolean not null default false,
  online boolean not null default false,
  response_rate numeric(5,2) check (response_rate between 0 and 100),
  avg_response_minutes integer check (avg_response_minutes >= 0),
  completed_chats integer not null default 0 check (completed_chats >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- No Stripe IDs, payout accounts or application PII in public creator rows.
create table public.creator_pricing (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles(id) on delete cascade,
  kind public.interaction_kind not null,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'eur' check (currency ~ '^[a-z]{3}$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (creator_id, kind)
);
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.conversation_members (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id),
  last_read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (conversation_id, profile_id)
);
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  body text not null check (char_length(body) between 1 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.paid_interactions (
  id uuid primary key default gen_random_uuid(),
  fan_id uuid not null references public.profiles(id),
  creator_id uuid not null references public.creator_profiles(id),
  conversation_id uuid references public.conversations(id),
  kind public.interaction_kind not null,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'eur' check (currency ~ '^[a-z]{3}$'),
  status public.payment_status not null default 'pending',
  stripe_payment_intent_id text unique,
  idempotency_key uuid not null unique default gen_random_uuid(),
  duration_minutes integer check (duration_minutes between 1 and 30),
  expires_at timestamptz,
  accepted_at timestamptz,
  captured_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind <> 'live_chat' or duration_minutes is not null)
);
create table public.interaction_requests (
  id uuid primary key default gen_random_uuid(),
  interaction_id uuid not null unique references public.paid_interactions(id),
  body text not null check (char_length(body) between 1 and 2000),
  status public.request_status not null default 'pending',
  expires_at timestamptz not null,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  fan_id uuid not null references public.profiles(id),
  creator_id uuid not null references public.creator_profiles(id),
  status public.subscription_status not null default 'incomplete',
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'eur' check (currency ~ '^[a-z]{3}$'),
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index one_live_subscription on public.subscriptions (fan_id, creator_id) where status in ('incomplete', 'trialing', 'active', 'past_due', 'unpaid');
create table public.media (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  interaction_id uuid references public.paid_interactions(id),
  message_id uuid references public.messages(id),
  kind public.media_kind not null,
  visibility public.media_visibility not null default 'private',
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (interaction_id is null or visibility = 'private'),
  check (message_id is null or visibility = 'private')
);
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  interaction_id uuid references public.paid_interactions(id),
  subscription_id uuid references public.subscriptions(id),
  kind text not null check (kind in ('charge', 'refund', 'fee', 'transfer', 'dispute')),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'eur' check (currency ~ '^[a-z]{3}$'),
  stripe_event_id text not null,
  stripe_object_id text not null,
  created_at timestamptz not null default now(),
  unique (stripe_event_id, stripe_object_id, kind),
  check (num_nonnulls(interaction_id, subscription_id) = 1)
);
create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creator_profiles(id),
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'eur' check (currency ~ '^[a-z]{3}$'),
  status public.payout_status not null default 'pending',
  stripe_payout_id text unique,
  arrival_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  interaction_id uuid not null unique references public.paid_interactions(id),
  author_id uuid not null references public.profiles(id),
  creator_id uuid not null references public.creator_profiles(id),
  score smallint not null check (score between 1 and 5),
  review text check (char_length(review) <= 1000),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id),
  reported_profile_id uuid references public.profiles(id),
  message_id uuid references public.messages(id),
  reason text not null check (char_length(reason) between 1 and 2000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(reported_profile_id, message_id) >= 1)
);
create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('request', 'message', 'payment', 'subscription', 'system')),
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index creator_status_idx on public.creator_profiles(status);
create index conversations_created_by_idx on public.conversations(created_by);
create index members_profile_idx on public.conversation_members(profile_id, conversation_id);
create index messages_conversation_time_idx on public.messages(conversation_id, created_at);
create index messages_sender_idx on public.messages(sender_id);
create index interactions_fan_time_idx on public.paid_interactions(fan_id, created_at desc);
create index interactions_creator_status_idx on public.paid_interactions(creator_id, status);
create index interactions_conversation_idx on public.paid_interactions(conversation_id);
create index interactions_expiry_idx on public.paid_interactions(expires_at) where status in ('pending', 'authorized', 'accepted');
create index requests_expiry_idx on public.interaction_requests(expires_at) where status = 'pending';
create index subscriptions_creator_idx on public.subscriptions(creator_id);
create index media_owner_idx on public.media(owner_id, created_at desc);
create index media_interaction_idx on public.media(interaction_id);
create index media_message_idx on public.media(message_id);
create index transactions_interaction_idx on public.transactions(interaction_id);
create index transactions_subscription_idx on public.transactions(subscription_id);
create index payouts_creator_idx on public.payouts(creator_id, created_at desc);
create index ratings_creator_idx on public.ratings(creator_id, published);
create index ratings_author_idx on public.ratings(author_id);
create index reports_reporter_idx on public.reports(reporter_id);
create index reports_reported_idx on public.reports(reported_profile_id);
create index reports_message_idx on public.reports(message_id);
create index reports_status_idx on public.reports(status, created_at);
create index blocks_blocked_idx on public.blocks(blocked_id);
create index notifications_recipient_idx on public.notifications(recipient_id, created_at desc);

create function public.set_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
do $$ declare t text; begin
  foreach t in array array['profiles','creator_profiles','creator_pricing','conversations','conversation_members','messages','paid_interactions','interaction_requests','subscriptions','media','payouts','ratings','reports','notifications'] loop
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- Never trust signup metadata for role/verification. Every new account is a fan.
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name, role) values (new.id, left(coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), 'New friend'), 80), 'fan');
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Helpers in a non-exposed schema avoid recursive membership/profile RLS.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, anon;
create function private.is_admin() returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.profiles where id = (select auth.uid()) and role = 'admin');
$$;
create function private.owns_creator(creator uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.creator_profiles where id = creator and profile_id = (select auth.uid()));
$$;
create function private.is_member(conversation uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.conversation_members where conversation_id = conversation and profile_id = (select auth.uid()));
$$;
create function private.is_interaction_party(interaction uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.paid_interactions p where p.id = interaction and (p.fan_id = (select auth.uid()) or private.owns_creator(p.creator_id)));
$$;
create function private.can_view_vip(owner uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.subscriptions s join public.creator_profiles c on c.id = s.creator_id where c.profile_id = owner and s.fan_id = (select auth.uid()) and s.status in ('active','trialing') and s.current_period_end > now());
$$;
revoke all on all functions in schema private from public;
grant execute on all functions in schema private to authenticated;
-- Public policies deliberately do not call private helpers.
revoke all on function public.handle_new_user() from public;
revoke all on function public.set_updated_at() from public;

-- Default deny. Sensitive tables have no browser writes, including for admins.
do $$ declare t text; begin
  foreach t in array array['profiles','creator_profiles','creator_pricing','conversations','conversation_members','messages','paid_interactions','interaction_requests','subscriptions','media','transactions','payouts','ratings','reports','blocks','notifications'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant all on public.%I to service_role', t);
  end loop;
end $$;
grant select on public.profiles, public.creator_profiles, public.creator_pricing to anon, authenticated;
grant select on public.conversations, public.conversation_members, public.messages, public.paid_interactions, public.interaction_requests, public.subscriptions, public.media, public.transactions, public.payouts, public.ratings, public.reports, public.blocks, public.notifications to authenticated;
grant update (display_name, avatar_path) on public.profiles to authenticated;
grant update (bio, categories) on public.creator_profiles to authenticated;
grant insert (blocker_id, blocked_id), delete on public.blocks to authenticated;
grant insert (reporter_id, reported_profile_id, message_id, reason) on public.reports to authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy profiles_public_creator on public.profiles for select to anon, authenticated using (exists(select 1 from public.creator_profiles c where c.profile_id = profiles.id and c.status = 'approved'));
create policy profiles_self_admin on public.profiles for select to authenticated using (id = (select auth.uid()) or private.is_admin());
create policy profiles_edit_self on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy creators_public on public.creator_profiles for select to anon, authenticated using (status = 'approved');
create policy creators_self_admin on public.creator_profiles for select to authenticated using (profile_id = (select auth.uid()) or private.is_admin());
create policy creators_edit_self on public.creator_profiles for update to authenticated using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));
create policy pricing_public on public.creator_pricing for select to anon, authenticated using (active and exists(select 1 from public.creator_profiles c where c.id = creator_id and c.status = 'approved'));
create policy pricing_owner on public.creator_pricing for select to authenticated using (private.owns_creator(creator_id) or private.is_admin());
create policy conversations_members on public.conversations for select to authenticated using (private.is_member(id));
create policy membership_members on public.conversation_members for select to authenticated using (private.is_member(conversation_id));
create policy messages_members on public.messages for select to authenticated using (private.is_member(conversation_id));
create policy interactions_parties on public.paid_interactions for select to authenticated using (fan_id = (select auth.uid()) or private.owns_creator(creator_id) or private.is_admin());
create policy requests_parties on public.interaction_requests for select to authenticated using (private.is_interaction_party(interaction_id) or private.is_admin());
create policy subscriptions_parties on public.subscriptions for select to authenticated using (fan_id = (select auth.uid()) or private.owns_creator(creator_id) or private.is_admin());
create policy media_authorized on public.media for select to authenticated using (owner_id = (select auth.uid()) or (visibility = 'vip' and private.can_view_vip(owner_id)) or (interaction_id is not null and private.is_interaction_party(interaction_id)) or exists(select 1 from public.messages m where m.id = message_id and private.is_member(m.conversation_id)));
-- Even public media storage paths are not anonymously exposed by this foundation.
create policy transactions_admin on public.transactions for select to authenticated using (private.is_admin());
create policy payouts_owner_admin on public.payouts for select to authenticated using (private.owns_creator(creator_id) or private.is_admin());
create policy ratings_parties on public.ratings for select to authenticated using (author_id = (select auth.uid()) or private.owns_creator(creator_id) or private.is_admin());
create policy reports_self_admin on public.reports for select to authenticated using (reporter_id = (select auth.uid()) or private.is_admin());
create policy reports_create on public.reports for insert to authenticated with check (reporter_id = (select auth.uid()) and (message_id is null or exists(select 1 from public.messages m where m.id = message_id and private.is_member(m.conversation_id))));
create policy blocks_self on public.blocks for select to authenticated using (blocker_id = (select auth.uid()));
create policy blocks_create on public.blocks for insert to authenticated with check (blocker_id = (select auth.uid()));
create policy blocks_remove on public.blocks for delete to authenticated using (blocker_id = (select auth.uid()));
create policy notifications_self on public.notifications for select to authenticated using (recipient_id = (select auth.uid()));
create policy notifications_read on public.notifications for update to authenticated using (recipient_id = (select auth.uid())) with check (recipient_id = (select auth.uid()));
commit;
