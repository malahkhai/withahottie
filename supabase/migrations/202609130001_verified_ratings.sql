-- Ratings are created through a trusted server route after a captured reply.
-- Public consumers can read only the aggregate, never the raw author record.
create or replace function public.submit_interaction_rating(
  rater uuid,
  interaction uuid,
  rating_score smallint,
  rating_review text default null
) returns public.ratings
language plpgsql security definer set search_path = '' as $$
declare
  paid public.paid_interactions;
  result public.ratings;
  clean_review text := nullif(trim(rating_review), '');
begin
  if rater is null or rating_score not between 1 and 5 or
     (clean_review is not null and char_length(clean_review) > 1000) then
    raise exception 'Invalid rating';
  end if;

  select * into paid
  from public.paid_interactions
  where id = interaction
  for update;

  if not found or paid.fan_id <> rater or paid.status not in ('captured', 'completed') then
    raise exception 'Only the fan can rate a completed paid interaction';
  end if;

  insert into public.ratings(interaction_id, author_id, creator_id, score, review, published)
  values(paid.id, rater, paid.creator_id, rating_score, clean_review, true)
  on conflict(interaction_id) do update set
    score = excluded.score,
    review = excluded.review,
    published = true,
    updated_at = now()
  where ratings.author_id = excluded.author_id
  returning * into result;

  if result.id is null then raise exception 'Rating owner mismatch'; end if;
  return result;
end $$;

create or replace function public.creator_rating_summary(creator uuid)
returns table(average_score numeric, rating_count bigint)
language sql stable security definer set search_path = '' as $$
  select round(avg(r.score)::numeric, 1), count(*)
  from public.ratings r
  where r.creator_id = creator and r.published;
$$;

revoke all on function public.submit_interaction_rating(uuid, uuid, smallint, text) from public, anon, authenticated;
grant execute on function public.submit_interaction_rating(uuid, uuid, smallint, text) to service_role;
revoke all on function public.creator_rating_summary(uuid) from public;
grant execute on function public.creator_rating_summary(uuid) to anon, authenticated, service_role;

