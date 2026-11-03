alter table public.movies
  add column if not exists ai_optimized boolean not null default false;
