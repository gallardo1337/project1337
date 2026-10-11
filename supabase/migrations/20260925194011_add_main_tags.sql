alter table public.tags
  add column if not exists is_main boolean not null default false;

comment on column public.tags.is_main is
  'Marks tags that should appear before regular tags in the Project1337 tvOS library.';
