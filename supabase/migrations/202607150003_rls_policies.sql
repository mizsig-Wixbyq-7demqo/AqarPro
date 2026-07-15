-- Row Level Security policies. Membership authorizes reads; writes also require
-- an allowed application role. Anonymous users receive no table privileges.

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.properties enable row level security;
alter table public.units enable row level security;
alter table public.tenants enable row level security;
alter table public.leases enable row level security;
alter table public.lease_payment_schedules enable row level security;
alter table public.payments enable row level security;
alter table public.expense_categories enable row level security;
alter table public.expenses enable row level security;
alter table public.market_benchmarks enable row level security;
alter table public.property_score_snapshots enable row level security;
alter table public.audit_logs enable row level security;

create policy organizations_select_member
on public.organizations
for select
to authenticated
using (public.is_org_member(id));

create policy organizations_update_owner
on public.organizations
for update
to authenticated
using (public.has_org_role(id, array['owner']::text[]))
with check (public.has_org_role(id, array['owner']::text[]));

create policy organizations_delete_owner
on public.organizations
for delete
to authenticated
using (public.has_org_role(id, array['owner']::text[]));

create policy organization_members_select_authorized
on public.organization_members
for select
to authenticated
using (
  user_id = auth.uid()
  or public.has_org_role(
    organization_id,
    array['owner', 'manager']::text[]
  )
);

create policy organization_members_insert_management
on public.organization_members
for insert
to authenticated
with check (
  public.has_org_role(organization_id, array['owner']::text[])
  or (
    public.has_org_role(organization_id, array['manager']::text[])
    and role <> 'owner'::public.organization_role
  )
);

create policy organization_members_update_management
on public.organization_members
for update
to authenticated
using (
  public.has_org_role(organization_id, array['owner']::text[])
  or (
    public.has_org_role(organization_id, array['manager']::text[])
    and role <> 'owner'::public.organization_role
  )
)
with check (
  public.has_org_role(organization_id, array['owner']::text[])
  or (
    public.has_org_role(organization_id, array['manager']::text[])
    and role <> 'owner'::public.organization_role
  )
);

create policy organization_members_delete_management
on public.organization_members
for delete
to authenticated
using (
  public.has_org_role(organization_id, array['owner']::text[])
  or (
    public.has_org_role(organization_id, array['manager']::text[])
    and role <> 'owner'::public.organization_role
  )
);

create policy properties_select_member
on public.properties
for select
to authenticated
using (public.is_org_member(organization_id));

create policy properties_insert_management
on public.properties
for insert
to authenticated
with check (
  public.has_org_role(
    organization_id,
    array['owner', 'manager']::text[]
  )
);

create policy properties_update_management
on public.properties
for update
to authenticated
using (
  public.has_org_role(
    organization_id,
    array['owner', 'manager']::text[]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array['owner', 'manager']::text[]
  )
);

create policy properties_delete_owner
on public.properties
for delete
to authenticated
using (public.has_org_role(organization_id, array['owner']::text[]));

create policy units_select_member
on public.units
for select
to authenticated
using (public.is_org_member(organization_id));

create policy units_insert_management
on public.units
for insert
to authenticated
with check (
  public.has_org_role(
    organization_id,
    array['owner', 'manager']::text[]
  )
);

create policy units_update_management
on public.units
for update
to authenticated
using (
  public.has_org_role(
    organization_id,
    array['owner', 'manager']::text[]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array['owner', 'manager']::text[]
  )
);

create policy units_delete_owner
on public.units
for delete
to authenticated
using (public.has_org_role(organization_id, array['owner']::text[]));

create policy tenants_select_member
on public.tenants
for select
to authenticated
using (public.is_org_member(organization_id));

create policy tenants_insert_management
on public.tenants
for insert
to authenticated
with check (
  public.has_org_role(
    organization_id,
    array['owner', 'manager']::text[]
  )
);

create policy tenants_update_management
on public.tenants
for update
to authenticated
using (
  public.has_org_role(
    organization_id,
    array['owner', 'manager']::text[]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array['owner', 'manager']::text[]
  )
);

create policy tenants_delete_owner
on public.tenants
for delete
to authenticated
using (public.has_org_role(organization_id, array['owner']::text[]));

create policy leases_select_member
on public.leases
for select
to authenticated
using (public.is_org_member(organization_id));

create policy leases_insert_management
on public.leases
for insert
to authenticated
with check (
  public.has_org_role(
    organization_id,
    array['owner', 'manager']::text[]
  )
);

create policy leases_update_authorized
on public.leases
for update
to authenticated
using (
  public.has_org_role(
    organization_id,
    array['owner', 'manager', 'accountant']::text[]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array['owner', 'manager', 'accountant']::text[]
  )
);

create policy leases_delete_owner
on public.leases
for delete
to authenticated
using (public.has_org_role(organization_id, array['owner']::text[]));

create policy lease_payment_schedules_select_member
on public.lease_payment_schedules
for select
to authenticated
using (public.is_org_member(organization_id));

create policy lease_payment_schedules_insert_management
on public.lease_payment_schedules
for insert
to authenticated
with check (
  public.has_org_role(
    organization_id,
    array['owner', 'manager']::text[]
  )
);

create policy lease_payment_schedules_update_management
on public.lease_payment_schedules
for update
to authenticated
using (
  public.has_org_role(
    organization_id,
    array['owner', 'manager']::text[]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array['owner', 'manager']::text[]
  )
);

