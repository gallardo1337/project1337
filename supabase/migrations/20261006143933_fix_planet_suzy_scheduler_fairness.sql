-- One claim per scheduled two-minute slot, independent of invocation jitter.
-- Order by due time rather than absolute favorite priority to prevent starvation.
create or replace function public.claim_planet_suzy_update_actor()
returns table (actor_id uuid, actor_name text, thread_url text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_last_started_at timestamptz;
begin
  select scheduler.last_started_at
    into v_last_started_at
    from public.planet_suzy_update_scheduler as scheduler
   where scheduler.singleton = true
   for update;

  if v_last_started_at is not null
     and floor(extract(epoch from v_last_started_at) / 120)
         >= floor(extract(epoch from now()) / 120) then
    return;
  end if;

  return query
  select actor.id, actor.name::text, actor.planetsuzy_url::text
    from public.actors as actor
    left join public.planet_suzy_update_states as state on state.actor_id = actor.id
   where actor.planetsuzy_url is not null
     and btrim(actor.planetsuzy_url) <> ''
     and (
       state.checked_at is null
       or state.checked_at + case
         when coalesce(actor.planet_suzy_update_favorite, false)
           then interval '60 minutes'
         else interval '24 hours'
       end <= now()
     )
   order by
     state.checked_at + case
       when coalesce(actor.planet_suzy_update_favorite, false)
         then interval '60 minutes'
       else interval '24 hours'
     end asc nulls first,
     actor.planet_suzy_update_favorite desc,
     actor.id
   limit 1;

  if found then
    update public.planet_suzy_update_scheduler
       set last_started_at = now()
     where singleton = true;
  end if;
end;
$$;

revoke all on function public.claim_planet_suzy_update_actor() from public, anon, authenticated;
grant execute on function public.claim_planet_suzy_update_actor() to service_role;
