-- ReplyPass Task 2. Incremental creator workspace; no payment capture.
begin;
create type public.availability_status as enum ('online','away','offline');
alter table public.creator_profiles add column onboarding_complete boolean not null default false,
 add column onboarding_completed_at timestamptz,
 add column availability public.availability_status not null default 'offline',
 add column accepting_messages boolean not null default true,
 add column accepting_live_chats boolean not null default true,
 add column accepting_media_requests boolean not null default true,
 add column country text check (country ~ '^[A-Z]{2}$'),
 add column social_links jsonb not null default '{}' check (jsonb_typeof(social_links)='object'),
 add column reply_time text not null default '' check (reply_time in ('','~10 minutes','~1 hour','within 24 hours'));
alter table public.paid_interactions add column declined_at timestamptz;
alter table public.interaction_requests add column accepted_at timestamptz, add column declined_at timestamptz, add column completed_at timestamptz;
-- Existing handle is already lower-case and unique; active is pricing's enabled flag.
create index creator_launch_idx on public.creator_profiles(handle) where onboarding_complete;
create table public.saved_creators (
 id uuid primary key default gen_random_uuid(), fan_id uuid not null references public.profiles(id) on delete cascade,
 creator_id uuid not null references public.creator_profiles(id) on delete cascade,
 created_at timestamptz not null default now(), unique(fan_id,creator_id)
);
alter table public.saved_creators enable row level security;
revoke all on public.saved_creators from anon,authenticated;
grant select,insert,delete on public.saved_creators to authenticated;
grant all on public.saved_creators to service_role;
create policy saved_self on public.saved_creators for all to authenticated using(fan_id=(select auth.uid())) with check(fan_id=(select auth.uid()));
create index saved_creator_idx on public.saved_creators(creator_id);

-- Onboarding publishes a page but never grants a verification badge or approves an application.
drop policy creators_public on public.creator_profiles;
create policy creators_public on public.creator_profiles for select to anon,authenticated using(status='approved' or (onboarding_complete and status='pending'));
drop policy profiles_public_creator on public.profiles;
create policy profiles_public_creator on public.profiles for select to anon,authenticated using(exists(select 1 from public.creator_profiles c where c.profile_id=profiles.id and (c.status='approved' or (c.onboarding_complete and c.status='pending'))));
drop policy pricing_public on public.creator_pricing;
create policy pricing_public on public.creator_pricing for select to anon,authenticated using(active and exists(select 1 from public.creator_profiles c where c.id=creator_id and (c.status='approved' or(c.onboarding_complete and c.status='pending'))));

create function public.username_available(candidate text) returns boolean language sql stable security definer set search_path='' as $$
 select candidate ~ '^[a-z0-9_]{3,30}$' and candidate not in ('admin','account','login','signup','creator','replypass','support')
 and not exists(select 1 from public.creator_profiles where handle=candidate and profile_id is distinct from (select auth.uid()));
$$;
revoke all on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon,authenticated;

