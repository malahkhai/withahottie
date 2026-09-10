-- Disposable database only. Requires migrations 001–006. All fixtures roll back.
begin;
insert into auth.users(id,raw_user_meta_data) values
('00000000-0000-4000-8000-000000000021','{"display_name":"Fan One","role":"admin"}'),
('00000000-0000-4000-8000-000000000022','{"display_name":"Fan Two"}'),
('00000000-0000-4000-8000-000000000023','{"display_name":"Creator One"}'),
('00000000-0000-4000-8000-000000000024','{"display_name":"Creator Two"}');
update public.profiles set role='creator' where id in ('00000000-0000-4000-8000-000000000023','00000000-0000-4000-8000-000000000024');
insert into public.creator_profiles(id,profile_id,handle,status,onboarding_complete) values
('10000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000023','secured_creator','approved',true),
('10000000-0000-4000-8000-000000000022','00000000-0000-4000-8000-000000000024','unready_creator','approved',true);
insert into public.creator_stripe_accounts(creator_id,stripe_account_id,ready) values('10000000-0000-4000-8000-000000000021','acct_test_secured',true);
insert into public.creator_pricing(creator_id,kind,amount_cents,active) values
('10000000-0000-4000-8000-000000000021','message',400,true),
('10000000-0000-4000-8000-000000000022','message',400,true);
do $$ begin
 if (select active from public.creator_pricing where creator_id='10000000-0000-4000-8000-000000000022') then raise exception 'Payout readiness bypassed'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000021',true);
do $$ begin
 if (select role from public.profiles where id=auth.uid())<>'fan' then raise exception 'Signup role escalation'; end if;
 begin perform * from public.reply_payments;raise exception 'Financial table exposed';exception when insufficient_privilege then null;end;
 begin perform * from public.creator_stripe_accounts;raise exception 'Connect identifiers exposed';exception when insufficient_privilege then null;end;
 begin perform public.prepare_reply(auth.uid(),'10000000-0000-4000-8000-000000000021',gen_random_uuid(),'Manipulated',0);raise exception 'Fan bypassed server price/fee authority';exception when insufficient_privilege then null;end;
 begin perform public.reply_transition(gen_random_uuid(),'captured',auth.uid(),'{}');raise exception 'Fan captured payment';exception when insufficient_privilege then null;end;
 begin perform public.respond_to_request(gen_random_uuid(),'complete');raise exception 'Legacy completion bypass';exception when insufficient_privilege then null;end;
 begin perform public.send_chat_message(gen_random_uuid(),'Bypass');raise exception 'Legacy send bypass';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role service_role;