create policy lease_payment_schedules_delete_owner
on public.lease_payment_schedules
for delete
to authenticated
using (public.has_org_role(organization_id, array['owner']::text[]));

create policy payments_select_member
on public.payments
for select
to authenticated
using (public.is_org_member(organization_id));

create policy payments_insert_finance
on public.payments
for insert
to authenticated
with check (
  public.has_org_role(
    organization_id,
    array['owner', 'manager', 'accountant']::text[]
  )
  and created_by = auth.uid()
);

create policy payments_update_finance
on public.payments
for update
to authenticated
using (
  public.has_org_role(
    organization_id,
    array['owner', 'manager', 'accountant']::text[]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array['owner', 'manager', 'accountant']::text[]
  )
);

create policy payments_delete_management
on public.payments
for delete
to authenticated
using (
  public.has_org_role(
    organization_id,
    array['owner', 'manager']::text[]
  )
);

create policy expense_categories_select_member
on public.expense_categories
for select
to authenticated
using (public.is_org_member(organization_id));

create policy expense_categories_insert_management
on public.expense_categories
for insert
to authenticated
with check (
  public.has_org_role(
    organization_id,
    array['owner', 'manager']::text[]
  )
);

create policy expense_categories_update_management
on public.expense_categories
for update
to authenticated
using (
  public.has_org_role(
    organization_id,
    array['owner', 'manager']::text[]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array['owner', 'manager']::text[]
  )
);

create policy expense_categories_delete_owner
on public.expense_categories
for delete
to authenticated
using (public.has_org_role(organization_id, array['owner']::text[]));

create policy expenses_select_member
on public.expenses
for select
to authenticated
using (public.is_org_member(organization_id));

create policy expenses_insert_finance
on public.expenses
for insert
to authenticated
with check (
  public.has_org_role(
    organization_id,
    array['owner', 'manager', 'accountant']::text[]
  )
  and created_by = auth.uid()
);

create policy expenses_update_finance
on public.expenses
for update
to authenticated
using (
  public.has_org_role(
    organization_id,
    array['owner', 'manager', 'accountant']::text[]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array['owner', 'manager', 'accountant']::text[]
  )
);

create policy expenses_delete_management
on public.expenses
for delete
to authenticated
using (
  public.has_org_role(
    organization_id,
    array['owner', 'manager']::text[]
  )
);

create policy market_benchmarks_select_member
on public.market_benchmarks
for select
to authenticated
using (public.is_org_member(organization_id));

create policy market_benchmarks_insert_management
on public.market_benchmarks
for insert
to authenticated
with check (
  public.has_org_role(
    organization_id,
    array['owner', 'manager']::text[]
  )
  and created_by = auth.uid()
);

create policy market_benchmarks_update_management
on public.market_benchmarks
for update
to authenticated
using (
  public.has_org_role(
    organization_id,
    array['owner', 'manager']::text[]
  )
)
with check (
  public.has_org_role(
    organization_id,
    array['owner', 'manager']::text[]
  )
);

create policy market_benchmarks_delete_owner
on public.market_benchmarks
for delete
to authenticated
using (public.has_org_role(organization_id, array['owner']::text[]));

create policy property_score_snapshots_select_member
on public.property_score_snapshots
for select
to authenticated
using (public.is_org_member(organization_id));

create policy property_score_snapshots_insert_management
on public.property_score_snapshots
for insert
to authenticated
with check (
  public.has_org_role(
    organization_id,
    array['owner', 'manager']::text[]
  )
);

create policy property_score_snapshots_delete_owner
on public.property_score_snapshots
for delete
to authenticated
using (public.has_org_role(organization_id, array['owner']::text[]));

create policy audit_logs_select_management
on public.audit_logs
for select
to authenticated
using (
  public.has_org_role(
    organization_id,
    array['owner', 'manager']::text[]
  )
);

revoke all on table public.organizations from anon, authenticated;
revoke all on table public.organization_members from anon, authenticated;
revoke all on table public.properties from anon, authenticated;
revoke all on table public.units from anon, authenticated;
revoke all on table public.tenants from anon, authenticated;
revoke all on table public.leases from anon, authenticated;
revoke all on table public.lease_payment_schedules from anon, authenticated;
revoke all on table public.payments from anon, authenticated;
revoke all on table public.expense_categories from anon, authenticated;
revoke all on table public.expenses from anon, authenticated;
revoke all on table public.market_benchmarks from anon, authenticated;
revoke all on table public.property_score_snapshots from anon, authenticated;
revoke all on table public.audit_logs from anon, authenticated;

grant usage on schema public to authenticated;

grant select, update, delete on table public.organizations to authenticated;
grant select, insert, update, delete on table public.organization_members to authenticated;
grant select, insert, update, delete on table public.properties to authenticated;
grant select, insert, update, delete on table public.units to authenticated;
grant select, insert, update, delete on table public.tenants to authenticated;
grant select, insert, update, delete on table public.leases to authenticated;
grant select, insert, update, delete on table public.lease_payment_schedules to authenticated;
grant select, insert, update, delete on table public.payments to authenticated;
grant select, insert, update, delete on table public.expense_categories to authenticated;
grant select, insert, update, delete on table public.expenses to authenticated;
grant select, insert, update, delete on table public.market_benchmarks to authenticated;
grant select, insert, delete on table public.property_score_snapshots to authenticated;
grant select on table public.audit_logs to authenticated;
