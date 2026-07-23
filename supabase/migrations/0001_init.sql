-- Fuel Tracker: vessel fuel + location stock schema
-- Run this in the Supabase SQL editor (or via `supabase db push`) on a fresh project.

-- ============================================================================
-- Core tables
-- ============================================================================

create table vessels (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table locations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  notes text not null default '',
  created_at timestamptz not null default now()
);

-- Fuel arriving at a location (increases that location's stock).
create table deliveries (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  quantity numeric not null check (quantity > 0),
  delivered_at date not null default current_date,
  notes text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Fuel dispensed from a location into a vessel (decreases location stock,
-- and is the vessel's usage/consumption record).
create table fuel_entries (
  id uuid primary key default gen_random_uuid(),
  vessel_id uuid not null references vessels(id) on delete cascade,
  location_id uuid not null references locations(id) on delete cascade,
  quantity numeric not null check (quantity > 0),
  filled_at date not null default current_date,
  notes text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index deliveries_location_idx on deliveries(location_id);
create index deliveries_delivered_at_idx on deliveries(delivered_at);
create index fuel_entries_vessel_idx on fuel_entries(vessel_id);
create index fuel_entries_location_idx on fuel_entries(location_id);
create index fuel_entries_filled_at_idx on fuel_entries(filled_at);

-- ============================================================================
-- Stock views
-- ============================================================================

create view location_stock
with (security_invoker = true) as
select
  l.id as location_id,
  l.name,
  coalesce(d.total_delivered, 0) as total_delivered,
  coalesce(f.total_dispensed, 0) as total_dispensed,
  coalesce(d.total_delivered, 0) - coalesce(f.total_dispensed, 0) as current_stock
from locations l
left join (
  select location_id, sum(quantity) as total_delivered
  from deliveries
  group by location_id
) d on d.location_id = l.id
left join (
  select location_id, sum(quantity) as total_dispensed
  from fuel_entries
  group by location_id
) f on f.location_id = l.id;

create view vessel_usage
with (security_invoker = true) as
select
  v.id as vessel_id,
  v.name,
  coalesce(sum(fe.quantity), 0) as total_used,
  count(fe.id) as fill_count
from vessels v
left join fuel_entries fe on fe.vessel_id = v.id
group by v.id, v.name;

-- ============================================================================
-- Row Level Security
-- Any authenticated (invited) user is treated as a team member with full
-- read/write access to shared operational data.
-- ============================================================================

alter table vessels enable row level security;
alter table locations enable row level security;
alter table deliveries enable row level security;
alter table fuel_entries enable row level security;

create policy vessels_all on vessels for all
using (auth.uid() is not null)
with check (auth.uid() is not null);

create policy locations_all on locations for all
using (auth.uid() is not null)
with check (auth.uid() is not null);

create policy deliveries_all on deliveries for all
using (auth.uid() is not null)
with check (auth.uid() is not null);

create policy fuel_entries_all on fuel_entries for all
using (auth.uid() is not null)
with check (auth.uid() is not null);
