-- Adds an optional purchase cost to deliveries and exposes a blended
-- (all-time) average cost per litre per location, plus a per-vessel
-- fuel cost view derived from it.
-- Run this after 0003_adjustments.sql.

alter table deliveries add column total_cost numeric check (total_cost is null or total_cost >= 0);

-- Blended average cost/litre per location, computed only from deliveries
-- that have a cost recorded. Deliveries without a cost are ignored rather
-- than treated as free fuel.
create view location_avg_cost
with (security_invoker = true) as
select
  location_id,
  sum(total_cost) / nullif(sum(quantity), 0) as avg_cost_per_unit
from deliveries
where total_cost is not null
group by location_id;

-- Every fuel_entries row priced at its location's blended average cost.
-- unit_cost/cost are null when the location has no costed deliveries yet.
create view fuel_entry_cost
with (security_invoker = true) as
select
  fe.id,
  fe.vessel_id,
  fe.location_id,
  fe.filled_at,
  fe.quantity,
  lac.avg_cost_per_unit as unit_cost,
  fe.quantity * lac.avg_cost_per_unit as cost,
  fe.notes
from fuel_entries fe
left join location_avg_cost lac on lac.location_id = fe.location_id;
