begin;
alter table public.reply_payments add column manual_review boolean not null default false;

create function private.guard_reply_pricing() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.kind='message' and new.active and not exists(select 1 from public.creator_stripe_accounts where creator_id=new.creator_id and ready) then new.active:=false; end if;
 return new;
end $$;
create trigger reply_pricing_readiness before insert or update on public.creator_pricing for each row execute function private.guard_reply_pricing();
update public.creator_pricing set active=false where kind='message' and not exists(select 1 from public.creator_stripe_accounts a where a.creator_id=creator_pricing.creator_id and a.ready);
create function private.immutable_reply_money() returns trigger language plpgsql set search_path='' as $$
begin
 if row(new.interaction_id,new.request_id,new.fan_id,new.creator_id,new.creator_account_id,new.attempt_key,new.message,new.gross_cents,new.fee_cents,new.creator_cents,new.fee_bps,new.currency) is distinct from row(old.interaction_id,old.request_id,old.fan_id,old.creator_id,old.creator_account_id,old.attempt_key,old.message,old.gross_cents,old.fee_cents,old.creator_cents,old.fee_bps,old.currency) then raise exception 'Financial snapshots are immutable'; end if;
 return new;
end $$;
create trigger immutable_reply_money before update on public.reply_payments for each row execute function private.immutable_reply_money();
revoke all on function private.guard_reply_pricing(),private.immutable_reply_money() from public;

