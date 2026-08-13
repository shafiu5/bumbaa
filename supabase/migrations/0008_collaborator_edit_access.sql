-- Extends collaborators from read-only to an optional edit tier, matching
-- vessel-finance's 0015_collaborator_edit_access.sql in the same Supabase
-- project. Must be run after that migration, since it reuses
-- my_effective_owner_id() and has_write_access() defined there.

alter table vessels alter column owner_id set default my_effective_owner_id();
drop policy vessels_insert on vessels;
drop policy vessels_update on vessels;
drop policy vessels_delete on vessels;
create policy vessels_insert on vessels for insert with check (has_write_access(owner_id));
create policy vessels_update on vessels for update using (has_write_access(owner_id)) with check (has_write_access(owner_id));
create policy vessels_delete on vessels for delete using (has_write_access(owner_id));

alter table locations alter column owner_id set default my_effective_owner_id();
drop policy locations_insert on locations;
drop policy locations_update on locations;
drop policy locations_delete on locations;
create policy locations_insert on locations for insert with check (has_write_access(owner_id));
create policy locations_update on locations for update using (has_write_access(owner_id)) with check (has_write_access(owner_id));
create policy locations_delete on locations for delete using (has_write_access(owner_id));

alter table deliveries alter column owner_id set default my_effective_owner_id();
drop policy deliveries_insert on deliveries;
drop policy deliveries_update on deliveries;
drop policy deliveries_delete on deliveries;
create policy deliveries_insert on deliveries for insert with check (has_write_access(owner_id));
create policy deliveries_update on deliveries for update using (has_write_access(owner_id)) with check (has_write_access(owner_id));
create policy deliveries_delete on deliveries for delete using (has_write_access(owner_id));

alter table fuel_entries alter column owner_id set default my_effective_owner_id();
drop policy fuel_entries_insert on fuel_entries;
drop policy fuel_entries_update on fuel_entries;
drop policy fuel_entries_delete on fuel_entries;
create policy fuel_entries_insert on fuel_entries for insert with check (has_write_access(owner_id));
create policy fuel_entries_update on fuel_entries for update using (has_write_access(owner_id)) with check (has_write_access(owner_id));
create policy fuel_entries_delete on fuel_entries for delete using (has_write_access(owner_id));

alter table adjustments alter column owner_id set default my_effective_owner_id();
drop policy adjustments_insert on adjustments;
drop policy adjustments_update on adjustments;
drop policy adjustments_delete on adjustments;
create policy adjustments_insert on adjustments for insert with check (has_write_access(owner_id));
create policy adjustments_update on adjustments for update using (has_write_access(owner_id)) with check (has_write_access(owner_id));
create policy adjustments_delete on adjustments for delete using (has_write_access(owner_id));
