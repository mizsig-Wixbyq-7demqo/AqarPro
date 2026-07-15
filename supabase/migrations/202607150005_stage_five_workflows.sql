-- Atomic application workflows used by stage five. Authorization is checked
-- again inside every security-definer entry point, while RLS remains enabled.

create or replace function public.apply_unit_status_period(
  target_organization_id uuid,
  target_property_id uuid,
  target_unit_id uuid,
  next_status public.unit_status,
  effective_date date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_status public.unit_status;
  open_period_id uuid;
  open_period_start date;
begin
  select unit.status
  into current_status
  from public.units as unit
  where unit.organization_id = target_organization_id
    and unit.property_id = target_property_id
    and unit.id = target_unit_id
    and unit.deleted_at is null
  for update;

  if not found then
    raise exception 'Unit not found' using errcode = 'P0002';
  end if;

  if current_status = next_status then
    return;
  end if;

  select period.id, period.start_date
  into open_period_id, open_period_start
  from public.unit_status_periods as period
  where period.organization_id = target_organization_id
    and period.unit_id = target_unit_id
    and period.end_date is null
  for update;

  if open_period_id is not null then
    if open_period_start < effective_date then
      update public.unit_status_periods
      set end_date = effective_date - 1
      where id = open_period_id;
    else
      delete from public.unit_status_periods where id = open_period_id;
    end if;
  end if;

  update public.units
  set status = next_status
  where organization_id = target_organization_id
    and id = target_unit_id;

  insert into public.unit_status_periods (
    organization_id,
    property_id,
    unit_id,
    status,
    start_date,
    unavailable_for_rent
  ) values (
    target_organization_id,
    target_property_id,
    target_unit_id,
    next_status,
    effective_date,
    next_status in ('maintenance'::public.unit_status, 'inactive'::public.unit_status)
  );
end;
$$;

revoke all on function public.apply_unit_status_period(uuid, uuid, uuid, public.unit_status, date) from public;

create or replace function public.create_unit_with_history(
  p_organization_id uuid,
  p_property_id uuid,
  p_unit_number text,
  p_unit_type text,
  p_bedrooms smallint,
  p_bathrooms numeric,
  p_area_sqm numeric,
  p_floor_number smallint,
  p_status public.unit_status,
  p_current_annual_rent numeric,
  p_notes text,
  p_effective_date date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_unit_id uuid;
begin
  if auth.uid() is null or not public.has_org_role(
    p_organization_id,
    array['owner', 'manager']::text[]
  ) then
    raise exception 'Role cannot create units' using errcode = '42501';
  end if;

  insert into public.units (
    organization_id, property_id, unit_number, unit_type, bedrooms, bathrooms,
    area_sqm, floor_number, status, current_annual_rent, notes
  ) values (
    p_organization_id, p_property_id, btrim(p_unit_number), btrim(p_unit_type),
    p_bedrooms, p_bathrooms, p_area_sqm, p_floor_number, p_status,
    p_current_annual_rent, nullif(btrim(p_notes), '')
  ) returning id into new_unit_id;

  insert into public.unit_status_periods (
    organization_id, property_id, unit_id, status, start_date, unavailable_for_rent
  ) values (
    p_organization_id, p_property_id, new_unit_id, p_status, p_effective_date,
    p_status in ('maintenance'::public.unit_status, 'inactive'::public.unit_status)
  );

  return new_unit_id;
end;
$$;

revoke all on function public.create_unit_with_history(uuid, uuid, text, text, smallint, numeric, numeric, smallint, public.unit_status, numeric, text, date) from public;
revoke all on function public.create_unit_with_history(uuid, uuid, text, text, smallint, numeric, numeric, smallint, public.unit_status, numeric, text, date) from anon;
grant execute on function public.create_unit_with_history(uuid, uuid, text, text, smallint, numeric, numeric, smallint, public.unit_status, numeric, text, date) to authenticated;

create or replace function public.update_unit_with_history(
  p_organization_id uuid,
  p_property_id uuid,
  p_unit_id uuid,
  p_unit_number text,
  p_unit_type text,
  p_bedrooms smallint,
  p_bathrooms numeric,
  p_area_sqm numeric,
  p_floor_number smallint,
  p_status public.unit_status,
  p_current_annual_rent numeric,
  p_notes text,
  p_effective_date date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_status public.unit_status;
begin
  if auth.uid() is null or not public.has_org_role(
    p_organization_id,
    array['owner', 'manager']::text[]
  ) then
    raise exception 'Role cannot update units' using errcode = '42501';
  end if;

  select unit.status into previous_status
  from public.units as unit
  where unit.organization_id = p_organization_id
    and unit.property_id = p_property_id
    and unit.id = p_unit_id
    and unit.deleted_at is null;

  if not found then
    raise exception 'Unit not found' using errcode = 'P0002';
  end if;

  update public.units
  set unit_number = btrim(p_unit_number),
      unit_type = btrim(p_unit_type),
      bedrooms = p_bedrooms,
      bathrooms = p_bathrooms,
      area_sqm = p_area_sqm,
      floor_number = p_floor_number,
      current_annual_rent = p_current_annual_rent,
      notes = nullif(btrim(p_notes), '')
  where organization_id = p_organization_id
    and property_id = p_property_id
    and id = p_unit_id;

  if previous_status is distinct from p_status then
    perform public.apply_unit_status_period(
      p_organization_id, p_property_id, p_unit_id, p_status, p_effective_date
    );
  end if;
end;
$$;

revoke all on function public.update_unit_with_history(uuid, uuid, uuid, text, text, smallint, numeric, numeric, smallint, public.unit_status, numeric, text, date) from public;
revoke all on function public.update_unit_with_history(uuid, uuid, uuid, text, text, smallint, numeric, numeric, smallint, public.unit_status, numeric, text, date) from anon;
grant execute on function public.update_unit_with_history(uuid, uuid, uuid, text, text, smallint, numeric, numeric, smallint, public.unit_status, numeric, text, date) to authenticated;

create or replace function public.create_lease_with_schedule(
  p_organization_id uuid,
  p_property_id uuid,
  p_unit_id uuid,
  p_tenant_id uuid,
  p_contract_number text,
  p_start_date date,
  p_end_date date,
  p_annual_rent numeric,
  p_payment_frequency public.payment_frequency,
  p_security_deposit numeric,
  p_grace_period_days integer,
  p_status public.lease_status,
  p_schedule jsonb,
  p_effective_date date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_lease_id uuid;
begin
  if auth.uid() is null or not public.has_org_role(
    p_organization_id,
    array['owner', 'manager']::text[]
  ) then
    raise exception 'Role cannot create leases' using errcode = '42501';
  end if;

  if jsonb_typeof(p_schedule) <> 'array' or jsonb_array_length(p_schedule) = 0 then
    raise exception 'Payment schedule is required' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_schedule) as item(due_date date, amount_due numeric)
    where item.due_date is null
      or item.amount_due is null
      or item.amount_due <= 0
      or item.due_date < p_start_date
      or item.due_date > p_end_date
  ) then
    raise exception 'Payment schedule contains invalid rows' using errcode = '22023';
  end if;

  if exists (
    select item.due_date
    from jsonb_to_recordset(p_schedule) as item(due_date date, amount_due numeric)
    group by item.due_date
    having count(*) > 1
  ) then
    raise exception 'Payment schedule contains duplicate dates' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.leases as lease
    where lease.organization_id = p_organization_id
      and lease.unit_id = p_unit_id
      and lease.deleted_at is null
      and lease.status in ('draft'::public.lease_status, 'active'::public.lease_status)
      and daterange(lease.start_date, lease.end_date, '[]') && daterange(p_start_date, p_end_date, '[]')
  ) then
    raise exception 'Unit already has an overlapping lease' using errcode = '23P01';
  end if;

  insert into public.leases (
    organization_id, property_id, unit_id, tenant_id, contract_number,
    start_date, end_date, annual_rent, payment_frequency, security_deposit,
    grace_period_days, status
  ) values (
    p_organization_id, p_property_id, p_unit_id, p_tenant_id,
    btrim(p_contract_number), p_start_date, p_end_date, p_annual_rent,
    p_payment_frequency, p_security_deposit, p_grace_period_days, p_status
  ) returning id into new_lease_id;

  insert into public.lease_payment_schedules (
    organization_id, lease_id, due_date, amount_due, status
  )
  select p_organization_id, new_lease_id, item.due_date, item.amount_due,
    'pending'::public.payment_schedule_status
  from jsonb_to_recordset(p_schedule) as item(due_date date, amount_due numeric)
  order by item.due_date;

  if p_status = 'active'::public.lease_status
    and p_start_date <= p_effective_date
    and p_end_date >= p_effective_date then
    perform public.apply_unit_status_period(
      p_organization_id, p_property_id, p_unit_id,
      'occupied'::public.unit_status, p_effective_date
    );
  end if;

  return new_lease_id;
end;
$$;

revoke all on function public.create_lease_with_schedule(uuid, uuid, uuid, uuid, text, date, date, numeric, public.payment_frequency, numeric, integer, public.lease_status, jsonb, date) from public;
revoke all on function public.create_lease_with_schedule(uuid, uuid, uuid, uuid, text, date, date, numeric, public.payment_frequency, numeric, integer, public.lease_status, jsonb, date) from anon;
grant execute on function public.create_lease_with_schedule(uuid, uuid, uuid, uuid, text, date, date, numeric, public.payment_frequency, numeric, integer, public.lease_status, jsonb, date) to authenticated;

create or replace function public.terminate_lease(
  p_organization_id uuid,
  p_lease_id uuid,
  p_effective_date date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_lease public.leases%rowtype;
begin
  if auth.uid() is null or not public.has_org_role(
    p_organization_id,
    array['owner', 'manager']::text[]
  ) then
    raise exception 'Role cannot terminate leases' using errcode = '42501';
  end if;

  select * into target_lease
  from public.leases
  where organization_id = p_organization_id
    and id = p_lease_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'Lease not found' using errcode = 'P0002';
  end if;
  if target_lease.status not in ('draft'::public.lease_status, 'active'::public.lease_status) then
    raise exception 'Lease cannot be terminated from its current status' using errcode = '22023';
  end if;
  if p_effective_date < target_lease.start_date then
    raise exception 'Termination date precedes lease start' using errcode = '22023';
  end if;

  update public.leases
  set status = 'terminated'::public.lease_status,
      end_date = least(end_date, p_effective_date)
  where organization_id = p_organization_id and id = p_lease_id;

  update public.lease_payment_schedules
  set status = 'cancelled'::public.payment_schedule_status
  where organization_id = p_organization_id
    and lease_id = p_lease_id
    and due_date > p_effective_date
    and status = 'pending'::public.payment_schedule_status;

  if not exists (
    select 1 from public.leases as other
    where other.organization_id = p_organization_id
      and other.unit_id = target_lease.unit_id
      and other.id <> p_lease_id
      and other.deleted_at is null
      and other.status = 'active'::public.lease_status
      and other.start_date <= p_effective_date
      and other.end_date >= p_effective_date
  ) then
    perform public.apply_unit_status_period(
      p_organization_id, target_lease.property_id, target_lease.unit_id,
      'vacant'::public.unit_status, p_effective_date
    );
  end if;
end;
$$;

revoke all on function public.terminate_lease(uuid, uuid, date) from public;
revoke all on function public.terminate_lease(uuid, uuid, date) from anon;
grant execute on function public.terminate_lease(uuid, uuid, date) to authenticated;
