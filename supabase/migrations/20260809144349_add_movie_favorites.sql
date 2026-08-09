alter table public.movie_metrics
  add column if not exists is_favorite boolean not null default false;

comment on column public.movie_metrics.is_favorite is
  'Marks a movie as a library-wide favorite in Project1337.';
