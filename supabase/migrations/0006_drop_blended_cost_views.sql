-- Fuel cost is now computed client-side with FIFO batch allocation (see
-- src/lib/fifoCost.ts) instead of a single blended average per location.
-- The blended-average views from 0004 are no longer read by the app and are
-- actively misleading if queried directly, so drop them.
-- Run after 0005_restrict_to_owner.sql.

drop view if exists fuel_entry_cost;
drop view if exists location_avg_cost;
