-- Financial records remain auditable: application deletion is always a
-- management-only soft delete, including when the database API is called directly.

drop policy if exists payments_delete_management on public.payments;
drop policy if exists expenses_delete_management on public.expenses;

create or replace function public.protect_financial_soft_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
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

create trigger payments_protect_soft_delete
before update of deleted_at on public.payments
for each row execute function public.protect_financial_soft_delete();

create trigger expenses_protect_soft_delete
before update of deleted_at on public.expenses
for each row execute function public.protect_financial_soft_delete();
