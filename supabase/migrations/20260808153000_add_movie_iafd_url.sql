alter table public.movies
add column if not exists iafd_url text;

comment on column public.movies.iafd_url is
  'Canonical IAFD title URL used as the metadata source for this movie.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'movies_iafd_url_check'
      and conrelid = 'public.movies'::regclass
  ) then
    alter table public.movies
    add constraint movies_iafd_url_check
    check (
      iafd_url is null
      or iafd_url ~ '^https://www\.iafd\.com/title\.rme(?:/|$)'
    );
  end if;
end $$;
