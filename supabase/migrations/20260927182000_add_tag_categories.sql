alter table public.tags
  add column if not exists category text;

alter table public.tags
  drop constraint if exists tags_category_check;

alter table public.tags
  add constraint tags_category_check
  check (category is null or category in ('haircolor', 'place', 'finish'));

comment on column public.tags.category is
  'Optional tag category. Categorized tags are prioritized in the order haircolor, place, finish.';
