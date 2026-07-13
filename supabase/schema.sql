-- ============================================================
-- FleetWash OS — Production schema v1.0 (Supabase / Postgres)
-- Run this whole file in the Supabase SQL Editor on a fresh project.
-- ============================================================

-- ---------- Core tenancy ----------
create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  role text not null default 'worker' check (role in ('owner','worker')),
  initials text not null,
  display_name text not null default '',
  hourly_cents int not null default 2000,
  availability jsonb not null default '{"days":[1,1,1,1,1,1,1],"from":"06:00","to":"21:00"}',
  created_at timestamptz default now()
);

create table invites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  role text not null default 'worker',
  initials text,
  display_name text,
  created_by uuid references auth.users(id),
  expires_at timestamptz not null default now() + interval '7 days',
  redeemed_by uuid references auth.users(id),
  redeemed_at timestamptz
);

create table company_settings (
  company_id uuid primary key references companies(id) on delete cascade,
  trucks jsonb not null default '[{"id":"blue","name":"Blue Truck","color":"#2E86AB"},{"id":"black","name":"Black Truck","color":"#1B1F26"},{"id":"grey","name":"Grey Truck","color":"#98A2B3"},{"id":"own","name":"Drive Yourself","color":"#8B5CD6"}]',
  chem_catalog jsonb not null default '["Truck wash soap","CTC (aluminum brightener)","Degreaser","Spray wax","Glass cleaner","Long-reach brush","Ladder","PPE (gloves / respirator)","Polish-safe chem","Surefire degreaser","Salt","Water reclaim setup"]',
  baseline_loadout jsonb not null default '["Brush","Bug soaker"]',
  ot_threshold_hours numeric not null default 40,
  ot_multiplier numeric not null default 1.5
);

-- ---------- Pricing (asset types + base rates + overrides) ----------
create table asset_types (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  sort int not null default 0,
  unique (company_id, name)
);

create table rate_matrix (
  company_id uuid not null references companies(id) on delete cascade,
  asset_type_id uuid not null references asset_types(id) on delete cascade,
  rate_cents int not null default 0 check (rate_cents >= 0),
  primary key (company_id, asset_type_id)
);

-- ---------- Clients & fleet ----------
create table clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  contact text default '', phone text default '', address text default '',
  terms text default 'Net 30',
  arrival text default '', frequency text default '', fleet_notes text default '',
  specialty text default '', complaints text default '',
  wash_time text default '', washers text default '',
  chems jsonb not null default '[]',
  requires_training boolean not null default false,
  trained_user_ids uuid[] not null default '{}',
  kind text not null default 'client' check (kind in ('client','refill')),
  created_at timestamptz default now()
);

create table client_rate_overrides (
  company_id uuid not null references companies(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  asset_type_id uuid not null references asset_types(id) on delete cascade,
  rate_cents int not null check (rate_cents >= 0),
  primary key (client_id, asset_type_id)
);

create table units (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  number text not null,
  asset_type_id uuid references asset_types(id) on delete set null,
  unique (client_id, number)
);

create or replace function my_company() returns uuid language sql stable security definer as
  $$ select company_id from profiles where user_id = auth.uid() $$;
create or replace function my_role() returns text language sql stable security definer as
  $$ select role from profiles where user_id = auth.uid() $$;
create or replace function resolve_rate(p_client uuid, p_asset_type uuid) returns int language sql stable as $$
  select coalesce(
    (select o.rate_cents from client_rate_overrides o where o.client_id = p_client and o.asset_type_id = p_asset_type),
    (select r.rate_cents from rate_matrix r join clients c on c.company_id = r.company_id
      where c.id = p_client and r.asset_type_id = p_asset_type),
    0);
$$;

-- ---------- Jobs & field activity ----------
create table jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  starts_at timestamptz not null,
  duration_min int,
  truck_id text not null default 'blue',
  worker_ids uuid[] not null default '{}',
  unit_ids uuid[] not null default '{}',
  status text not null default 'scheduled' check (status in ('scheduled','enroute','washing','done','invoiced')),
  series_id uuid,
  recurrence_days int,
  created_at timestamptz default now()
);
create index jobs_company_day on jobs (company_id, starts_at);

