-- First-party, aggregate creator profile metrics. No visitor identifiers are stored.
create table public.creator_profile_view_days (
  creator_id uuid not null references public.creator_profiles(id) on delete cascade,
  viewed_on date not null default ((now() at time zone 'utc')::date),
  view_count bigint not null default 0 check (view_count >= 0),
  primary key (creator_id, viewed_on)
);

alter table public.creator_profile_view_days enable row level security;

create policy creator_profile_view_days_owner_select
on public.creator_profile_view_days
for select
to authenticated
using (
  exists (
    select 1
    from public.creator_profiles creator
    where creator.id = creator_profile_view_days.creator_id
      and creator.profile_id = (select auth.uid())
  )
);

create or replace function public.record_creator_profile_view(target_creator uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.creator_profile_view_days (creator_id, viewed_on, view_count)
  select creator.id, (now() at time zone 'utc')::date, 1
  from public.creator_profiles creator
  where creator.id = target_creator
    and creator.onboarding_complete = true
  on conflict (creator_id, viewed_on)
  do update set view_count = creator_profile_view_days.view_count + 1;
end;
$$;

revoke all on function public.record_creator_profile_view(uuid) from public;
revoke all on function public.record_creator_profile_view(uuid) from anon;
revoke all on function public.record_creator_profile_view(uuid) from authenticated;
grant execute on function public.record_creator_profile_view(uuid) to service_role;
