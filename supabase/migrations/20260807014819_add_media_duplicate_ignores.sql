create table if not exists public.media_duplicate_ignores (
  movie_id_a uuid not null references public.movies(id) on delete cascade,
  movie_id_b uuid not null references public.movies(id) on delete cascade,
  ignored_at timestamptz not null default now(),
  primary key (movie_id_a, movie_id_b),
  constraint media_duplicate_ignores_canonical_pair_check
    check (movie_id_a < movie_id_b)
);

comment on table public.media_duplicate_ignores is
  'Admin-confirmed movie pairs that the Media Health Center must not flag as duplicates.';

create index if not exists media_duplicate_ignores_movie_id_b_idx
  on public.media_duplicate_ignores (movie_id_b);

alter table public.media_duplicate_ignores enable row level security;

revoke all on table public.media_duplicate_ignores
  from public, anon, authenticated;
grant select, insert, delete on table public.media_duplicate_ignores
  to service_role;
