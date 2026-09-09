-- Run ONLY against a disposable test database. All fixtures roll back.
begin;
insert into auth.users(id, raw_user_meta_data) values
('00000000-0000-4000-8000-000000000001', '{"display_name":"Fan A", "role":"admin"}'),
('00000000-0000-4000-8000-000000000002', '{"display_name":"Fan B"}'),
('00000000-0000-4000-8000-000000000003', '{"display_name":"Creator"}'),
('00000000-0000-4000-8000-000000000004', '{"display_name":"Admin"}');
update public.profiles set role = 'creator' where id = '00000000-0000-4000-8000-000000000003';
update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-000000000004';
insert into public.creator_profiles(id, profile_id, handle, status) values ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003', 'test_creator', 'approved');
insert into public.creator_pricing(creator_id, kind, amount_cents) values ('10000000-0000-4000-8000-000000000001', 'message', 400);
insert into public.conversations(id, created_by) values ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001');
insert into public.conversation_members(conversation_id, profile_id) values
('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001'),
('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003');
insert into public.messages(conversation_id, sender_id, body) values ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'private message');
insert into public.paid_interactions(id, fan_id, creator_id, kind, amount_cents) values ('30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'message', 400);
insert into public.transactions(interaction_id, kind, amount_cents, stripe_event_id, stripe_object_id) values ('30000000-0000-4000-8000-000000000001', 'charge', 400, 'evt_test', 'pi_test');
insert into public.media(owner_id, kind, visibility, storage_path, mime_type, size_bytes) values ('00000000-0000-4000-8000-000000000003','image','vip','test/private.jpg','image/jpeg',100);
insert into public.subscriptions(fan_id,creator_id,status,amount_cents,current_period_end) values ('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','active',1900,now()+interval '1 day');

set local role anon;
do $$ begin
  if (select count(*) from public.profiles) <> 1 then raise exception 'Anon can see private profiles'; end if;
  if (select count(*) from public.creator_pricing) <> 1 then raise exception 'Public pricing unavailable'; end if;
  begin perform * from public.transactions; raise exception 'Anon can access transactions'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
do $$ begin
  if (select count(*) from public.messages) <> 0 then raise exception 'Unrelated fan can read messages'; end if;
  if (select count(*) from public.paid_interactions) <> 0 then raise exception 'Unrelated fan can read payments'; end if;
  if (select count(*) from public.media) <> 0 then raise exception 'Unsubscribed fan can read VIP'; end if;
  if (select count(*) from public.transactions) <> 0 then raise exception 'Fan can read ledger'; end if;
  begin update public.profiles set role='admin' where id=auth.uid(); raise exception 'Role escalation allowed'; exception when insufficient_privilege then null; end;
  begin update public.paid_interactions set status='captured'; raise exception 'Browser can change money'; exception when insufficient_privilege then null; end;
  begin insert into public.conversation_members(conversation_id,profile_id) values ('20000000-0000-4000-8000-000000000001',auth.uid()); raise exception 'Self-joining private conversation allowed'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
do $$ begin
  if (select role from public.profiles where id=auth.uid()) <> 'fan' then raise exception 'Signup metadata escalated role'; end if;
  if (select count(*) from public.messages) <> 1 then raise exception 'Member cannot read messages'; end if;
  if (select count(*) from public.conversation_members) <> 2 then raise exception 'Member lookup recursion or failure'; end if;
  if (select count(*) from public.paid_interactions) <> 1 then raise exception 'Fan cannot read own interaction'; end if;
  if (select count(*) from public.media) <> 1 then raise exception 'Active VIP entitlement failed'; end if;
  update public.profiles set display_name='Updated fan' where id=auth.uid();
end $$;
reset role;
update public.subscriptions set current_period_end=now()-interval '1 day';
set local role authenticated;
do $$ begin if (select count(*) from public.media) <> 0 then raise exception 'Expired VIP entitlement allowed'; end if; end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
do $$ begin
  if (select count(*) from public.paid_interactions) <> 1 then raise exception 'Creator cannot read own interaction'; end if;
  begin update public.creator_profiles set verified=true; raise exception 'Creator can self-verify'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',true);
do $$ begin
  if (select count(*) from public.transactions) <> 1 then raise exception 'Admin cannot read ledger'; end if;
  begin update public.paid_interactions set status='captured'; raise exception 'Admin browser can change money'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
\echo 'RLS checks passed (fixtures rolled back).'