create function public.save_creator_profile(draft jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); creator uuid; price jsonb; avatar text:=coalesce(draft->>'image','');
begin
 if uid is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from public.profiles where id=uid) then raise exception 'Profile required'; end if;
 perform 1 from public.profiles where id=uid for update;
 if exists(select 1 from public.creator_profiles where profile_id=uid and status in ('suspended','rejected')) then raise exception 'Creator unavailable'; end if;
 if not public.username_available(draft->>'username') then raise exception 'Username unavailable' using errcode='23505'; end if;
 if coalesce(length(trim(draft->>'displayName')),0) not between 1 and 80 or coalesce(length(trim(draft->>'bio')),0) not between 1 and 280
 or coalesce(draft->>'country','') !~ '^[A-Z]{2}$' or draft->>'currency' is distinct from 'eur' then raise exception 'Invalid profile'; end if;
 if jsonb_typeof(draft->'categories') is distinct from 'array' or jsonb_array_length(draft->'categories') not between 1 and 3
 or exists(select 1 from jsonb_array_elements_text(draft->'categories') c where c not in ('Creator','Model','Athlete','Musician','Fitness','Lifestyle','Fashion','Gaming','Business','Other')) then raise exception 'Invalid categories'; end if;
 if jsonb_typeof(draft->'socials') is distinct from 'object' or length((draft->'socials')::text)>2000 then raise exception 'Invalid links'; end if;
 if exists(select 1 from jsonb_each_text(draft->'socials') s where s.key not in ('instagram','tiktok','youtube','twitter','website') or length(s.value)>300 or (s.value<>'' and s.value !~ '^https://[^[:space:]]+$')) then raise exception 'Invalid links'; end if;
 if coalesce(draft->>'availability','') not in ('online','away','offline') or coalesce(draft->>'replyTime','') not in ('','~10 minutes','~1 hour','within 24 hours') then raise exception 'Invalid availability'; end if;
 if jsonb_typeof(draft->'acceptingMessages') is distinct from 'boolean' or jsonb_typeof(draft->'acceptingLive') is distinct from 'boolean' or jsonb_typeof(draft->'acceptingMedia') is distinct from 'boolean' then raise exception 'Invalid availability'; end if;
 if avatar<>'' and (length(avatar)>2048 or avatar not like ('https://%/storage/v1/object/public/avatars/'||uid::text||'/%')) then raise exception 'Invalid avatar'; end if;
 if jsonb_typeof(draft->'pricing') is distinct from 'array' or jsonb_array_length(draft->'pricing')<>6 or (select count(distinct p->>'kind') from jsonb_array_elements(draft->'pricing') p)<>6 then raise exception 'Invalid pricing'; end if;
 for price in select * from jsonb_array_elements(draft->'pricing') loop
  if coalesce(price->>'kind','') not in ('message','live_chat','voice_note','photo','video','vip') or jsonb_typeof(price->'enabled') is distinct from 'boolean'
  or coalesce(price->>'cents','') !~ '^[0-9]+$' or (price->>'cents')::numeric not between 100 and (case when price->>'kind' in ('live_chat','vip') then 10000 else 50000 end) then raise exception 'Invalid price'; end if;
 end loop;
 insert into public.creator_profiles(profile_id,handle,bio,categories,country,social_links,reply_time,availability,online,accepting_messages,accepting_live_chats,accepting_media_requests,onboarding_complete,onboarding_completed_at)
 values(uid,draft->>'username',trim(draft->>'bio'),array(select jsonb_array_elements_text(draft->'categories')),draft->>'country',draft->'socials',coalesce(draft->>'replyTime',''),(draft->>'availability')::public.availability_status,draft->>'availability'='online',(draft->>'acceptingMessages')::boolean,(draft->>'acceptingLive')::boolean,(draft->>'acceptingMedia')::boolean,true,now())
 on conflict(profile_id) do update set handle=excluded.handle,bio=excluded.bio,categories=excluded.categories,country=excluded.country,social_links=excluded.social_links,reply_time=excluded.reply_time,availability=excluded.availability,online=excluded.online,accepting_messages=excluded.accepting_messages,accepting_live_chats=excluded.accepting_live_chats,accepting_media_requests=excluded.accepting_media_requests,onboarding_complete=true,onboarding_completed_at=coalesce(public.creator_profiles.onboarding_completed_at,now()) returning id into creator;
 update public.profiles set display_name=trim(draft->>'displayName'),avatar_path=nullif(avatar,''),role=case when role='fan' then 'creator'::public.user_role else role end where id=uid;
 for price in select * from jsonb_array_elements(draft->'pricing') loop
  insert into public.creator_pricing(creator_id,kind,amount_cents,currency,active) values(creator,(price->>'kind')::public.interaction_kind,(price->>'cents')::integer,'eur',(price->>'enabled')::boolean)
  on conflict(creator_id,kind) do update set amount_cents=excluded.amount_cents,currency=excluded.currency,active=excluded.active;
 end loop;
 return creator;
end; $$;
revoke all on function public.save_creator_profile(jsonb) from public;
grant execute on function public.save_creator_profile(jsonb) to authenticated;

