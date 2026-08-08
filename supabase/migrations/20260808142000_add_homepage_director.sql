create table if not exists public.homepage_settings (
  id smallint primary key default 1,
  sections jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint homepage_settings_singleton_check check (id = 1),
  constraint homepage_settings_sections_array_check
    check (jsonb_typeof(sections) = 'array')
);

comment on table public.homepage_settings is
  'Singleton configuration for the ordered Project1337 v2 homepage sections.';

alter table public.homepage_settings enable row level security;

revoke all on table public.homepage_settings
  from public, anon, authenticated;
grant select, insert, update on table public.homepage_settings
  to service_role;

insert into public.homepage_settings (id, sections)
values (
  1,
  '[
    {
      "id": "cinema-showcase",
      "type": "showcase",
      "enabled": true,
      "title": "Cinema Showcase",
      "eyebrow": "Aus dem Archiv",
      "itemLimit": 5,
      "config": {}
    },
    {
      "id": "new-in-archive",
      "type": "recent",
      "enabled": true,
      "title": "Neu im Archiv",
      "eyebrow": "Just added",
      "itemLimit": 9,
      "config": {}
    },
    {
      "id": "collection-talents",
      "type": "actors",
      "enabled": true,
      "title": "Talents der Collection",
      "eyebrow": "The faces",
      "itemLimit": 7,
      "config": {}
    },
    {
      "id": "archive-manifesto",
      "type": "manifesto",
      "enabled": true,
      "title": "Not streaming.",
      "eyebrow": "Collecting.",
      "itemLimit": 1,
      "config": {}
    }
  ]'::jsonb
)
on conflict (id) do nothing;
