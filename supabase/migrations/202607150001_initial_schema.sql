-- AqarPro foundation: domain types, 13 core tables, tenant-safe relationships,
-- checks, and indexes. All money values use numeric(15,2).

create type public.organization_role as enum (
  'owner',
  'manager',
  'accountant',
  'viewer'
);

create type public.unit_status as enum (
  'occupied',
  'vacant',
  'maintenance',
  'inactive'
);

create type public.lease_status as enum (
  'draft',
  'active',
  'expired',
  'terminated',
  'cancelled'
);

create type public.payment_frequency as enum (
  'monthly',
  'quarterly',
  'semi_annual',
  'annual',
  'custom'
);

create type public.payment_schedule_status as enum (
  'pending',
  'partially_paid',
  'paid',
  'overdue',
  'cancelled'
);

create type public.expense_category_type as enum (
  'electricity',
  'water',
  'cleaning',
  'maintenance',
  'management',
  'insurance',
  'government_fees',
  'other'
);

create type public.expense_payment_status as enum (
  'pending',
  'paid',
  'cancelled'
);

create type public.market_source_type as enum (
  'executed_contract',
  'asking_listing',
  'manual_estimate'
);

create type public.cash_flow_status as enum (
  'green',
  'yellow',
  'red',
  'insufficient_data'
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_name_not_blank check (btrim(name) <> '')
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.organization_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_members_organization_user_key unique (organization_id, user_id)
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  property_type text not null,
  city text not null,
  district text not null,
  address text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  total_units integer not null default 0,
  acquisition_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint properties_org_id_key unique (organization_id, id),
  constraint properties_name_not_blank check (btrim(name) <> ''),
  constraint properties_type_not_blank check (btrim(property_type) <> ''),
  constraint properties_city_not_blank check (btrim(city) <> ''),
  constraint properties_district_not_blank check (btrim(district) <> ''),
  constraint properties_latitude_range check (latitude is null or latitude between -90 and 90),
  constraint properties_longitude_range check (longitude is null or longitude between -180 and 180),
  constraint properties_total_units_nonnegative check (total_units >= 0)
);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  property_id uuid not null,
  unit_number text not null,
  unit_type text not null,
  bedrooms smallint,
  bathrooms numeric(4,1),
  area_sqm numeric(10,2),
  floor_number smallint,
  status public.unit_status not null default 'vacant',
  current_annual_rent numeric(15,2),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint units_org_id_key unique (organization_id, id),
  constraint units_org_id_property_key unique (organization_id, id, property_id),
  constraint units_org_property_fk foreign key (organization_id, property_id)
    references public.properties(organization_id, id) on delete cascade,
  constraint units_number_not_blank check (btrim(unit_number) <> ''),
  constraint units_type_not_blank check (btrim(unit_type) <> ''),
  constraint units_bedrooms_nonnegative check (bedrooms is null or bedrooms >= 0),
  constraint units_bathrooms_nonnegative check (bathrooms is null or bathrooms >= 0),
  constraint units_area_positive check (area_sqm is null or area_sqm > 0),
  constraint units_current_rent_nonnegative check (
    current_annual_rent is null or current_annual_rent >= 0
  )
);

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  national_id_reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint tenants_org_id_key unique (organization_id, id),
  constraint tenants_full_name_not_blank check (btrim(full_name) <> ''),
  constraint tenants_phone_not_blank check (phone is null or btrim(phone) <> ''),
  constraint tenants_email_not_blank check (email is null or btrim(email) <> ''),
  constraint tenants_national_id_reference_not_blank check (
    national_id_reference is null or btrim(national_id_reference) <> ''
  )
);

comment on column public.tenants.national_id_reference is
  'External or masked reference only. Do not store an identity document image or unnecessary raw identity data.';

create table public.leases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  property_id uuid not null,
  unit_id uuid not null,
  tenant_id uuid not null,
  contract_number text not null,
  start_date date not null,
  end_date date not null,
  annual_rent numeric(15,2) not null,
  payment_frequency public.payment_frequency not null,
  security_deposit numeric(15,2) not null default 0,
  grace_period_days integer not null default 0,
  status public.lease_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint leases_org_id_key unique (organization_id, id),
  constraint leases_org_property_fk foreign key (organization_id, property_id)
    references public.properties(organization_id, id) on delete restrict,
  constraint leases_org_unit_property_fk foreign key (organization_id, unit_id, property_id)
    references public.units(organization_id, id, property_id) on delete restrict,
  constraint leases_org_tenant_fk foreign key (organization_id, tenant_id)
    references public.tenants(organization_id, id) on delete restrict,
  constraint leases_contract_number_not_blank check (btrim(contract_number) <> ''),
  constraint leases_dates_valid check (start_date <= end_date),
  constraint leases_annual_rent_positive check (annual_rent > 0),
  constraint leases_security_deposit_nonnegative check (security_deposit >= 0),
  constraint leases_grace_period_range check (grace_period_days between 0 and 365)
);

