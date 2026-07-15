-- Reusable authorization helpers, safe organization bootstrap, immutable tenant
-- identity, role-aware column enforcement, timestamps, and financial auditing.

create or replace function public.is_org_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members as member
    where member.organization_id = target_organization_id
      and member.user_id = auth.uid()
  );
$$;

create or replace function public.has_org_role(
  target_organization_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members as member
    where member.organization_id = target_organization_id
      and member.user_id = auth.uid()
      and member.role::text = any(allowed_roles)
  );
$$;

revoke all on function public.is_org_member(uuid) from public;
revoke all on function public.has_org_role(uuid, text[]) from public;
grant execute on function public.is_org_member(uuid) to authenticated;
grant execute on function public.has_org_role(uuid, text[]) to authenticated;

create or replace function public.create_organization(organization_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_name text := btrim(organization_name);
  new_organization_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication is required'
      using errcode = '42501';
  end if;

  if normalized_name is null or normalized_name = '' then
    raise exception 'Organization name is required'
      using errcode = '22023';
  end if;

  insert into public.organizations (name, created_by)
  values (normalized_name, current_user_id)
  returning id into new_organization_id;

  insert into public.organization_members (
    organization_id,
    user_id,
    role
  ) values (
    new_organization_id,
    current_user_id,
    'owner'::public.organization_role
  );

  return new_organization_id;
end;
$$;

revoke all on function public.create_organization(text) from public;
revoke all on function public.create_organization(text) from anon;
grant execute on function public.create_organization(text) to authenticated;

create or replace function public.delete_organization(target_organization_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.has_org_role(
    target_organization_id,
    array['owner']::text[]
  ) then
    raise exception 'Only an organization owner may delete the organization'
      using errcode = '42501';
  end if;

  -- Delete leaf records in a deterministic order so restrictive business
  -- foreign keys stay protective during ordinary row deletion.
  delete from public.payments
  where organization_id = target_organization_id;

  delete from public.expenses
  where organization_id = target_organization_id;

  delete from public.lease_payment_schedules
  where organization_id = target_organization_id;

  delete from public.property_score_snapshots
  where organization_id = target_organization_id;

  delete from public.leases
  where organization_id = target_organization_id;

  delete from public.units
  where organization_id = target_organization_id;

  delete from public.tenants
  where organization_id = target_organization_id;

  delete from public.expense_categories
  where organization_id = target_organization_id;

  delete from public.market_benchmarks
  where organization_id = target_organization_id;

  delete from public.properties
  where organization_id = target_organization_id;

  delete from public.audit_logs
  where organization_id = target_organization_id;

  delete from public.organizations
  where id = target_organization_id;

  if not found then
    raise exception 'Organization not found'
      using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.delete_organization(uuid) from public;
revoke all on function public.delete_organization(uuid) from anon;
grant execute on function public.delete_organization(uuid) to authenticated;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public;

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

create trigger organization_members_set_updated_at
before update on public.organization_members
for each row execute function public.set_updated_at();

create trigger properties_set_updated_at
before update on public.properties
for each row execute function public.set_updated_at();

create trigger units_set_updated_at
before update on public.units
for each row execute function public.set_updated_at();

create or replace function public.sync_property_total_units()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    update public.properties as property
    set total_units = (
      select count(*)::integer
      from public.units as unit
      where unit.organization_id = old.organization_id
        and unit.property_id = old.property_id
        and unit.deleted_at is null
    )
    where property.organization_id = old.organization_id
      and property.id = old.property_id;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    update public.properties as property
    set total_units = (
      select count(*)::integer
      from public.units as unit
      where unit.organization_id = new.organization_id
        and unit.property_id = new.property_id
        and unit.deleted_at is null
    )
    where property.organization_id = new.organization_id
      and property.id = new.property_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.sync_property_total_units() from public;

create trigger units_sync_total_after_insert_or_delete
after insert or delete on public.units
for each row execute function public.sync_property_total_units();

create trigger units_sync_total_after_reassignment
after update of property_id, deleted_at on public.units
for each row execute function public.sync_property_total_units();

create trigger tenants_set_updated_at
before update on public.tenants
for each row execute function public.set_updated_at();

create trigger leases_set_updated_at
before update on public.leases
for each row execute function public.set_updated_at();

create trigger lease_payment_schedules_set_updated_at
before update on public.lease_payment_schedules
for each row execute function public.set_updated_at();

create trigger payments_set_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

create trigger expense_categories_set_updated_at
before update on public.expense_categories
for each row execute function public.set_updated_at();

create trigger expenses_set_updated_at
before update on public.expenses
for each row execute function public.set_updated_at();

create trigger market_benchmarks_set_updated_at
before update on public.market_benchmarks
for each row execute function public.set_updated_at();

create or replace function public.prevent_organization_id_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.organization_id is distinct from old.organization_id then
    raise exception 'organization_id cannot be changed directly'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_organization_id_change() from public;

create trigger organization_members_prevent_org_change
before update on public.organization_members
for each row execute function public.prevent_organization_id_change();

create trigger properties_prevent_org_change
before update on public.properties
for each row execute function public.prevent_organization_id_change();

create trigger units_prevent_org_change
before update on public.units
for each row execute function public.prevent_organization_id_change();

create trigger tenants_prevent_org_change
before update on public.tenants
for each row execute function public.prevent_organization_id_change();

create trigger leases_prevent_org_change
before update on public.leases
for each row execute function public.prevent_organization_id_change();

create trigger lease_payment_schedules_prevent_org_change
before update on public.lease_payment_schedules
for each row execute function public.prevent_organization_id_change();

create trigger payments_prevent_org_change
before update on public.payments
for each row execute function public.prevent_organization_id_change();

create trigger expense_categories_prevent_org_change
before update on public.expense_categories
for each row execute function public.prevent_organization_id_change();

create trigger expenses_prevent_org_change
before update on public.expenses
for each row execute function public.prevent_organization_id_change();

create trigger market_benchmarks_prevent_org_change
before update on public.market_benchmarks
for each row execute function public.prevent_organization_id_change();

create trigger property_score_snapshots_prevent_org_change
before update on public.property_score_snapshots
for each row execute function public.prevent_organization_id_change();

create trigger audit_logs_prevent_org_change
before update on public.audit_logs
for each row execute function public.prevent_organization_id_change();

create or replace function public.prevent_created_by_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'created_by cannot be changed'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_created_by_change() from public;

create trigger organizations_prevent_creator_change
before update on public.organizations
for each row execute function public.prevent_created_by_change();

create trigger payments_prevent_creator_change
before update on public.payments
for each row execute function public.prevent_created_by_change();

create trigger expenses_prevent_creator_change
before update on public.expenses
for each row execute function public.prevent_created_by_change();

create trigger market_benchmarks_prevent_creator_change
before update on public.market_benchmarks
for each row execute function public.prevent_created_by_change();

create or replace function public.protect_primary_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  primary_owner_id uuid;
begin
  select organization.created_by
  into primary_owner_id
  from public.organizations as organization
  where organization.id = old.organization_id;

  -- During an organization cascade delete, the parent is already absent and the
  -- membership delete is allowed. Direct primary-owner mutation is blocked.
  if primary_owner_id is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if old.user_id = primary_owner_id then
    if tg_op = 'DELETE' then
      raise exception 'The primary owner membership cannot be removed directly'
        using errcode = '42501';
    end if;

    if new.user_id is distinct from old.user_id
      or new.organization_id is distinct from old.organization_id
      or new.role is distinct from 'owner'::public.organization_role then
      raise exception 'The primary owner cannot be changed directly'
        using errcode = '42501';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.protect_primary_owner_membership() from public;

create trigger organization_members_protect_primary_owner
before update or delete on public.organization_members
for each row execute function public.protect_primary_owner_membership();

create or replace function public.enforce_accountant_lease_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  old_protected jsonb;
  new_protected jsonb;
begin
  if public.has_org_role(
    old.organization_id,
    array['owner', 'manager']::text[]
  ) then
    return new;
  end if;

  if not public.has_org_role(
    old.organization_id,
    array['accountant']::text[]
  ) then
    raise exception 'Role cannot update leases'
      using errcode = '42501';
  end if;

  old_protected := to_jsonb(old) - array[
    'annual_rent',
    'security_deposit',
    'grace_period_days',
    'updated_at'
  ];
  new_protected := to_jsonb(new) - array[
    'annual_rent',
    'security_deposit',
    'grace_period_days',
    'updated_at'
  ];

  if new_protected is distinct from old_protected then
    raise exception 'Accountants may update only approved financial lease fields'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_accountant_lease_fields() from public;

create trigger leases_enforce_accountant_fields
before update on public.leases
for each row execute function public.enforce_accountant_lease_fields();

create or replace function public.enforce_accountant_payment_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  old_protected jsonb;
  new_protected jsonb;
begin
  if public.has_org_role(
    old.organization_id,
    array['owner', 'manager']::text[]
  ) then
    return new;
  end if;

  if not public.has_org_role(
    old.organization_id,
    array['accountant']::text[]
  ) then
    raise exception 'Role cannot update payments'
      using errcode = '42501';
  end if;

  old_protected := to_jsonb(old) - array[
    'amount_paid',
    'payment_date',
    'payment_method',
    'reference_number',
    'notes',
    'updated_at'
  ];
  new_protected := to_jsonb(new) - array[
    'amount_paid',
    'payment_date',
    'payment_method',
    'reference_number',
    'notes',
    'updated_at'
  ];

  if new_protected is distinct from old_protected then
    raise exception 'Accountants may update only approved payment fields'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_accountant_payment_fields() from public;

create trigger payments_enforce_accountant_fields
before update on public.payments
for each row execute function public.enforce_accountant_payment_fields();

create or replace function public.enforce_accountant_expense_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  old_protected jsonb;
  new_protected jsonb;
begin
  if public.has_org_role(
    old.organization_id,
    array['owner', 'manager']::text[]
  ) then
    return new;
  end if;

  if not public.has_org_role(
    old.organization_id,
    array['accountant']::text[]
  ) then
    raise exception 'Role cannot update expenses'
      using errcode = '42501';
  end if;

  old_protected := to_jsonb(old) - array[
    'property_id',
    'unit_id',
    'expense_category_id',
    'amount',
    'expense_date',
    'payment_status',
    'description',
    'vendor_name',
    'updated_at'
  ];
  new_protected := to_jsonb(new) - array[
    'property_id',
    'unit_id',
    'expense_category_id',
    'amount',
    'expense_date',
    'payment_status',
    'description',
    'vendor_name',
    'updated_at'
  ];

  if new_protected is distinct from old_protected then
    raise exception 'Accountants may update only approved expense fields'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_accountant_expense_fields() from public;

create trigger expenses_enforce_accountant_fields
before update on public.expenses
for each row execute function public.enforce_accountant_expense_fields();

create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_organization_id uuid;
  target_record_id uuid;
  previous_values jsonb;
  current_values jsonb;
begin
  if tg_op = 'INSERT' then
    target_organization_id := new.organization_id;
    target_record_id := new.id;
    previous_values := null;
    current_values := to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    target_organization_id := new.organization_id;
    target_record_id := new.id;
    previous_values := to_jsonb(old);
    current_values := to_jsonb(new);
  else
    target_organization_id := old.organization_id;
    target_record_id := old.id;
    previous_values := to_jsonb(old);
    current_values := null;
  end if;

  insert into public.audit_logs (
    organization_id,
    user_id,
    action,
    table_name,
    record_id,
    old_values,
    new_values
  ) values (
    target_organization_id,
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    target_record_id,
    previous_values,
    current_values
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.write_audit_log() from public;

create trigger payments_write_audit_log
after insert or update or delete on public.payments
for each row execute function public.write_audit_log();

create trigger expenses_write_audit_log
after insert or update or delete on public.expenses
for each row execute function public.write_audit_log();

create trigger leases_write_audit_log
after insert or update or delete on public.leases
for each row execute function public.write_audit_log();

create trigger market_benchmarks_write_audit_log
after insert or update or delete on public.market_benchmarks
for each row execute function public.write_audit_log();

create trigger units_write_rent_audit_log
after update of current_annual_rent on public.units
for each row
when (old.current_annual_rent is distinct from new.current_annual_rent)
execute function public.write_audit_log();
