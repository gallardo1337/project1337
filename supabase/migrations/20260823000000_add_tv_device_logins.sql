create table if not exists public.tv_device_logins (
  id uuid primary key default gen_random_uuid(),
  device_token_hash text not null unique,
  user_code_hash text not null unique,
  device_name text not null default 'Apple TV',
  request_ip_hash text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  approved_at timestamptz null,
  consumed_at timestamptz null,
  constraint tv_device_logins_status_check
    check (status in ('pending', 'approved')),
  constraint tv_device_logins_expiry_check
    check (expires_at > created_at),
  constraint tv_device_logins_approval_check
    check (
      (status = 'pending' and approved_at is null)
      or (status = 'approved' and approved_at is not null)
    )
);

comment on table public.tv_device_logins is
  'Short-lived, one-time approval requests for Project1337 Apple TV login.';

create index if not exists tv_device_logins_expires_at_idx
  on public.tv_device_logins (expires_at);

create index if not exists tv_device_logins_ip_created_at_idx
  on public.tv_device_logins (request_ip_hash, created_at desc);

alter table public.tv_device_logins enable row level security;

revoke all on table public.tv_device_logins
  from public, anon, authenticated;
grant select, insert, update, delete on table public.tv_device_logins
  to service_role;
