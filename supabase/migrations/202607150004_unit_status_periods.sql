-- Auditable historical unit-status periods for occupancy calculations.
create table public.unit_status_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  property_id uuid not null,
  unit_id uuid not null,
  status public.unit_status not null,
  start_date date not null,
  end_date date,
  unavailable_for_rent boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint unit_status_periods_org_id_key unique (organization_id, id),
  constraint unit_status_periods_unit_fk foreign key (organization_id, unit_id, property_id)
    references public.units (organization_id, id, property_id) on delete cascade,
  constraint unit_status_periods_dates_valid check (end_date is null or start_date <= end_date),
  constraint unit_status_periods_notes_not_blank check (notes is null or btrim(notes) <> '')
);

create unique index unit_status_periods_one_open
  on public.unit_status_periods (organization_id, unit_id) where end_date is null;
create index unit_status_periods_lookup_idx
  on public.unit_status_periods (organization_id, property_id, unit_id, start_date, end_date);

create or replace function public.prevent_unit_status_period_overlap()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (
    select 1 from public.unit_status_periods existing
    where existing.organization_id = new.organization_id
      and existing.unit_id = new.unit_id
      and existing.id <> new.id
      and daterange(existing.start_date, coalesce(existing.end_date, 'infinity'::date), '[]')
          && daterange(new.start_date, coalesce(new.end_date, 'infinity'::date), '[]')
  ) then
    raise exception 'Unit status periods cannot overlap' using errcode = '23P01';
  end if;
  return new;
end;
$$;
revoke all on function public.prevent_unit_status_period_overlap() from public;

create trigger unit_status_periods_prevent_overlap before insert or update
on public.unit_status_periods for each row execute function public.prevent_unit_status_period_overlap();
create trigger unit_status_periods_set_updated_at before update
on public.unit_status_periods for each row execute function public.set_updated_at();
create trigger unit_status_periods_prevent_org_change before update
on public.unit_status_periods for each row execute function public.prevent_organization_id_change();
create trigger unit_status_periods_write_audit_log after insert or update or delete
on public.unit_status_periods for each row execute function public.write_audit_log();

alter table public.unit_status_periods enable row level security;
create policy unit_status_periods_select_member on public.unit_status_periods
for select to authenticated using (public.is_org_member(organization_id));
create policy unit_status_periods_insert_management on public.unit_status_periods
for insert to authenticated with check (
  public.has_org_role(organization_id, array['owner', 'manager']::text[])
);
create policy unit_status_periods_update_management on public.unit_status_periods
for update to authenticated
using (public.has_org_role(organization_id, array['owner', 'manager']::text[]))
with check (public.has_org_role(organization_id, array['owner', 'manager']::text[]));
create policy unit_status_periods_delete_owner on public.unit_status_periods
for delete to authenticated using (public.has_org_role(organization_id, array['owner']::text[]));
revoke all on table public.unit_status_periods from anon, authenticated;
grant select, insert, update, delete on table public.unit_status_periods to authenticated;
