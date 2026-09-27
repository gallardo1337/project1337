alter table public.actors
  add column if not exists planet_suzy_update_favorite boolean not null default false;

drop function if exists public.claim_planet_suzy_update_actor();

create function public.claim_planet_suzy_update_actor()
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

  if v_last_started_at is not null and v_last_started_at > now() - interval '2 minutes' then
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
       or (
         coalesce(actor.planet_suzy_update_favorite, false)
         and state.checked_at <= now() - interval '60 minutes'
       )
       or (
         not coalesce(actor.planet_suzy_update_favorite, false)
         and state.checked_at <= now() - interval '24 hours'
       )
     )
   order by actor.planet_suzy_update_favorite desc, state.checked_at asc nulls first, actor.id
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
