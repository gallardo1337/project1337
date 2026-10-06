-- Integration regression checks. All temporary scheduler changes are rolled back.
begin;
do $$
declare
  v_selected text;
  v_expected uuid;
  v_claimed uuid;
  v_count integer;
begin
  -- A long-overdue daily actor must beat a recently-due favorite.
  with actors(name, favorite, checked_at) as (
    values
      ('daily', false, now() - interval '3 days'),
      ('favorite', true, now() - interval '65 minutes'),
      ('not_due', true, now() - interval '30 minutes')
  ), due as (
    select *, checked_at + case when favorite then interval '60 minutes'
                              else interval '24 hours' end as due_at
    from actors
  )
  select name into v_selected from due where due_at <= now()
    order by due_at asc nulls first, favorite desc limit 1;
  if v_selected <> 'daily' then raise exception 'Daily actor starved'; end if;

  -- A never-checked actor is first; favorites only break equal due-time ties.
  with actors(name, favorite, due_at) as (
    values ('new', false, null::timestamptz),
           ('favorite', true, now() - interval '1 minute')
  )
  select name into v_selected from actors order by due_at asc nulls first, favorite desc limit 1;
  if v_selected <> 'new' then raise exception 'New actor skipped'; end if;

  with actors(name, favorite, due_at) as (
    values ('daily', false, now()), ('favorite', true, now())
  )
  select name into v_selected from actors order by due_at asc nulls first, favorite desc limit 1;
  if v_selected <> 'favorite' then raise exception 'Favorite tie-break lost'; end if;

  select a.id into v_expected
    from public.actors a
    left join public.planet_suzy_update_states s on s.actor_id = a.id
   where coalesce(btrim(a.planetsuzy_url), '') <> ''
     and (s.checked_at is null or s.checked_at + case
       when coalesce(a.planet_suzy_update_favorite, false) then interval '60 minutes'
       else interval '24 hours' end <= now())
   order by s.checked_at + case
       when coalesce(a.planet_suzy_update_favorite, false) then interval '60 minutes'
       else interval '24 hours' end asc nulls first,
     a.planet_suzy_update_favorite desc, a.id
   limit 1;

  if v_expected is null then raise exception 'No due actor available for integration test'; end if;

  -- Last claim was just before this slot: elapsed time < 120s must not skip it.
  update public.planet_suzy_update_scheduler
     set last_started_at = to_timestamp(floor(extract(epoch from now()) / 120) * 120)
                           - interval '500 milliseconds'
   where singleton = true;
  select actor_id into v_claimed from public.claim_planet_suzy_update_actor();
  if v_claimed is distinct from v_expected then
    raise exception 'New slot did not claim oldest due actor';
  end if;

  select count(*) into v_count from public.claim_planet_suzy_update_actor();
  if v_count <> 0 then raise exception 'Duplicate claim in same slot'; end if;
end;
$$;
rollback;
select 'scheduler regression checks passed (all temporary changes rolled back)' as result;