create table public.lease_payment_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  lease_id uuid not null,
  due_date date not null,
  amount_due numeric(15,2) not null,
  status public.payment_schedule_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lease_payment_schedules_org_id_key unique (organization_id, id),
  constraint lease_payment_schedules_org_id_lease_key unique (organization_id, id, lease_id),
  constraint lease_payment_schedules_org_lease_due_key unique (
    organization_id,
    lease_id,
    due_date
  ),
  constraint lease_payment_schedules_org_lease_fk foreign key (organization_id, lease_id)
    references public.leases(organization_id, id) on delete cascade,
  constraint lease_payment_schedules_amount_positive check (amount_due > 0)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  lease_id uuid not null,
  payment_schedule_id uuid,
  amount_paid numeric(15,2) not null,
  payment_date date not null,
  payment_method text,
  reference_number text,
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint payments_org_id_key unique (organization_id, id),
  constraint payments_org_lease_fk foreign key (organization_id, lease_id)
    references public.leases(organization_id, id) on delete restrict,
  constraint payments_org_schedule_lease_fk foreign key (
    organization_id,
    payment_schedule_id,
    lease_id
  ) references public.lease_payment_schedules(organization_id, id, lease_id) on delete restrict,
  constraint payments_amount_positive check (amount_paid > 0),
  constraint payments_method_not_blank check (
    payment_method is null or btrim(payment_method) <> ''
  ),
  constraint payments_reference_not_blank check (
    reference_number is null or btrim(reference_number) <> ''
  )
);

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  category_type public.expense_category_type not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expense_categories_org_id_key unique (organization_id, id),
  constraint expense_categories_name_not_blank check (btrim(name) <> '')
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  property_id uuid not null,
  unit_id uuid,
  expense_category_id uuid not null,
  amount numeric(15,2) not null,
  expense_date date not null,
  payment_status public.expense_payment_status not null default 'pending',
  description text not null,
  vendor_name text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint expenses_org_id_key unique (organization_id, id),
  constraint expenses_org_property_fk foreign key (organization_id, property_id)
    references public.properties(organization_id, id) on delete restrict,
  constraint expenses_org_unit_property_fk foreign key (organization_id, unit_id, property_id)
    references public.units(organization_id, id, property_id) on delete restrict,
  constraint expenses_org_category_fk foreign key (organization_id, expense_category_id)
    references public.expense_categories(organization_id, id) on delete restrict,
  constraint expenses_amount_positive check (amount > 0),
  constraint expenses_description_not_blank check (btrim(description) <> ''),
  constraint expenses_vendor_not_blank check (vendor_name is null or btrim(vendor_name) <> '')
);

create table public.market_benchmarks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  city text not null,
  district text not null,
  unit_type text not null,
  bedrooms smallint,
  area_min_sqm numeric(10,2),
  area_max_sqm numeric(10,2),
  annual_market_rent numeric(15,2) not null,
  lower_rent_range numeric(15,2),
  upper_rent_range numeric(15,2),
  sample_count integer,
  source_name text not null,
  source_type public.market_source_type not null,
  period_start date not null,
  period_end date not null,
  entered_manually boolean not null default true,
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint market_benchmarks_org_id_key unique (organization_id, id),
  constraint market_benchmarks_city_not_blank check (btrim(city) <> ''),
  constraint market_benchmarks_district_not_blank check (btrim(district) <> ''),
  constraint market_benchmarks_unit_type_not_blank check (btrim(unit_type) <> ''),
  constraint market_benchmarks_bedrooms_nonnegative check (bedrooms is null or bedrooms >= 0),
  constraint market_benchmarks_area_min_positive check (area_min_sqm is null or area_min_sqm > 0),
  constraint market_benchmarks_area_max_positive check (area_max_sqm is null or area_max_sqm > 0),
  constraint market_benchmarks_area_range_valid check (
    area_min_sqm is null or area_max_sqm is null or area_min_sqm <= area_max_sqm
  ),
  constraint market_benchmarks_market_rent_positive check (annual_market_rent > 0),
  constraint market_benchmarks_lower_rent_nonnegative check (
    lower_rent_range is null or lower_rent_range >= 0
  ),
  constraint market_benchmarks_upper_rent_nonnegative check (
    upper_rent_range is null or upper_rent_range >= 0
  ),
  constraint market_benchmarks_lower_not_above_market check (
    lower_rent_range is null or lower_rent_range <= annual_market_rent
  ),
  constraint market_benchmarks_upper_not_below_market check (
    upper_rent_range is null or upper_rent_range >= annual_market_rent
  ),
  constraint market_benchmarks_sample_count_positive check (
    sample_count is null or sample_count > 0
  ),
  constraint market_benchmarks_source_not_blank check (btrim(source_name) <> ''),
  constraint market_benchmarks_period_valid check (period_start <= period_end)
);

