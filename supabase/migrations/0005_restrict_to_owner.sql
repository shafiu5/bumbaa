-- Restricts every fuel-tracker table to only these two email addresses,
-- instead of "any authenticated user" — matching the same restriction
-- applied to vessel-finance's tables in the same Supabase project.
-- Run after 0004_delivery_cost.sql.

create or replace function is_owner() returns boolean
language sql stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) in ('shaafiu13@gmail.com', 'shafiu@furaaqu.com')
$$;

drop policy vessels_all on vessels;
drop policy locations_all on locations;
drop policy deliveries_all on deliveries;
drop policy fuel_entries_all on fuel_entries;
drop policy adjustments_all on adjustments;

create policy vessels_owner_only on vessels for all
using (is_owner()) with check (is_owner());

create policy locations_owner_only on locations for all
using (is_owner()) with check (is_owner());

create policy deliveries_owner_only on deliveries for all
using (is_owner()) with check (is_owner());

create policy fuel_entries_owner_only on fuel_entries for all
using (is_owner()) with check (is_owner());

create policy adjustments_owner_only on adjustments for all
using (is_owner()) with check (is_owner());
