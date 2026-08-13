-- Per-login data isolation, matching vessel-finance's 0014_multi_tenant.sql
-- in the same Supabase project. Must be run AFTER that migration, since it
-- reuses the has_account_access() helper and account_collaborators table
-- defined there rather than redefining them here.

alter table vessels add column owner_id uuid references auth.users(id);
update vessels set owner_id = (select id from auth.users where lower(email) = 'shaafiu13@gmail.com');
alter table vessels alter column owner_id set not null;
alter table vessels alter column owner_id set default auth.uid();

alter table locations add column owner_id uuid references auth.users(id);
update locations set owner_id = (select id from auth.users where lower(email) = 'shaafiu13@gmail.com');
alter table locations alter column owner_id set not null;
alter table locations alter column owner_id set default auth.uid();

alter table deliveries add column owner_id uuid references auth.users(id);
update deliveries set owner_id = (select id from auth.users where lower(email) = 'shaafiu13@gmail.com');
alter table deliveries alter column owner_id set not null;
alter table deliveries alter column owner_id set default auth.uid();

alter table fuel_entries add column owner_id uuid references auth.users(id);
update fuel_entries set owner_id = (select id from auth.users where lower(email) = 'shaafiu13@gmail.com');
alter table fuel_entries alter column owner_id set not null;
alter table fuel_entries alter column owner_id set default auth.uid();

alter table adjustments add column owner_id uuid references auth.users(id);
update adjustments set owner_id = (select id from auth.users where lower(email) = 'shaafiu13@gmail.com');
alter table adjustments alter column owner_id set not null;
alter table adjustments alter column owner_id set default auth.uid();

drop policy vessels_owner_only on vessels;
create policy vessels_select on vessels for select using (has_account_access(owner_id));
create policy vessels_insert on vessels for insert with check (owner_id = auth.uid());
create policy vessels_update on vessels for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy vessels_delete on vessels for delete using (owner_id = auth.uid());

drop policy locations_owner_only on locations;
create policy locations_select on locations for select using (has_account_access(owner_id));
create policy locations_insert on locations for insert with check (owner_id = auth.uid());
create policy locations_update on locations for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy locations_delete on locations for delete using (owner_id = auth.uid());

drop policy deliveries_owner_only on deliveries;
create policy deliveries_select on deliveries for select using (has_account_access(owner_id));
create policy deliveries_insert on deliveries for insert with check (owner_id = auth.uid());
create policy deliveries_update on deliveries for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy deliveries_delete on deliveries for delete using (owner_id = auth.uid());

drop policy fuel_entries_owner_only on fuel_entries;
create policy fuel_entries_select on fuel_entries for select using (has_account_access(owner_id));
create policy fuel_entries_insert on fuel_entries for insert with check (owner_id = auth.uid());
create policy fuel_entries_update on fuel_entries for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy fuel_entries_delete on fuel_entries for delete using (owner_id = auth.uid());

drop policy adjustments_owner_only on adjustments;
create policy adjustments_select on adjustments for select using (has_account_access(owner_id));
create policy adjustments_insert on adjustments for insert with check (owner_id = auth.uid());
create policy adjustments_update on adjustments for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy adjustments_delete on adjustments for delete using (owner_id = auth.uid());
