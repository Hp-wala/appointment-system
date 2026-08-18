-- Supabase schema for MLA Appointment Management system
-- Run this in Supabase SQL Editor before first deployment.

-- appointments table stores citizen requests and admin status updates.
create table if not exists public.appointments (
  id bigint generated always as identity primary key,
  token_number text not null unique,
  name text not null,
  mobile text not null,
  email text,
  purpose text not null,
  preferred_date date,
  preferred_time text,
  status text not null default 'pending',
  confirmed_date date,
  confirmed_time text,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
); 

create index if not exists idx_appointments_mobile on public.appointments (mobile);
create index if not exists idx_appointments_status on public.appointments (status);
create index if not exists idx_appointments_created_at on public.appointments (created_at desc);
create index if not exists idx_appointments_confirmed_date on public.appointments (confirmed_date);

-- Automatically update the updated_at timestamp on row changes.
drop trigger if exists appointments_set_updated_at on public.appointments;
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger appointments_set_updated_at
  before update on public.appointments
  for each row
  execute function public.set_updated_at();

-- Generate human-friendly token_number if not provided.
drop trigger if exists appointments_generate_token on public.appointments;
create or replace function public.generate_appointment_token()
returns trigger as $$
begin
  if new.token_number is null then
    new.token_number := 'MLA-' || lpad((new.id::text), 6, '0');
  end if;
  return new;
end;
$$ language plpgsql;

create trigger appointments_generate_token
  before insert on public.appointments
  for each row
  execute function public.generate_appointment_token();

-- security_logs table stores admin login and audit events.
create table if not exists public.security_logs (
  id bigint generated always as identity primary key,
  event_type text not null,
  ip_address text,
  latitude numeric,
  longitude numeric,
  city text,
  region text,
  country text,
  user_agent text,
  request_path text,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_security_logs_event_type on public.security_logs (event_type);
create index if not exists idx_security_logs_created_at on public.security_logs (created_at desc);

-- Enable RLS on both tables
alter table public.appointments enable row level security;
alter table public.security_logs enable row level security;

-- Allow anyone to INSERT an appointment (public citizen form)
drop policy if exists "Public can submit appointments" on public.appointments;
create policy "Public can submit appointments"
  on public.appointments for insert
  with check (true);

-- Allow anyone to SELECT their own appointments (status check by mobile)
drop policy if exists "Public can read appointments" on public.appointments;
create policy "Public can read appointments"
  on public.appointments for select
  using (true);

-- Only service_role can UPDATE / DELETE appointments (admin actions)
-- service_role bypasses RLS so no explicit policy needed for admin operations.

