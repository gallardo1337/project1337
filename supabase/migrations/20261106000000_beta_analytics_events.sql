-- Isolated beta-only telemetry. The live site does not send events here.
create table if not exists public.beta_analytics_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  platform text not null check (platform in ('web', 'tvos')),
  event_type text not null check (event_type in ('page_view', 'movie_play')),
  visitor_id uuid not null,
  path text,
  country text check (country is null or country ~ '^[A-Z]{2}$')
);

create index if not exists beta_analytics_events_created_at_idx
  on public.beta_analytics_events (created_at desc);

alter table public.beta_analytics_events enable row level security;
revoke all on public.beta_analytics_events from anon, authenticated;
-- Only the server-side service key may read/write the telemetry table.
