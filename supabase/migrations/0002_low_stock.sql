-- Adds a per-location low-stock threshold and exposes it through location_stock.
-- Run this after 0001_init.sql.

alter table locations add column low_stock_threshold numeric check (low_stock_threshold is null or low_stock_threshold >= 0);

drop view if exists location_stock;

create view location_stock
with (security_invoker = true) as
select
  l.id as location_id,
  l.name,
  l.low_stock_threshold,
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