-- Authenticated participants may read each other's public names in shared conversations.
create function private.shares_conversation(other uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.conversation_members a join public.conversation_members b on a.conversation_id=b.conversation_id where a.profile_id=auth.uid() and b.profile_id=other);
$$;
revoke all on function private.shares_conversation(uuid) from public;
grant execute on function private.shares_conversation(uuid) to authenticated;
create policy profiles_conversation on public.profiles for select to authenticated using(private.shares_conversation(id));
create policy profiles_request_party on public.profiles for select to authenticated using(exists(select 1 from public.paid_interactions p where p.fan_id=profiles.id and private.owns_creator(p.creator_id)) or exists(select 1 from public.subscriptions s where s.fan_id=profiles.id and private.owns_creator(s.creator_id)));

create function public.respond_to_request(request_id uuid, action text) returns void language plpgsql security definer set search_path='' as $$
declare r public.interaction_requests; owner uuid;
begin
 select * into r from public.interaction_requests where id=request_id for update;
 if not found then raise exception 'Request not found'; end if;
 select c.profile_id into owner from public.paid_interactions p join public.creator_profiles c on c.id=p.creator_id where p.id=r.interaction_id;
 if owner is distinct from auth.uid() then raise exception 'Not authorized'; end if;
 if action in ('accept','decline') and (r.status<>'pending' or r.expires_at<=now()) then raise exception 'Request expired or already handled'; end if;
 if action='complete' and r.status<>'accepted' then raise exception 'Accept first'; end if;
 if action not in ('accept','decline','complete') then raise exception 'Invalid action'; end if;
 update public.interaction_requests set status=case action when 'accept' then 'accepted'::public.request_status when 'decline' then 'declined'::public.request_status else 'fulfilled'::public.request_status end,
 accepted_at=case when action='accept' then now() else accepted_at end,declined_at=case when action='decline' then now() else declined_at end,completed_at=case when action='complete' then now() else completed_at end,responded_at=now() where id=request_id;
 -- Intentionally never touches paid_interactions.status or any financial table.
end; $$;
revoke all on function public.respond_to_request(uuid,text) from public;
grant execute on function public.respond_to_request(uuid,text) to authenticated;

create function public.send_chat_message(conversation uuid, content text) returns uuid language plpgsql security definer set search_path='' as $$
declare message_id uuid;
begin
 if auth.uid() is null or not private.is_member(conversation) then raise exception 'Not authorized'; end if;
 if exists(select 1 from public.blocks b join public.conversation_members m on m.conversation_id=conversation where (b.blocker_id=auth.uid() and b.blocked_id=m.profile_id) or (b.blocked_id=auth.uid() and b.blocker_id=m.profile_id)) then raise exception 'Conversation unavailable'; end if;
 if length(trim(content)) not between 1 and 10000 then raise exception 'Invalid message'; end if;
 insert into public.messages(conversation_id,sender_id,body) values(conversation,auth.uid(),trim(content)) returning id into message_id;
 update public.conversations set updated_at=now() where id=conversation;
 update public.conversation_members set last_read_at=now() where conversation_id=conversation and profile_id=auth.uid();
 return message_id;
end; $$;
revoke all on function public.send_chat_message(uuid,text) from public;
grant execute on function public.send_chat_message(uuid,text) to authenticated;
grant update(last_read_at) on public.conversation_members to authenticated;
create policy membership_read_self on public.conversation_members for update to authenticated using(profile_id=auth.uid()) with check(profile_id=auth.uid());

-- Avatar files are intentionally public; paid/chat media stays private.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('avatars','avatars',true,2097152,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy avatars_upload_self on storage.objects for insert to authenticated with check(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy avatars_delete_self on storage.objects for delete to authenticated using(bucket_id='avatars' and (storage.foldername(name))[1]=auth.uid()::text);
create policy avatars_read on storage.objects for select to anon,authenticated using(bucket_id='avatars');
-- Enable message realtime when the publication exists (Supabase hosted/local).
do $$ begin if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='messages') then alter publication supabase_realtime add table public.messages; end if; end $$;
commit;
