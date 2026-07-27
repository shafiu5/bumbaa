-- Manual stock adjustments (corrections, spillage, physical recounts) per location.
-- Positive quantity adds to stock, negative removes from it.
-- Run this after 0002_low_stock.sql.

create table adjustments (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references locations(id) on delete cascade,
  quantity numeric not null check (quantity <> 0),
  adjusted_at date not null default current_date,
  notes text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index adjustments_location_idx on adjustments(location_id);
create index adjustments_adjusted_at_idx on adjustments(adjusted_at);

alter table adjustments enable row level security;

create policy adjustments_all on adjustments for all
using (auth.uid() is not null)
with check (auth.uid() is not null);

drop view if exists location_stock;

create view location_stock
with (security_invoker = true) as
select
  l.id as location_id,
  l.name,
  l.low_stock_threshold,
  coalesce(d.total_delivered, 0) as total_delivered,
  coalesce(f.total_dispensed, 0) as total_dispensed,
  coalesce(a.total_adjusted, 0) as total_adjusted,
  coalesce(d.total_delivered, 0) - coalesce(f.total_dispensed, 0) + coalesce(a.total_adjusted, 0) as current_stock
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
) f on f.location_id = l.id
left join (
  select location_id, sum(quantity) as total_adjusted
  from adjustments
  group by location_id
) a on a.location_id = l.id;
