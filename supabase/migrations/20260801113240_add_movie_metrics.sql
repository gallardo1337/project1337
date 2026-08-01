create table if not exists public.movie_metrics (
  movie_id uuid primary key references public.movies(id) on delete cascade,
  rating smallint null,
  view_count bigint not null default 0,
  updated_at timestamptz not null default now(),
  constraint movie_metrics_rating_check
    check (rating is null or rating between 1 and 10),
  constraint movie_metrics_view_count_check
    check (view_count >= 0)
);

comment on table public.movie_metrics is
  'Private ratings and playback counters for the Project1337 movie library.';

alter table public.movie_metrics enable row level security;

revoke all on table public.movie_metrics from public, anon, authenticated;
grant select, insert, update on table public.movie_metrics to service_role;

insert into public.movie_metrics (movie_id)
select id
from public.movies
on conflict (movie_id) do nothing;

create or replace function public.increment_movie_view(p_movie_id uuid)
returns bigint
language sql
security invoker
set search_path = ''
as $$
  insert into public.movie_metrics as metrics (movie_id, view_count, updated_at)
  values (p_movie_id, 1, now())
  on conflict (movie_id) do update
  set
    view_count = metrics.view_count + 1,
    updated_at = now()
  returning metrics.view_count;
$$;

revoke all on function public.increment_movie_view(uuid) from public, anon, authenticated;
grant execute on function public.increment_movie_view(uuid) to service_role;