create table unit_checkoffs (
  job_id uuid not null references jobs(id) on delete cascade,
  unit_id uuid not null references units(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  checked_by uuid not null references auth.users(id),
  checked_at timestamptz not null default now(),
  primary key (job_id, unit_id)
);

create table unit_flags (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  unit_id uuid not null references units(id) on delete cascade,
  kind text not null check (kind in ('damage','road_out')),
  note text default '',
  created_by uuid not null references auth.users(id),
  created_at timestamptz default now()
);

create table wash_photos (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  unit_id uuid references units(id) on delete set null,
  storage_path text not null,   -- Supabase Storage bucket "wash-photos"
  taken_by uuid not null references auth.users(id),
  taken_at timestamptz default now()
);

create table timesheet (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  clock_in timestamptz not null,
  clock_out timestamptz,
  gps_in text default '', gps_out text default ''
);
create index timesheet_open on timesheet (user_id) where clock_out is null;

create table positions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  lat double precision not null, lng double precision not null,
  updated_at timestamptz not null default now()
);

create table notes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  category text not null default 'Gate/Access',
  body text not null,
  author_id uuid not null references auth.users(id),
  created_at timestamptz default now()
);

create table complaints (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  job_id uuid references jobs(id) on delete set null,
  body text not null,
  resolved boolean not null default false,
  created_at timestamptz default now()
);

create table timeoff (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  start_date date not null, end_date date not null,
  label text default 'Time off'
);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  number text not null,
  status text not null default 'draft' check (status in ('draft','sent','paid')),
  lines jsonb not null default '[]',   -- [{desc, qty, rate_cents}]
  job_ids uuid[] not null default '{}',
  created_at timestamptz default now()
);

-- ---------- Invite redemption (security definer: user has no profile yet) ----------
create or replace function redeem_invite(p_invite uuid) returns void
language plpgsql security definer as $$
declare inv invites;
begin
  select * into inv from invites
    where id = p_invite and redeemed_by is null and expires_at > now();
  if inv.id is null then raise exception 'Invite invalid or expired'; end if;
  insert into profiles (user_id, company_id, role, initials, display_name)
    values (auth.uid(), inv.company_id, inv.role,
            coalesce(inv.initials, upper(left(coalesce(auth.jwt()->>'email','XX'),2))),
            coalesce(inv.display_name, ''));
  update invites set redeemed_by = auth.uid(), redeemed_at = now() where id = inv.id;
end $$;

-- Bootstrap: first user creates their own company + owner profile
create or replace function create_company(p_name text, p_initials text, p_display text) returns uuid
language plpgsql security definer as $$
declare cid uuid;
begin
  if exists (select 1 from profiles where user_id = auth.uid()) then
    raise exception 'Already in a company';
  end if;
  insert into companies (name) values (p_name) returning id into cid;
  insert into company_settings (company_id) values (cid);
  insert into profiles (user_id, company_id, role, initials, display_name)
    values (auth.uid(), cid, 'owner', p_initials, p_display);
  return cid;
end $$;

