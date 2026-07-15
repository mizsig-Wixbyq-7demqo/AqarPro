-- Stage seven defense in depth: server-side validation is mirrored at the
-- database boundary so direct API calls cannot bypass business-date rules.

create or replace function public.protect_financial_soft_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.deleted_at is not null then
      raise exception 'Financial records must be active when created'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.deleted_at is distinct from old.deleted_at
    and (
      auth.uid() is null
      or not public.has_org_role(
        old.organization_id,
        array['owner', 'manager']::text[]
      )
    ) then
    raise exception 'Role cannot change financial deletion state'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function public.protect_financial_soft_delete() from public;

create trigger payments_require_active_insert
before insert on public.payments
for each row execute function public.protect_financial_soft_delete();

create trigger expenses_require_active_insert
before insert on public.expenses
for each row execute function public.protect_financial_soft_delete();

create or replace function public.validate_payment_business_date()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.payment_date > (now() at time zone 'Asia/Riyadh')::date then
    raise exception 'Payment date cannot be in the future'
      using errcode = '22007';
  end if;
  return new;
end;
$$;

revoke all on function public.validate_payment_business_date() from public;

create trigger payments_validate_business_date
before insert or update of payment_date on public.payments
for each row execute function public.validate_payment_business_date();

create or replace function public.validate_expense_business_date()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.payment_status = 'paid'::public.expense_payment_status
    and new.expense_date > (now() at time zone 'Asia/Riyadh')::date then
    raise exception 'A paid expense cannot have a future date'
      using errcode = '22007';
  end if;
  return new;
end;
$$;

revoke all on function public.validate_expense_business_date() from public;

create trigger expenses_validate_business_date
before insert or update of expense_date, payment_status on public.expenses
for each row execute function public.validate_expense_business_date();

create or replace function public.validate_market_period_date()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.period_end > (now() at time zone 'Asia/Riyadh')::date then
    raise exception 'Market data period cannot end in the future'
      using errcode = '22007';
  end if;
  return new;
end;
$$;

revoke all on function public.validate_market_period_date() from public;

create trigger market_benchmarks_validate_period_date
before insert or update of period_end on public.market_benchmarks
for each row execute function public.validate_market_period_date();
