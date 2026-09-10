"""Run ONLY on a disposable migrated database with TEST_DATABASE_URL and psql available."""
import concurrent.futures
import json
import os
import subprocess
import uuid

url = os.environ['TEST_DATABASE_URL']
psql = os.environ.get('PSQL', 'psql')
def sql(query):
    result = subprocess.run([psql, url, '-X', '-At', '-v', 'ON_ERROR_STOP=1', '-c', query], capture_output=True, text=True)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return result.stdout.strip()
fan, owner, creator, attempt = [str(uuid.uuid4()) for _ in range(4)]
payment = interaction = conversation = None
try:
    sql(f"""insert into auth.users(id,raw_user_meta_data) values ('{fan}','{{"display_name":"Concurrency fan"}}'),('{owner}','{{"display_name":"Concurrency creator"}}');
    update public.profiles set role='creator' where id='{owner}';
    insert into public.creator_profiles(id,profile_id,handle,status,onboarding_complete) values('{creator}','{owner}','race_{creator[:8]}','approved',true);
    insert into public.creator_stripe_accounts(creator_id,stripe_account_id,ready) values('{creator}','acct_{creator}',true);
    insert into public.creator_pricing(creator_id,kind,amount_cents) values('{creator}','message',400);""")
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        rows = list(pool.map(lambda _: json.loads(sql(f"select row_to_json(p) from public.prepare_reply('{fan}','{creator}','{attempt}','Concurrent question',1500) p")), range(2)))
    assert rows[0]['id'] == rows[1]['id'], 'Duplicate checkout created two orders'
    payment, interaction = rows[0]['id'], rows[0]['interaction_id']
    sql(f"select public.reply_transition('{payment}','authorize',null,jsonb_build_object('ttl',86400,'capture_before',now()+interval '7 days'))")
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        rows = list(pool.map(lambda _: json.loads(sql(f"select row_to_json(p) from public.reply_transition('{payment}','accept','{owner}') p")), range(2)))
    assert rows[0]['conversation_id'] == rows[1]['conversation_id'], 'Duplicate conversations'
    conversation = rows[0]['conversation_id']
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        replies = list(pool.map(lambda n: json.loads(sql(f"select public.send_secured_message('{owner}','{conversation}','Thoughtful reply {n}')")), range(2)))
    claim = json.loads(sql(f"select row_to_json(p) from public.reply_payments p where id='{payment}'"))
    assert claim['fulfillment_message_id'] in [reply['id'] for reply in replies]
    assert claim['operation'] == 'capture' and claim['payment_state'] == 'authorized'
    assert int(sql(f"select count(*) from public.messages where conversation_id='{conversation}' and sender_id='{owner}'")) == 2
    print('PASS: simultaneous checkout, accept, and creator replies produce one order, one conversation, and one durable capture claim; both replies are retained.')
finally:
    if payment:
        sql(f"delete from public.transactions where interaction_id='{interaction}'; delete from public.reply_payments where id='{payment}'; delete from public.interaction_requests where interaction_id='{interaction}'; delete from public.paid_interactions where id='{interaction}';")
    if conversation:
        sql(f"delete from public.conversations where id='{conversation}'")
    sql(f"delete from public.creator_pricing where creator_id='{creator}'; delete from public.creator_stripe_accounts where creator_id='{creator}'; delete from public.creator_profiles where id='{creator}'; delete from auth.users where id in ('{fan}','{owner}');")
