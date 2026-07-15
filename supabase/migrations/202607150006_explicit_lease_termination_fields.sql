-- Keep the reviewed stage-five workflow forward-only while replacing its
-- row-shaped read with an explicit sensitive-field projection.
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
  target_property_id uuid;
  target_unit_id uuid;
  target_start_date date;
  target_status public.lease_status;
begin
  if auth.uid() is null or not public.has_org_role(
    p_organization_id,
    array['owner', 'manager']::text[]
  ) then
    raise exception 'Role cannot terminate leases' using errcode = '42501';
  end if;

  select lease.property_id, lease.unit_id, lease.start_date, lease.status
  into target_property_id, target_unit_id, target_start_date, target_status
  from public.leases as lease
  where lease.organization_id = p_organization_id
    and lease.id = p_lease_id
    and lease.deleted_at is null
  for update;

  if not found then
    raise exception 'Lease not found' using errcode = 'P0002';
  end if;
  if target_status not in ('draft'::public.lease_status, 'active'::public.lease_status) then
    raise exception 'Lease cannot be terminated from its current status' using errcode = '22023';
  end if;
  if p_effective_date < target_start_date then
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
      and other.unit_id = target_unit_id
      and other.id <> p_lease_id
      and other.deleted_at is null
      and other.status = 'active'::public.lease_status
      and other.start_date <= p_effective_date
      and other.end_date >= p_effective_date
  ) then
    perform public.apply_unit_status_period(
      p_organization_id, target_property_id, target_unit_id,
      'vacant'::public.unit_status, p_effective_date
    );
  end if;
end;
$$;

revoke all on function public.terminate_lease(uuid, uuid, date) from public;
revoke all on function public.terminate_lease(uuid, uuid, date) from anon;
grant execute on function public.terminate_lease(uuid, uuid, date) to authenticated;