create or replace function public.reply_transition(payment uuid, action text, actor uuid default null, payload jsonb default '{}') returns public.reply_payments
language plpgsql security definer set search_path='' as $$
declare p public.reply_payments; owner uuid; deadline timestamptz; msg uuid; conv uuid;
begin
 select * into p from public.reply_payments where id=payment for update;
 if not found then raise exception 'Request unavailable'; end if;
 select profile_id into owner from public.creator_profiles where id=p.creator_id;
 if action in ('accept','decline','reply') and actor is distinct from owner then raise exception 'Not authorized'; end if;
 if action='bind' then
  if p.stripe_payment_intent_id is not null and p.stripe_payment_intent_id<>payload->>'intent' then raise exception 'Payment mismatch'; end if;
  update public.reply_payments set stripe_payment_intent_id=payload->>'intent' where id=p.id;
 elsif action='authorize' then
  if p.payment_state in ('pending','failed') and p.fulfillment_message_id is null then
   deadline:=least(now()+make_interval(secs => least(86400,greatest(30,(payload->>'ttl')::integer))), (payload->>'capture_before')::timestamptz-interval '1 minute');
   if deadline is null then raise exception 'Missing authorization deadline'; end if;
   update public.reply_payments set payment_state='authorized',needs_reconciliation=false,authorized_at=now(),expires_at=deadline where id=p.id;
   update public.paid_interactions set status='authorized',expires_at=deadline where id=p.interaction_id;
   if deadline>now() then insert into public.interaction_requests(id,interaction_id,body,expires_at) values(p.request_id,p.interaction_id,p.message,deadline) on conflict(id) do nothing; end if;
  end if;
 elsif action='accept' then
  if p.accepted_at is null then
   if p.payment_state<>'authorized' or p.operation<>'idle' or p.expires_at<=now() then raise exception 'Request no longer available'; end if;
   insert into public.conversations(created_by) values(owner) returning id into conv;
   insert into public.conversation_members(conversation_id,profile_id) values(conv,owner),(conv,p.fan_id);
   insert into public.messages(conversation_id,sender_id,body) values(conv,p.fan_id,p.message);
   update public.reply_payments set accepted_at=now(),conversation_id=conv where id=p.id;
   update public.paid_interactions set conversation_id=conv where id=p.interaction_id;
   update public.interaction_requests set status='accepted',accepted_at=now() where id=p.request_id;
  end if;
 elsif action in ('decline','expire') then
  if p.operation='idle' and p.payment_state in ('pending','authorized','failed') then
   if action='decline' and p.accepted_at is not null then raise exception 'Request already accepted'; end if;
   if action='expire' and coalesce(p.expires_at,p.created_at+interval '23 hours')>now() then raise exception 'Request not expired'; end if;
   update public.reply_payments set operation=action where id=p.id;
  elsif p.operation not in (action,'expire','decline') and p.payment_state not in ('canceled','failed') then raise exception 'Request is being fulfilled'; end if;
 elsif action='reply' then
  if p.payment_state<>'authorized' or p.accepted_at is null or p.operation not in ('idle','capture') then raise exception 'Request not open'; end if;
  if p.fulfillment_message_id is null then
   if p.expires_at<=now() then raise exception 'Reply deadline passed'; end if;
   if not exists(select 1 from public.messages where id=(payload->>'message_id')::uuid and conversation_id=p.conversation_id and sender_id=owner and length(trim(body))>0 and created_at<=p.expires_at) then raise exception 'Qualifying reply required'; end if;
   update public.reply_payments set fulfillment_message_id=(payload->>'message_id')::uuid,operation='capture',needs_reconciliation=true where id=p.id;
  end if;
 elsif action='captured' then
  if p.fulfillment_message_id is null or p.operation not in ('capture','refund') then raise exception 'Unfulfilled payment capture requires investigation'; end if;
  if p.payment_state in ('authorized','pending','failed') then
   update public.reply_payments set payment_state='captured',stripe_charge_id=payload->>'charge',captured_at=now(),completed_at=now(),transfer_state='pending',needs_reconciliation=true where id=p.id;
   update public.paid_interactions set status='captured',captured_at=now(),completed_at=now() where id=p.interaction_id;
   update public.interaction_requests set status='fulfilled',completed_at=now() where id=p.request_id;
   insert into public.transactions(interaction_id,kind,amount_cents,currency,stripe_event_id,stripe_object_id) values(p.interaction_id,'charge',p.gross_cents,p.currency,'capture:'||p.id,payload->>'charge') on conflict do nothing;
   if p.fee_cents>0 then insert into public.transactions(interaction_id,kind,amount_cents,currency,stripe_event_id,stripe_object_id) values(p.interaction_id,'fee',p.fee_cents,p.currency,'fee:'||p.id,payload->>'charge') on conflict do nothing; end if;
  end if;
 elsif action='canceled' then
  if p.payment_state not in ('captured','refunded','disputed') then
   update public.reply_payments set payment_state='canceled',canceled_at=coalesce(canceled_at,now()),declined_at=case when operation='decline' then coalesce(declined_at,now()) else declined_at end,expired_at=case when operation<>'decline' then coalesce(expired_at,now()) else expired_at end,needs_reconciliation=false where id=p.id;
   update public.paid_interactions set status=case when p.operation='decline' then 'declined'::public.payment_status else 'expired'::public.payment_status end where id=p.interaction_id;
   update public.interaction_requests set status=case when p.operation='decline' then 'declined'::public.request_status else 'expired'::public.request_status end,declined_at=case when p.operation='decline' then now() else null end where id=p.request_id;
  end if;
 elsif action='failed' then
  if p.payment_state in ('pending','authorized') then update public.reply_payments set payment_state='failed',needs_reconciliation=(fulfillment_message_id is not null) where id=p.id; end if;
 elsif action='transferred' then
  if p.payment_state not in ('captured','refunded','disputed') then raise exception 'Capture first'; end if;
  update public.reply_payments set stripe_transfer_id=payload->>'transfer',transfer_state=case when payment_state='captured' then 'transferred' else 'reversal_pending' end,transferred_at=coalesce(transferred_at,now()),needs_reconciliation=(payment_state<>'captured') where id=p.id;
  insert into public.transactions(interaction_id,kind,amount_cents,currency,stripe_event_id,stripe_object_id) values(p.interaction_id,'transfer',p.creator_cents,p.currency,'transfer:'||p.id,payload->>'transfer') on conflict do nothing;
 elsif action='refund' then
  if actor is null or not exists(select 1 from public.profiles where id=actor and role='admin') then raise exception 'Admin required'; end if;
  if p.payment_state not in ('captured','refunded') then raise exception 'Captured payment required'; end if;

  update public.reply_payments set operation='refund',needs_reconciliation=true where id=p.id;
 elsif action='refunded' then
  update public.reply_payments set payment_state='refunded',manual_review=false,stripe_refund_id=payload->>'refund',refunded_at=coalesce(refunded_at,now()),needs_reconciliation=(stripe_transfer_id is not null and stripe_reversal_id is null),transfer_state=case when stripe_transfer_id is not null then 'reversal_pending' else transfer_state end where id=p.id;
  update public.paid_interactions set status='refunded' where id=p.interaction_id;
  insert into public.transactions(interaction_id,kind,amount_cents,currency,stripe_event_id,stripe_object_id) values(p.interaction_id,'refund',(payload->>'amount')::integer,p.currency,'refund:'||(payload->>'refund'),payload->>'refund') on conflict do nothing;
 elsif action='disputed' then
  update public.reply_payments set payment_state='disputed',needs_reconciliation=true,transfer_state=case when stripe_transfer_id is not null then 'reversal_pending' else transfer_state end where id=p.id;
  update public.paid_interactions set status='disputed' where id=p.interaction_id;
 elsif action='reversed' then
  update public.reply_payments set stripe_reversal_id=payload->>'reversal',transfer_state='reversed',needs_reconciliation=false where id=p.id;
 elsif action='attention' then update public.reply_payments set needs_reconciliation=true,manual_review=manual_review or coalesce((payload->>'manual_review')::boolean,false),transfer_state=case when payment_state='captured' and stripe_transfer_id is null then 'failed' else transfer_state end where id=p.id;
 else raise exception 'Invalid transition'; end if;
 update public.reply_payments set updated_at=now() where id=p.id returning * into p;
 return p;
end $$;


commit;
