-- Test-mode guaranteed replies. Financial mutations are service-role only.
begin;
create type public.secured_payment_state as enum ('pending','authorized','captured','canceled','refunded','disputed','failed');
create table public.creator_stripe_accounts (
 creator_id uuid primary key references public.creator_profiles(id),
 stripe_account_id text unique,
 ready boolean not null default false,
 transfers_enabled boolean not null default false,
 payouts_enabled boolean not null default false,
 requirements_due boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.reply_payments (
 id uuid primary key default gen_random_uuid(),
 interaction_id uuid not null unique references public.paid_interactions(id),
 request_id uuid not null unique default gen_random_uuid(),
 fan_id uuid not null references public.profiles(id),
 creator_id uuid not null references public.creator_profiles(id),
 creator_account_id text not null,
 attempt_key uuid not null,
 message text not null check(length(trim(message)) between 1 and 2000),
 gross_cents integer not null check(gross_cents between 100 and 50000),
 fee_cents integer not null check(fee_cents>=0),
 creator_cents integer not null check(creator_cents>0),
 fee_bps integer not null check(fee_bps between 0 and 9999),
 currency text not null check(currency in ('eur','usd','gbp')),
 payment_state public.secured_payment_state not null default 'pending',
 stripe_payment_intent_id text unique, stripe_charge_id text unique, stripe_transfer_id text unique, stripe_refund_id text unique, stripe_reversal_id text unique,
 operation text not null default 'idle' check(operation in ('idle','capture','decline','expire','refund')),
 transfer_state text not null default 'not_due' check(transfer_state in ('not_due','pending','transferred','reversal_pending','reversed','failed')),
 conversation_id uuid unique references public.conversations(id),
 fulfillment_message_id uuid unique references public.messages(id),
 needs_reconciliation boolean not null default false,
 expires_at timestamptz, authorized_at timestamptz, accepted_at timestamptz, declined_at timestamptz, captured_at timestamptz, canceled_at timestamptz, completed_at timestamptz, expired_at timestamptz, refunded_at timestamptz, transferred_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(fan_id,attempt_key), check(gross_cents=fee_cents+creator_cents)
);
create table public.stripe_webhook_events (
 id text primary key, event_type text not null, received_at timestamptz not null default now(), processed_at timestamptz, attempts integer not null default 0
);
alter table public.paid_interactions add column fee_cents integer, add column creator_cents integer,
 add constraint fee_snapshot_valid check(fee_cents is null or (fee_cents>=0 and creator_cents>0 and amount_cents=fee_cents+creator_cents));
create index reply_reconciliation_idx on public.reply_payments(payment_state,expires_at);
create index reply_creator_idx on public.reply_payments(creator_id,created_at desc);
create index reply_fan_idx on public.reply_payments(fan_id,created_at desc);
do $$ declare t text; begin foreach t in array array['creator_stripe_accounts','reply_payments','stripe_webhook_events'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
end loop; end $$;
-- Retire client-executable state/message RPCs. New trusted handlers authenticate participants.
revoke execute on function public.respond_to_request(uuid,text) from authenticated;
revoke execute on function public.send_chat_message(uuid,text) from authenticated;
revoke execute on function public.send_chat_attachment(uuid,text,text,text,bigint) from authenticated;

create function public.prepare_reply(fan uuid, creator uuid, attempt uuid, content text, fee_basis integer) returns public.reply_payments
language plpgsql security definer set search_path='' as $$
declare result public.reply_payments; c public.creator_profiles; price public.creator_pricing; acct public.creator_stripe_accounts; iid uuid; fee integer;
begin
 perform pg_advisory_xact_lock(hashtextextended(fan::text||attempt::text,0));
 select * into result from public.reply_payments where fan_id=fan and attempt_key=attempt;
 if found then
  if result.creator_id<>creator or result.message<>trim(content) then raise exception 'Attempt already used for another request'; end if;
  return result;
 end if;
 select * into c from public.creator_profiles where id=creator;
 if not found or c.profile_id=fan or c.status in ('rejected','suspended') or not c.onboarding_complete or not c.accepting_messages then raise exception 'Creator unavailable'; end if;
 if exists(select 1 from public.blocks where (blocker_id=fan and blocked_id=c.profile_id) or (blocker_id=c.profile_id and blocked_id=fan)) then raise exception 'Creator unavailable'; end if;
 select * into acct from public.creator_stripe_accounts where creator_id=creator;
 if not found or not acct.ready or acct.stripe_account_id is null then raise exception 'Complete payout setup first'; end if;
 select * into price from public.creator_pricing where creator_id=creator and kind='message' and active;
 if not found then raise exception 'Guaranteed reply unavailable'; end if;
 if content is null or length(trim(content)) not between 1 and 2000 or fee_basis is null or fee_basis not between 0 and 9999 then raise exception 'Invalid request'; end if;
 fee:=((price.amount_cents::bigint*fee_basis+5000)/10000)::integer;
 insert into public.paid_interactions(fan_id,creator_id,kind,amount_cents,currency,fee_cents,creator_cents) values(fan,creator,'message',price.amount_cents,price.currency,fee,price.amount_cents-fee) returning id into iid;
 insert into public.reply_payments(interaction_id,fan_id,creator_id,creator_account_id,attempt_key,message,gross_cents,fee_cents,creator_cents,fee_bps,currency)
 values(iid,fan,creator,acct.stripe_account_id,attempt,trim(content),price.amount_cents,fee,price.amount_cents-fee,fee_basis,price.currency) returning * into result;
 return result;
end $$;

create function public.reply_transition(payment uuid, action text, actor uuid default null, payload jsonb default '{}') returns public.reply_payments
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
  if p.payment_state='pending' then
   deadline:=least(now()+make_interval(secs => least(86400,greatest(30,(payload->>'ttl')::integer))), (payload->>'capture_before')::timestamptz-interval '1 minute');
   if deadline is null then raise exception 'Missing authorization deadline'; end if;
   update public.reply_payments set payment_state='authorized',authorized_at=now(),expires_at=deadline where id=p.id;
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
  if p.operation='idle' and p.payment_state in ('pending','authorized') then
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
  if p.payment_state in ('authorized','pending') then
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
  if p.payment_state<>'captured' then raise exception 'Capture first'; end if;
  update public.reply_payments set stripe_transfer_id=payload->>'transfer',transfer_state='transferred',transferred_at=coalesce(transferred_at,now()),needs_reconciliation=false where id=p.id;
  insert into public.transactions(interaction_id,kind,amount_cents,currency,stripe_event_id,stripe_object_id) values(p.interaction_id,'transfer',p.creator_cents,p.currency,'transfer:'||p.id,payload->>'transfer') on conflict do nothing;
 elsif action='refund' then
  if actor is null or not exists(select 1 from public.profiles where id=actor and role='admin') then raise exception 'Admin required'; end if;
  if p.payment_state not in ('captured','refunded') then raise exception 'Captured payment required'; end if;
  update public.reply_payments set operation='refund',needs_reconciliation=true where id=p.id;
 elsif action='refunded' then
  update public.reply_payments set payment_state='refunded',stripe_refund_id=payload->>'refund',refunded_at=coalesce(refunded_at,now()),needs_reconciliation=(stripe_transfer_id is not null and stripe_reversal_id is null),transfer_state=case when stripe_transfer_id is not null then 'reversal_pending' else transfer_state end where id=p.id;
  update public.paid_interactions set status='refunded' where id=p.interaction_id;
  insert into public.transactions(interaction_id,kind,amount_cents,currency,stripe_event_id,stripe_object_id) values(p.interaction_id,'refund',(payload->>'amount')::integer,p.currency,'refund:'||(payload->>'refund'),payload->>'refund') on conflict do nothing;
 elsif action='disputed' then
  update public.reply_payments set payment_state='disputed',needs_reconciliation=true,transfer_state=case when stripe_transfer_id is not null then 'reversal_pending' else transfer_state end where id=p.id;
  update public.paid_interactions set status='disputed' where id=p.interaction_id;
 elsif action='reversed' then
  update public.reply_payments set stripe_reversal_id=payload->>'reversal',transfer_state='reversed',needs_reconciliation=false where id=p.id;
 elsif action='attention' then update public.reply_payments set needs_reconciliation=true where id=p.id;
 else raise exception 'Invalid transition'; end if;
 update public.reply_payments set updated_at=now() where id=p.id returning * into p;
 return p;
end $$;

-- A reply and its durable capture claim commit together before any Stripe call.
create function public.send_secured_message(sender uuid, conversation uuid, content text, object_path text default null, mime text default null, bytes bigint default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare p public.reply_payments; owner uuid; mid uuid;
begin
 select * into p from public.reply_payments where conversation_id=conversation for update;
 if not exists(select 1 from public.conversation_members where conversation_id=conversation and profile_id=sender) then raise exception 'Not authorized'; end if;
 if exists(select 1 from public.blocks b join public.conversation_members m on m.conversation_id=conversation where (b.blocker_id=sender and b.blocked_id=m.profile_id) or (b.blocked_id=sender and b.blocker_id=m.profile_id)) then raise exception 'Conversation unavailable'; end if;
 if content is null or length(trim(content)) not between 1 and 10000 then raise exception 'Invalid message'; end if;
 if p.id is not null then
  select profile_id into owner from public.creator_profiles where id=p.creator_id;
  if p.fulfillment_message_id is null and sender=owner and (p.accepted_at is null or p.expires_at<=now() or p.payment_state<>'authorized' or p.operation<>'idle') then raise exception 'Reply deadline passed or request unavailable'; end if;
 end if;
 if object_path is not null and (object_path not like conversation::text||'/'||sender::text||'/%' or mime not in ('image/jpeg','image/png','image/webp') or bytes not between 1 and 1048576 or not exists(select 1 from storage.objects where bucket_id='chat-attachments' and name=object_path)) then raise exception 'Invalid attachment'; end if;
 insert into public.messages(conversation_id,sender_id,body) values(conversation,sender,trim(content)) returning id into mid;
 if object_path is not null then insert into public.media(owner_id,message_id,kind,visibility,storage_path,mime_type,size_bytes) values(sender,mid,'image','private',object_path,mime,bytes); end if;
 if p.id is not null and sender=owner and p.fulfillment_message_id is null then perform public.reply_transition(p.id,'reply',sender,jsonb_build_object('message_id',mid)); end if;
 update public.conversations set updated_at=now() where id=conversation;
 return jsonb_build_object('id',mid,'payment_id',p.id);
end $$;
revoke all on function public.prepare_reply(uuid,uuid,uuid,text,integer), public.reply_transition(uuid,text,uuid,jsonb), public.send_secured_message(uuid,uuid,text,text,text,bigint) from public,anon,authenticated;
grant execute on function public.prepare_reply(uuid,uuid,uuid,text,integer), public.reply_transition(uuid,text,uuid,jsonb), public.send_secured_message(uuid,uuid,text,text,text,bigint) to service_role;
commit;
