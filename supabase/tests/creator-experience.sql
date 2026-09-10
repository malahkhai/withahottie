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
do $$ begin
 begin perform public.respond_to_request(gen_random_uuid(),'complete');raise exception 'Legacy completion still exposed';exception when insufficient_privilege then null;end;
 begin perform public.send_chat_message(gen_random_uuid(),'Bypass');raise exception 'Legacy send still exposed';exception when insufficient_privilege then null;end;
 if exists(select 1 from public.creator_pricing where kind='message' and active) then raise exception 'Payout gate bypassed through onboarding';end if;
end $$;
reset role;
rollback;
\echo 'Onboarding validation, atomic role promotion, and legacy RPC revocation checks passed.'