do $$
declare p public.reply_payments; again public.reply_payments; reply jsonb; first_reply uuid; c uuid; x public.reply_payments;
begin
 begin perform public.prepare_reply('00000000-0000-4000-8000-000000000021','10000000-0000-4000-8000-000000000022',gen_random_uuid(),'Unready',1500);raise exception 'Unready creator purchased';exception when raise_exception then if sqlerrm='Unready creator purchased' then raise;end if;end;
 p:=public.prepare_reply('00000000-0000-4000-8000-000000000021','10000000-0000-4000-8000-000000000021','50000000-0000-4000-8000-000000000021','What inspires your work?',1500);
 again:=public.prepare_reply(p.fan_id,p.creator_id,p.attempt_key,p.message,0);
 if again.id<>p.id or again.gross_cents<>400 or again.fee_cents<>60 or again.creator_cents<>340 then raise exception 'Duplicate attempt or fee snapshot error';end if;
 if exists(select 1 from public.interaction_requests where id=p.request_id) then raise exception 'Request exposed before authorization';end if;
 begin perform public.prepare_reply(p.fan_id,'10000000-0000-4000-8000-000000000022',p.attempt_key,p.message,1500);raise exception 'Creator substitution accepted';exception when raise_exception then if sqlerrm='Creator substitution accepted' then raise;end if;end;
 begin update public.reply_payments set gross_cents=500,creator_cents=440 where id=p.id;raise exception 'Snapshot changed';exception when raise_exception then if sqlerrm='Snapshot changed' then raise;end if;end;
 p:=public.reply_transition(p.id,'bind',null,'{"intent":"pi_secured_test"}');
 p:=public.reply_transition(p.id,'authorize',null,jsonb_build_object('ttl',86400,'capture_before',now()+interval '7 days'));
 perform public.reply_transition(p.id,'authorize',null,jsonb_build_object('ttl',86400,'capture_before',now()+interval '7 days'));
 if (select count(*) from public.interaction_requests where id=p.request_id)<>1 then raise exception 'Authorization not idempotent';end if;
 begin perform public.reply_transition(p.id,'accept','00000000-0000-4000-8000-000000000024');raise exception 'Creator IDOR accepted';exception when raise_exception then if sqlerrm='Creator IDOR accepted' then raise;end if;end;
 p:=public.reply_transition(p.id,'accept','00000000-0000-4000-8000-000000000023');c:=p.conversation_id;
 again:=public.reply_transition(p.id,'accept','00000000-0000-4000-8000-000000000023');
 if again.conversation_id<>c or again.payment_state<>'authorized' then raise exception 'Accept duplicated/captured';end if;
 begin perform public.send_secured_message('00000000-0000-4000-8000-000000000024',c,'Intruder');raise exception 'Creator reply IDOR';exception when raise_exception then if sqlerrm='Creator reply IDOR' then raise;end if;end;
 begin perform public.send_secured_message('00000000-0000-4000-8000-000000000023',c,' ');raise exception 'Empty fulfillment';exception when raise_exception then if sqlerrm='Empty fulfillment' then raise;end if;end;
 perform public.send_secured_message(p.fan_id,c,'Fan follow-up');
 if (select fulfillment_message_id from public.reply_payments where id=p.id) is not null then raise exception 'Fan reply captured';end if;
 reply:=public.send_secured_message('00000000-0000-4000-8000-000000000023',c,'Here is the story behind my work.');first_reply:=(reply->>'id')::uuid;
 perform public.send_secured_message('00000000-0000-4000-8000-000000000023',c,'A second message.');
 select * into p from public.reply_payments where id=p.id;
 if p.fulfillment_message_id<>first_reply or p.operation<>'capture' or p.payment_state<>'authorized' then raise exception 'Fulfillment claim failed';end if;
 p:=public.reply_transition(p.id,'captured',null,'{"charge":"ch_secured_test"}');
 perform public.reply_transition(p.id,'captured',null,'{"charge":"ch_secured_test"}');
 p:=public.reply_transition(p.id,'transferred',null,'{"transfer":"tr_secured_test"}');
 perform public.reply_transition(p.id,'transferred',null,'{"transfer":"tr_secured_test"}');
 if (select count(*) from public.transactions where interaction_id=p.interaction_id)<>3 then raise exception 'Duplicate ledger entries';end if;
 begin perform public.reply_transition(p.id,'refund',p.fan_id);raise exception 'Unauthorized refund';exception when raise_exception then if sqlerrm='Unauthorized refund' then raise;end if;end;
 -- An accepted request still expires if no creator reply arrives.
 x:=public.prepare_reply(p.fan_id,p.creator_id,gen_random_uuid(),'Another question',1500);
 x:=public.reply_transition(x.id,'authorize',null,jsonb_build_object('ttl',30,'capture_before',now()+interval '7 days'));
 x:=public.reply_transition(x.id,'accept','00000000-0000-4000-8000-000000000023');
 update public.reply_payments set expires_at=now()-interval '1 second' where id=x.id;
 begin perform public.send_secured_message('00000000-0000-4000-8000-000000000023',x.conversation_id,'Too late');raise exception 'Expired reply accepted';exception when raise_exception then if sqlerrm='Expired reply accepted' then raise;end if;end;
 x:=public.reply_transition(x.id,'expire');x:=public.reply_transition(x.id,'canceled');
 if x.payment_state<>'canceled' then raise exception 'Expiration failed';end if;
 insert into public.stripe_webhook_events(id,event_type) values('evt_secured_test','payment_intent.succeeded') on conflict do nothing;
 insert into public.stripe_webhook_events(id,event_type) values('evt_secured_test','payment_intent.succeeded') on conflict do nothing;
 if (select count(*) from public.stripe_webhook_events where id='evt_secured_test')<>1 then raise exception 'Webhook inbox duplicated';end if;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000022',true);
do $$ begin
 if exists(select 1 from public.paid_interactions) or exists(select 1 from public.interaction_requests) then raise exception 'Fan request IDOR';end if;
 begin update public.transactions set amount_cents=1;raise exception 'Unauthorized transaction mutation';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
\echo 'Secured reply database/security checks passed.'