-- ---------- RLS ----------
do $$
declare t text;
begin
  foreach t in array array['companies','profiles','company_settings','asset_types','rate_matrix',
    'clients','client_rate_overrides','units','jobs','unit_checkoffs','unit_flags','wash_photos',
    'timesheet','positions','notes','complaints','timeoff','invoices','invites'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- everyone in the company can read company data
create policy r on companies for select using (id = my_company());
create policy r on profiles for select using (company_id = my_company());
create policy r on company_settings for select using (company_id = my_company());
create policy r on asset_types for select using (company_id = my_company());
create policy r on rate_matrix for select using (company_id = my_company());
create policy r on clients for select using (company_id = my_company());
create policy r on client_rate_overrides for select using (company_id = my_company());
create policy r on units for select using (company_id = my_company());
create policy r on jobs for select using (company_id = my_company());
create policy r on unit_checkoffs for select using (company_id = my_company());
create policy r on unit_flags for select using (company_id = my_company());
create policy r on wash_photos for select using (company_id = my_company());
create policy r on timesheet for select using (company_id = my_company());
create policy r on positions for select using (company_id = my_company());
create policy r on notes for select using (company_id = my_company());
create policy r on complaints for select using (company_id = my_company());
create policy r on timeoff for select using (company_id = my_company());
create policy r on invoices for select using (company_id = my_company());
create policy r on invites for select using (company_id = my_company());

-- owner-managed tables
create policy w_ins on clients for insert with check (company_id = my_company() and my_role() = 'owner');
create policy w_upd on clients for update using (company_id = my_company());  -- crew may edit chems; tighten per-column later if needed
create policy w_del on clients for delete using (company_id = my_company() and my_role() = 'owner');
create policy w on company_settings for update using (company_id = my_company() and my_role() = 'owner');
create policy w on asset_types for all using (company_id = my_company() and my_role() = 'owner') with check (company_id = my_company() and my_role() = 'owner');
create policy w on rate_matrix for all using (company_id = my_company() and my_role() = 'owner') with check (company_id = my_company() and my_role() = 'owner');
create policy w on client_rate_overrides for all using (company_id = my_company() and my_role() = 'owner') with check (company_id = my_company() and my_role() = 'owner');
create policy w on units for all using (company_id = my_company()) with check (company_id = my_company());
create policy w on jobs for all using (company_id = my_company()) with check (company_id = my_company());
create policy w on invoices for all using (company_id = my_company() and my_role() = 'owner') with check (company_id = my_company() and my_role() = 'owner');
create policy w on complaints for all using (company_id = my_company()) with check (company_id = my_company());
create policy w on timeoff for all using (company_id = my_company() and my_role() = 'owner') with check (company_id = my_company() and my_role() = 'owner');
create policy w on invites for all using (company_id = my_company() and my_role() = 'owner') with check (company_id = my_company() and my_role() = 'owner');
create policy w_own on profiles for update using (user_id = auth.uid() or (company_id = my_company() and my_role() = 'owner'));

-- attribution-enforced tables: you can only write AS yourself; owner can correct
create policy w_ins on unit_checkoffs for insert with check (company_id = my_company() and checked_by = auth.uid());
create policy w_del on unit_checkoffs for delete using (company_id = my_company() and (checked_by = auth.uid() or my_role() = 'owner'));
create policy w_ins on unit_flags for insert with check (company_id = my_company() and created_by = auth.uid());
create policy w_del on unit_flags for delete using (company_id = my_company() and (created_by = auth.uid() or my_role() = 'owner'));
create policy w_ins on wash_photos for insert with check (company_id = my_company() and taken_by = auth.uid());
create policy w_ins on timesheet for insert with check (company_id = my_company() and user_id = auth.uid());
create policy w_upd on timesheet for update using (company_id = my_company() and (user_id = auth.uid() or my_role() = 'owner'));
create policy w_del on timesheet for delete using (company_id = my_company() and my_role() = 'owner');
create policy w_ups on positions for insert with check (company_id = my_company() and user_id = auth.uid());
create policy w_updp on positions for update using (user_id = auth.uid());
create policy w_ins on notes for insert with check (company_id = my_company() and author_id = auth.uid());
create policy w_upd on notes for update using (company_id = my_company());
create policy w_del on notes for delete using (company_id = my_company());

-- Storage: create a bucket named "wash-photos" (public=false) in the dashboard,
-- with policies allowing authenticated insert/select scoped to the company path.

-- ============================================================
-- v1.1 additions (run as part of initial setup)
-- ============================================================
create table hazard_acks (
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  day date not null,
  acked_at timestamptz default now(),
  primary key (user_id, day)
);
alter table hazard_acks enable row level security;
create policy r on hazard_acks for select using (company_id = my_company());
create policy w_ins on hazard_acks for insert with check (company_id = my_company() and user_id = auth.uid());

-- Storage bucket + policies for wash photos
insert into storage.buckets (id, name, public) values ('wash-photos', 'wash-photos', false)
  on conflict (id) do nothing;
create policy "authed read photos" on storage.objects for select to authenticated
  using (bucket_id = 'wash-photos');
create policy "authed write photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'wash-photos');

-- ============================================================
-- v1.2 — portal role, signatures, intel acks, client-scoped RLS
-- ============================================================
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check check (role in ('owner','worker','client'));
alter table profiles add column if not exists client_id uuid references clients(id) on delete set null;
alter table invites add column if not exists client_id uuid references clients(id) on delete cascade;
alter table invoices add column if not exists approved_at timestamptz;
alter table invoices add column if not exists approved_by uuid references auth.users(id);

create or replace function my_client() returns uuid language sql stable security definer as
  $$ select client_id from profiles where user_id = auth.uid() $$;

-- invite redemption carries the client link
create or replace function redeem_invite(p_invite uuid) returns void
language plpgsql security definer as $$
declare inv invites;
begin
  select * into inv from invites
    where id = p_invite and redeemed_by is null and expires_at > now();
  if inv.id is null then raise exception 'Invite invalid or expired'; end if;
  insert into profiles (user_id, company_id, role, initials, display_name, client_id)
    values (auth.uid(), inv.company_id, inv.role,
            coalesce(inv.initials, upper(left(coalesce(auth.jwt()->>'email','XX'),2))),
            coalesce(inv.display_name, ''), inv.client_id);
  update invites set redeemed_by = auth.uid(), redeemed_at = now() where id = inv.id;
end $$;

create table signatures (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  signer_name text not null default '',
  storage_path text not null,
  captured_by uuid not null references auth.users(id),
  created_at timestamptz default now()
);
alter table signatures enable row level security;
create policy r on signatures for select using (
  company_id = my_company() and (my_role() <> 'client' or exists (select 1 from jobs j where j.id = job_id and j.client_id = my_client()))
);
create policy w_ins on signatures for insert with check (company_id = my_company() and captured_by = auth.uid());

create table intel_acks (
  job_id uuid not null references jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  acked_at timestamptz default now(),
  primary key (job_id, user_id)
);
alter table intel_acks enable row level security;
create policy r on intel_acks for select using (company_id = my_company());
create policy w_ins on intel_acks for insert with check (company_id = my_company() and user_id = auth.uid());

-- Client-scoped reads: fleet-manager logins only see their own client's rows
drop policy r on clients;
create policy r on clients for select using (
  company_id = my_company() and (my_role() <> 'client' or id = my_client())
);
drop policy r on jobs;
create policy r on jobs for select using (
  company_id = my_company() and (my_role() <> 'client' or client_id = my_client())
);
drop policy r on units;
create policy r on units for select using (
  company_id = my_company() and (my_role() <> 'client' or client_id = my_client())
);
drop policy r on invoices;
create policy r on invoices for select using (
  company_id = my_company() and (my_role() <> 'client' or client_id = my_client())
);
drop policy r on unit_checkoffs;
create policy r on unit_checkoffs for select using (
  company_id = my_company() and (my_role() <> 'client' or exists (select 1 from jobs j where j.id = job_id and j.client_id = my_client()))
);
drop policy r on wash_photos;
create policy r on wash_photos for select using (
  company_id = my_company() and (my_role() <> 'client' or exists (select 1 from jobs j where j.id = job_id and j.client_id = my_client()))
);
-- fleet managers approve their invoices (only the approval columns matter; app writes only those)
create policy w_approve on invoices for update using (
  company_id = my_company() and my_role() = 'client' and client_id = my_client()
);