create table public.property_score_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  property_id uuid not null,
  score_date date not null,
  operating_health_score numeric(5,2),
  cash_flow_status public.cash_flow_status not null,
  cash_inflow numeric(15,2) not null default 0,
  cash_outflow numeric(15,2) not null default 0,
  net_cash_flow numeric(15,2) not null default 0,
  collection_rate numeric(7,2),
  occupancy_rate numeric(7,2),
  expense_ratio numeric(7,2),
  lease_expiry_risk numeric(7,2),
  rent_gap_percentage numeric(7,2),
  rent_gap_amount numeric(15,2),
  possible_annual_rent_increase numeric(15,2),
  formula_version text not null default 'v1.0.0',
  input_snapshot jsonb not null,
  output_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  constraint property_score_snapshots_org_id_key unique (organization_id, id),
  constraint property_score_snapshots_org_property_fk foreign key (organization_id, property_id)
    references public.properties(organization_id, id) on delete cascade,
  constraint property_score_snapshots_health_range check (
    operating_health_score is null or operating_health_score between 0 and 100
  ),
  constraint property_score_snapshots_collection_range check (
    collection_rate is null or collection_rate between 0 and 100
  ),
  constraint property_score_snapshots_occupancy_range check (
    occupancy_rate is null or occupancy_rate between 0 and 100
  ),
  constraint property_score_snapshots_expense_nonnegative check (
    expense_ratio is null or expense_ratio >= 0
  ),
  constraint property_score_snapshots_expiry_range check (
    lease_expiry_risk is null or lease_expiry_risk between 0 and 100
  ),
  constraint property_score_snapshots_rent_increase_nonnegative check (
    possible_annual_rent_increase is null or possible_annual_rent_increase >= 0
  ),
  constraint property_score_snapshots_formula_not_blank check (btrim(formula_version) <> ''),
  constraint property_score_snapshots_input_object check (
    jsonb_typeof(input_snapshot) = 'object'
  ),
  constraint property_score_snapshots_output_object check (
    jsonb_typeof(output_snapshot) = 'object'
  )
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  table_name text not null,
  record_id uuid,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now(),
  constraint audit_logs_action_not_blank check (btrim(action) <> ''),
  constraint audit_logs_table_name_not_blank check (btrim(table_name) <> ''),
  constraint audit_logs_old_values_object check (
    old_values is null or jsonb_typeof(old_values) = 'object'
  ),
  constraint audit_logs_new_values_object check (
    new_values is null or jsonb_typeof(new_values) = 'object'
  )
);

create unique index units_active_number_unique
  on public.units (organization_id, property_id, lower(unit_number))
  where deleted_at is null;

create unique index leases_active_contract_number_unique
  on public.leases (organization_id, lower(contract_number))
  where deleted_at is null;

create unique index leases_one_active_per_unit
  on public.leases (organization_id, unit_id)
  where status = 'active' and deleted_at is null;

create unique index expense_categories_name_unique
  on public.expense_categories (organization_id, lower(name));

create index organization_members_user_org_idx
  on public.organization_members (user_id, organization_id);

create index properties_org_active_idx
  on public.properties (organization_id, city, district)
  where deleted_at is null;

create index units_org_property_status_idx
  on public.units (organization_id, property_id, status)
  where deleted_at is null;

create index tenants_org_active_idx
  on public.tenants (organization_id, full_name)
  where deleted_at is null;

create index leases_org_property_status_end_idx
  on public.leases (organization_id, property_id, status, end_date)
  where deleted_at is null;

create index lease_payment_schedules_org_due_status_idx
  on public.lease_payment_schedules (organization_id, due_date, status);

create index payments_org_date_idx
  on public.payments (organization_id, payment_date)
  where deleted_at is null;

create index expenses_org_property_date_idx
  on public.expenses (organization_id, property_id, expense_date)
  where deleted_at is null;

create index market_benchmarks_match_idx
  on public.market_benchmarks (
    organization_id,
    city,
    district,
    unit_type,
    bedrooms,
    source_type,
    period_end
  );

create index property_score_snapshots_history_idx
  on public.property_score_snapshots (organization_id, property_id, score_date desc);

create index audit_logs_org_record_idx
  on public.audit_logs (organization_id, table_name, record_id, created_at desc);
