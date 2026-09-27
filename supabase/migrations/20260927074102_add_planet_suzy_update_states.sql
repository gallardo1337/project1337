create table if not exists public.planet_suzy_update_states (
  actor_id uuid primary key references public.actors(id) on delete cascade,
  max_post_id text,
  read_through_post_id text,
  checked_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now(),
  constraint planet_suzy_update_states_max_post_id_numeric
    check (max_post_id is null or max_post_id ~ '^[0-9]+$'),
  constraint planet_suzy_update_states_read_through_numeric
    check (read_through_post_id is null or read_through_post_id ~ '^[0-9]+$')
);

comment on table public.planet_suzy_update_states is
  'Shared online check status and unread post tracking for PlanetSuzy actor threads.';

alter table public.planet_suzy_update_states enable row level security;
revoke all on table public.planet_suzy_update_states from anon, authenticated;
grant all on table public.planet_suzy_update_states to service_role;
