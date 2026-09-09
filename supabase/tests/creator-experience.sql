-- Disposable test database only. Fixtures are rolled back.
begin;
insert into auth.users(id,raw_user_meta_data) values
('00000000-0000-4000-8000-000000000011','{"display_name":"Test creator","role":"admin"}'),
('00000000-0000-4000-8000-000000000012','{"display_name":"Test fan"}');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000011',true);
do $$
declare draft jsonb := '{"displayName":"Test creator","username":"test_launch","bio":"A fictional test profile.","image":"","categories":["Creator"],"country":"FR","socials":{},"currency":"eur","acceptingMessages":true,"acceptingLive":true,"acceptingMedia":true,"availability":"away","replyTime":"~1 hour","pricing":[{"kind":"message","cents":400,"enabled":true},{"kind":"live_chat","cents":300,"enabled":true},{"kind":"voice_note","cents":1000,"enabled":true},{"kind":"photo","cents":1500,"enabled":false},{"kind":"video","cents":3000,"enabled":true},{"kind":"vip","cents":1900,"enabled":true}]}'; cid uuid;
begin
 if (select role from public.profiles where id=auth.uid()) <> 'fan' then raise exception 'Metadata escalated role'; end if;
 cid:=public.save_creator_profile(draft);
 if (select role from public.profiles where id=auth.uid()) <> 'creator' then raise exception 'Promotion failed'; end if;
 if (select count(*) from public.creator_pricing where creator_id=cid) <>6 then raise exception 'Pricing incomplete'; end if;
 if not exists(select 1 from public.creator_profiles where id=cid and onboarding_complete and not verified and availability='away') then raise exception 'Profile incomplete'; end if;
 begin
  perform public.save_creator_profile(jsonb_set(draft,'{pricing,0,cents}','0'));
  raise exception 'Invalid price allowed';
 exception when raise_exception then if sqlerrm='Invalid price allowed' then raise; end if; end;
 if (select amount_cents from public.creator_pricing where creator_id=cid and kind='message')<>400 then raise exception 'Invalid save was not atomic'; end if;
end $$;
reset role;
insert into public.paid_interactions(id,fan_id,creator_id,kind,amount_cents,status)
select '30000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000012',id,'message',400,'authorized' from public.creator_profiles where handle='test_launch';
insert into public.interaction_requests(id,interaction_id,body,expires_at) values
('40000000-0000-4000-8000-000000000011','30000000-0000-4000-8000-000000000011','Hello',now()+interval '1 hour');
insert into public.conversations(id,created_by) values ('20000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000011');
insert into public.conversation_members(conversation_id,profile_id) values ('20000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000011');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000012',true);
do $$ begin
 if public.username_available('test_launch') then raise exception 'Duplicate username allowed'; end if;
 begin perform public.respond_to_request('40000000-0000-4000-8000-000000000011','accept'); raise exception 'Fan accepted creator request'; exception when raise_exception then if sqlerrm='Fan accepted creator request' then raise; end if; end;
 begin perform public.send_chat_message('20000000-0000-4000-8000-000000000011','Unauthorized'); raise exception 'Nonmember sent message'; exception when raise_exception then if sqlerrm='Nonmember sent message' then raise; end if; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000011',true);
select public.respond_to_request('40000000-0000-4000-8000-000000000011','accept');
select public.respond_to_request('40000000-0000-4000-8000-000000000011','complete');
select public.send_chat_message('20000000-0000-4000-8000-000000000011','Hello from a member');
do $$ begin
 if not exists(select 1 from public.interaction_requests where id='40000000-0000-4000-8000-000000000011' and status='fulfilled' and accepted_at is not null and completed_at is not null) then raise exception 'Request transition failed'; end if;
 if (select status from public.paid_interactions where id='30000000-0000-4000-8000-000000000011') <> 'authorized' then raise exception 'Request action changed payment state'; end if;
end $$;
reset role;
rollback;
\echo 'Creator RPC checks passed (fixtures rolled back).'
