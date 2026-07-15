-- Stage six financial integrity: payment allocations update their schedule
-- atomically, overpayments are rejected, and score dates are append-only unique.

create unique index property_score_snapshots_property_date_unique
  on public.property_score_snapshots (organization_id, property_id, score_date);

create or replace function public.refresh_payment_schedule_status(
  target_organization_id uuid,
  target_schedule_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  scheduled_amount numeric(15,2);
  current_status public.payment_schedule_status;
  scheduled_due_date date;
  collected_amount numeric(15,2);
  next_status public.payment_schedule_status;
  business_date date := (now() at time zone 'Asia/Riyadh')::date;
begin
  select schedule.amount_due, schedule.status, schedule.due_date
  into scheduled_amount, current_status, scheduled_due_date
  from public.lease_payment_schedules as schedule
  where schedule.organization_id = target_organization_id
    and schedule.id = target_schedule_id
  for update;

  if not found or current_status = 'cancelled'::public.payment_schedule_status then
    return;
  end if;

  select coalesce(sum(payment.amount_paid), 0)::numeric(15,2)
  into collected_amount
  from public.payments as payment
  where payment.organization_id = target_organization_id
    and payment.payment_schedule_id = target_schedule_id
    and payment.deleted_at is null;

  next_status := case
    when collected_amount >= scheduled_amount then 'paid'::public.payment_schedule_status
    when collected_amount > 0 then 'partially_paid'::public.payment_schedule_status
    when scheduled_due_date < business_date then 'overdue'::public.payment_schedule_status
    else 'pending'::public.payment_schedule_status
  end;

  update public.lease_payment_schedules
  set status = next_status
  where organization_id = target_organization_id
    and id = target_schedule_id
    and status is distinct from next_status;
end;
$$;

revoke all on function public.refresh_payment_schedule_status(uuid, uuid) from public;

create or replace function public.prevent_payment_overallocation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  scheduled_amount numeric(15,2);
  scheduled_lease_id uuid;
  scheduled_status public.payment_schedule_status;
  other_payments numeric(15,2);
begin
  if new.payment_schedule_id is null or new.deleted_at is not null then
    return new;
  end if;

  select schedule.amount_due, schedule.lease_id, schedule.status
  into scheduled_amount, scheduled_lease_id, scheduled_status
  from public.lease_payment_schedules as schedule
  where schedule.organization_id = new.organization_id
    and schedule.id = new.payment_schedule_id
  for update;

  if not found then
    raise exception 'Payment schedule not found' using errcode = 'P0002';
  end if;
  if scheduled_lease_id <> new.lease_id then
    raise exception 'Payment lease does not match its schedule' using errcode = '23503';
  end if;
  if scheduled_status = 'cancelled'::public.payment_schedule_status then
    raise exception 'Cancelled schedules cannot receive payments' using errcode = '22023';
  end if;

  select coalesce(sum(payment.amount_paid), 0)::numeric(15,2)
  into other_payments
  from public.payments as payment
  where payment.organization_id = new.organization_id
    and payment.payment_schedule_id = new.payment_schedule_id
    and payment.deleted_at is null
    and payment.id <> new.id;

  if other_payments + new.amount_paid > scheduled_amount then
    raise exception 'Payment exceeds the remaining schedule amount' using errcode = '22003';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_payment_overallocation() from public;

create trigger payments_prevent_overallocation
before insert or update of payment_schedule_id, lease_id, amount_paid, deleted_at
on public.payments
for each row execute function public.prevent_payment_overallocation();

create or replace function public.sync_schedule_after_payment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.payment_schedule_id is not null then
    perform public.refresh_payment_schedule_status(old.organization_id, old.payment_schedule_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.payment_schedule_id is not null then
    if tg_op <> 'UPDATE' or new.payment_schedule_id is distinct from old.payment_schedule_id then
      perform public.refresh_payment_schedule_status(new.organization_id, new.payment_schedule_id);
    elsif new.amount_paid is distinct from old.amount_paid
      or new.deleted_at is distinct from old.deleted_at then
      perform public.refresh_payment_schedule_status(new.organization_id, new.payment_schedule_id);
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

revoke all on function public.sync_schedule_after_payment() from public;

create trigger payments_sync_schedule_status
after insert or update or delete on public.payments
for each row execute function public.sync_schedule_after_payment();

create or replace function public.record_schedule_payment(
  p_organization_id uuid,
  p_schedule_id uuid,
  p_amount numeric,
  p_payment_date date,
  p_payment_method text,
  p_reference_number text,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target_lease_id uuid;
  scheduled_amount numeric(15,2);
  scheduled_status public.payment_schedule_status;
  collected_amount numeric(15,2);
  new_payment_id uuid;
begin
  if current_user_id is null or not public.has_org_role(
    p_organization_id,
    array['owner', 'manager', 'accountant']::text[]
  ) then
    raise exception 'Role cannot record payments' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be positive' using errcode = '22023';
  end if;

  select schedule.lease_id, schedule.amount_due, schedule.status
  into target_lease_id, scheduled_amount, scheduled_status
  from public.lease_payment_schedules as schedule
  where schedule.organization_id = p_organization_id
    and schedule.id = p_schedule_id
  for update;

  if not found then
    raise exception 'Payment schedule not found' using errcode = 'P0002';
  end if;
  if scheduled_status = 'cancelled'::public.payment_schedule_status then
    raise exception 'Cancelled schedules cannot receive payments' using errcode = '22023';
  end if;

  select coalesce(sum(payment.amount_paid), 0)::numeric(15,2)
  into collected_amount
  from public.payments as payment
  where payment.organization_id = p_organization_id
    and payment.payment_schedule_id = p_schedule_id
    and payment.deleted_at is null;

  if collected_amount + p_amount > scheduled_amount then
    raise exception 'Payment exceeds the remaining schedule amount' using errcode = '22003';
  end if;

  insert into public.payments (
    organization_id, lease_id, payment_schedule_id, amount_paid, payment_date,
    payment_method, reference_number, notes, created_by
  ) values (
    p_organization_id, target_lease_id, p_schedule_id, p_amount, p_payment_date,
    nullif(btrim(p_payment_method), ''), nullif(btrim(p_reference_number), ''),
    nullif(btrim(p_notes), ''), current_user_id
  ) returning id into new_payment_id;

  return new_payment_id;
end;
$$;

revoke all on function public.record_schedule_payment(uuid, uuid, numeric, date, text, text, text) from public;
revoke all on function public.record_schedule_payment(uuid, uuid, numeric, date, text, text, text) from anon;
grant execute on function public.record_schedule_payment(uuid, uuid, numeric, date, text, text, text) to authenticated;

create or replace function public.void_payment(
  p_organization_id uuid,
  p_payment_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.has_org_role(
    p_organization_id,
    array['owner', 'manager']::text[]
  ) then
    raise exception 'Role cannot void payments' using errcode = '42501';
  end if;

  update public.payments
  set deleted_at = now()
  where organization_id = p_organization_id
    and id = p_payment_id
    and deleted_at is null;

  if not found then
    raise exception 'Payment not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.void_payment(uuid, uuid) from public;
revoke all on function public.void_payment(uuid, uuid) from anon;
grant execute on function public.void_payment(uuid, uuid) to authenticated;
