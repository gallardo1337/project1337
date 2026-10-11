create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create table if not exists public.planet_suzy_update_scheduler (
  singleton boolean primary key default true check (singleton),
  last_started_at timestamptz
);

insert into public.planet_suzy_update_scheduler (singleton)
values (true)
on conflict (singleton) do nothing;

alter table public.planet_suzy_update_scheduler enable row level security;
revoke all on table public.planet_suzy_update_scheduler from anon, authenticated;
grant all on table public.planet_suzy_update_scheduler to service_role;

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

  if v_last_started_at is not null and v_last_started_at > now() - interval '2 minutes' then
    return;
  end if;

  return query
  select actor.id, actor.name::text, actor.planetsuzy_url::text
    from public.actors as actor
    left join public.planet_suzy_update_states as state on state.actor_id = actor.id
   where actor.planetsuzy_url is not null
     and btrim(actor.planetsuzy_url) <> ''
     and (state.checked_at is null or state.checked_at <= now() - interval '60 minutes')
   order by state.checked_at asc nulls first, actor.id
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

select cron.unschedule(jobid)
  from cron.job
 where jobname = 'planet-suzy-background-check';

select cron.schedule(
  'planet-suzy-background-check',
  '*/2 * * * *',
  $$
    select net.http_post(
      url := 'https://tfjwgtpwcpbrmnhfmwyt.supabase.co/functions/v1/planet-suzy-background-check',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmandndHB3Y3Bicm1uaGZtd3l0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxNjg4ODYsImV4cCI6MjA3OTc0NDg4Nn0.NIcwjksxIrWkLO_6_x0GMYcTcoR5dmcoyuOURjlXCHg',
        'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRmandndHB3Y3Bicm1uaGZtd3l0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxNjg4ODYsImV4cCI6MjA3OTc0NDg4Nn0.NIcwjksxIrWkLO_6_x0GMYcTcoR5dmcoyuOURjlXCHg'
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 15000
    );
  $$
);
