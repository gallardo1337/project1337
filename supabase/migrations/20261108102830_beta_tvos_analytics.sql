-- Extend only the existing beta telemetry table; shared movie counters remain untouched.
alter table public.beta_analytics_events
  drop constraint beta_analytics_events_event_type_check,
  add constraint beta_analytics_events_event_type_check check
    (event_type in ('page_view','movie_play','app_open','session_start','screen_view','movie_complete')),
  add column event_id uuid,
  add column session_id uuid,
  add column occurred_at timestamptz,
  add column app_version text,
  add column os_version text,
  add column screen_type text,
  add column movie_id uuid,
  add column rate_key text;

create unique index beta_analytics_event_id_unique on public.beta_analytics_events(event_id);
create unique index beta_analytics_session_start_unique
  on public.beta_analytics_events(visitor_id, session_id)
  where platform = 'tvos' and event_type = 'session_start';
create index beta_analytics_rate_idx on public.beta_analytics_events(rate_key, created_at desc)
  where platform = 'tvos';
create index beta_analytics_visitor_rate_idx on public.beta_analytics_events(visitor_id, created_at desc)
  where platform = 'tvos';

-- Service role only, SECURITY INVOKER: no public privileged function and no new table.
-- The random signed-session nonce is hashed before storage; no cookies/tokens/IPs are retained.
create function public.record_beta_tv_event(p_event jsonb, p_auth_session uuid)
returns text language plpgsql security invoker set search_path = '' as $$
declare
  v_key text := encode(sha256(p_auth_session::text::bytea), 'hex');
  v_movie uuid := (p_event->>'movie_id')::uuid;
  v_visitor uuid := (p_event->>'visitor_id')::uuid;
begin
  if p_event->>'platform' is distinct from 'tvos' or p_auth_session is null then
    raise exception 'Invalid platform/session';
  end if;
  -- Serialize the short quota/insert transaction across serverless instances.
  perform pg_advisory_xact_lock(1337, 7112026);
  if exists (select 1 from public.beta_analytics_events where event_id = (p_event->>'event_id')::uuid) then
    return 'duplicate';
  end if;
  if (select count(*) from public.beta_analytics_events where platform = 'tvos'
      and created_at > now() - interval '1 minute' and (rate_key = v_key or visitor_id = v_visitor)) >= 120 then
    return 'rate_limited';
  end if;
  if v_movie is not null and not exists (select 1 from public.movies where id = v_movie) then
    return 'invalid_movie';
  end if;
  insert into public.beta_analytics_events
    (platform,event_type,event_id,visitor_id,session_id,occurred_at,app_version,os_version,screen_type,movie_id,path,country,rate_key)
  values ('tvos',p_event->>'event_type',(p_event->>'event_id')::uuid,v_visitor,
    (p_event->>'session_id')::uuid,(p_event->>'occurred_at')::timestamptz,
    p_event->>'app_version',p_event->>'os_version',p_event->>'screen_type',v_movie,
    p_event->>'path',p_event->>'country',v_key)
  on conflict do nothing;
  return 'ok';
end;
$$;
revoke all on function public.record_beta_tv_event(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.record_beta_tv_event(jsonb, uuid) to service_role;
alter table public.beta_analytics_events enable row level security;
revoke all on public.beta_analytics_events from anon, authenticated;
