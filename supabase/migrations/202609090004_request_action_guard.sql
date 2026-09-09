-- Reject NULL actions before request transitions. No financial mutations.
begin;
create or replace function public.respond_to_request(request_id uuid, action text) returns void language plpgsql security definer set search_path='' as $$
declare r public.interaction_requests; owner uuid;
begin
 if action is null or action not in ('accept','decline','complete') then raise exception 'Invalid action'; end if;
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
commit;
