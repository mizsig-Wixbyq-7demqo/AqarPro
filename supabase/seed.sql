-- Deterministic fictional Riyadh portfolio. No person or property is real.
begin;
insert into auth.users (id, email) values
('10000000-0000-4000-8000-000000000001','owner.demo@aqarpro.local'),
('10000000-0000-4000-8000-000000000002','manager.demo@aqarpro.local'),
('10000000-0000-4000-8000-000000000003','accountant.demo@aqarpro.local'),
('10000000-0000-4000-8000-000000000004','viewer.demo@aqarpro.local') on conflict (id) do nothing;

insert into public.organizations (id,name,created_by) values
('20000000-0000-4000-8000-000000000001','محفظة رواسي الرياض العقارية','10000000-0000-4000-8000-000000000001');
insert into public.organization_members (id,organization_id,user_id,role) values
('21000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','owner'),
('21000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','manager'),
('21000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','accountant'),
('21000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000004','viewer');

insert into public.properties (id,organization_id,name,property_type,city,district,address,latitude,longitude,acquisition_date) values
('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','عمارة طويق 1','عمارة سكنية','الرياض','طويق','عنوان تدريبي قرب محطة النقل العام',24.5681,46.5212,'2021-03-14'),
('30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','رواسي العارض','عمارة سكنية','الرياض','العارض','عنوان تدريبي شمال الرياض',24.8659,46.6011,'2023-09-01');

with s as (select n, case when n<=12 then 1 else 2 end p, case when n<=12 then n else n-12 end local from generate_series(1,23)n)
insert into public.units (id,organization_id,property_id,unit_number,unit_type,bedrooms,bathrooms,area_sqm,floor_number,status,current_annual_rent)
select format('40000000-0000-4000-8000-%s',lpad(n::text,12,'0'))::uuid,'20000000-0000-4000-8000-000000000001',
format('30000000-0000-4000-8000-%s',lpad(p::text,12,'0'))::uuid,
case when p=1 then 'T' else 'A' end||lpad(local::text,2,'0'),case when local%3=0 then 'استوديو' else 'شقة' end,
case when local%3=0 then 1 when local%2=0 then 3 else 2 end,case when local%3=0 then 1 else 2 end,
case when local%3=0 then 48 else 78+local end,((local-1)/3+1)::smallint,
case when n<=19 then 'occupied'::public.unit_status else 'vacant'::public.unit_status end,
case when p=1 then 36000+local*900 else 48000+local*1100 end from s;

insert into public.tenants (id,organization_id,full_name,phone,email,national_id_reference)
select format('50000000-0000-4000-8000-%s',lpad(n::text,12,'0'))::uuid,'20000000-0000-4000-8000-000000000001',
'مستأجر تجريبي '||n,'050000'||lpad(n::text,4,'0'),'tenant'||n||'@example.test','مرجع-****-'||lpad(n::text,4,'0') from generate_series(1,19)n;

insert into public.leases (id,organization_id,property_id,unit_id,tenant_id,contract_number,start_date,end_date,annual_rent,payment_frequency,security_deposit,grace_period_days,status)
select format('60000000-0000-4000-8000-%s',lpad(n::text,12,'0'))::uuid,'20000000-0000-4000-8000-000000000001',
format('30000000-0000-4000-8000-%s',lpad((case when n<=12 then 1 else 2 end)::text,12,'0'))::uuid,
format('40000000-0000-4000-8000-%s',lpad(n::text,12,'0'))::uuid,format('50000000-0000-4000-8000-%s',lpad(n::text,12,'0'))::uuid,
'RWA-2026-'||lpad(n::text,4,'0'),case when n<=3 then '2025-08-01'::date else '2026-01-01'::date end,
case when n=1 then '2026-08-15'::date when n=2 then '2026-09-01'::date when n=3 then '2026-09-30'::date else '2027-01-01'::date+n end,
case when n<=12 then 36000+n*900 else 48000+(n-12)*1100 end,'monthly',2000,5,'active' from generate_series(1,19)n;

with src as (
 select lease_no,pay_no,row_number() over(order by lease_no,pay_no) rn
 from generate_series(1,19)lease_no cross join lateral generate_series(1,case when lease_no<=3 then 4 else 3 end)pay_no
), vals as (
 select *,('2026-05-01'::date+(pay_no-1)*interval '1 month')::date due,
 round((case when lease_no<=12 then 36000+lease_no*900 else 48000+(lease_no-12)*1100 end)/12.0,2) amount from src
)
insert into public.lease_payment_schedules (id,organization_id,lease_id,due_date,amount_due,status)
select format('70000000-0000-4000-8000-%s',lpad(rn::text,12,'0'))::uuid,'20000000-0000-4000-8000-000000000001',
format('60000000-0000-4000-8000-%s',lpad(lease_no::text,12,'0'))::uuid,due,amount,
case when rn=26 then 'partially_paid'::public.payment_schedule_status when rn<=27 then 'paid'::public.payment_schedule_status
when due<'2026-07-15' then 'overdue'::public.payment_schedule_status else 'pending'::public.payment_schedule_status end from vals;

with src as (
 select lease_no,pay_no,row_number() over(order by lease_no,pay_no) rn
 from generate_series(1,19)lease_no cross join lateral generate_series(1,case when lease_no<=3 then 4 else 3 end)pay_no
)
insert into public.payments (id,organization_id,lease_id,payment_schedule_id,amount_paid,payment_date,payment_method,reference_number,created_by)
select format('80000000-0000-4000-8000-%s',lpad(rn::text,12,'0'))::uuid,'20000000-0000-4000-8000-000000000001',
format('60000000-0000-4000-8000-%s',lpad(lease_no::text,12,'0'))::uuid,format('70000000-0000-4000-8000-%s',lpad(rn::text,12,'0'))::uuid,
round((case when lease_no<=12 then 36000+lease_no*900 else 48000+(lease_no-12)*1100 end)/12.0*(case when rn=26 then .5 else 1 end),2),
least(
  ('2026-05-02'::date+(pay_no-1)*interval '1 month')::date,
  '2026-07-15'::date
),'تحويل بنكي','PAY-'||lpad(rn::text,4,'0'),'10000000-0000-4000-8000-000000000003'
from src where rn<=27;

insert into public.expense_categories (id,organization_id,name,category_type) values
('90000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','كهرباء مشتركة','electricity'),
('90000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','نظافة','cleaning'),
('90000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','صيانة تشغيلية','maintenance'),
('90000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000001','تأمين ورسوم','insurance');
insert into public.expenses (id,organization_id,property_id,unit_id,expense_category_id,amount,expense_date,payment_status,description,vendor_name,created_by)
select format('91000000-0000-4000-8000-%s',lpad(n::text,12,'0'))::uuid,'20000000-0000-4000-8000-000000000001',
format('30000000-0000-4000-8000-%s',lpad((case when n<=10 then 1 else 2 end)::text,12,'0'))::uuid,null,
format('90000000-0000-4000-8000-%s',lpad((((n-1)%4)+1)::text,12,'0'))::uuid,case when n=9 then 28000 else 450+n*125 end,
'2026-04-01'::date+n*5,case when n in(16,18) then 'pending'::public.expense_payment_status else 'paid'::public.expense_payment_status end,
case when n=9 then 'إصلاح استثنائي لمضخات المياه' else 'مصروف تجريبي '||n end,'مورد تجريبي','10000000-0000-4000-8000-000000000003' from generate_series(1,18)n;

insert into public.market_benchmarks (id,organization_id,city,district,unit_type,bedrooms,area_min_sqm,area_max_sqm,annual_market_rent,lower_rent_range,upper_rent_range,sample_count,source_name,source_type,period_start,period_end,entered_manually,created_by)
select format('a0000000-0000-4000-8000-%s',lpad(n::text,12,'0'))::uuid,'20000000-0000-4000-8000-000000000001','الرياض',
case when n<=6 then 'طويق' when n<=12 then 'العارض' else 'النرجس' end,case when n%4=0 then 'استوديو' else 'شقة' end,
case when n%4=0 then 1 when n%2=0 then 3 else 2 end,case when n%4=0 then 35 else 70 end,case when n%4=0 then 60 else 115 end,
39000+n*1800,36000+n*1700,43000+n*1900,4+n,'مرجع سوقي '||n,
case when n%3=0 then 'executed_contract'::public.market_source_type when n%3=1 then 'asking_listing'::public.market_source_type else 'manual_estimate'::public.market_source_type end,
'2026-01-01','2026-06-30',true,'10000000-0000-4000-8000-000000000002' from generate_series(1,16)n;

insert into public.unit_status_periods (id,organization_id,property_id,unit_id,status,start_date,unavailable_for_rent)
select format('b0000000-0000-4000-8000-%s',lpad(n::text,12,'0'))::uuid,'20000000-0000-4000-8000-000000000001',
format('30000000-0000-4000-8000-%s',lpad((case when n<=12 then 1 else 2 end)::text,12,'0'))::uuid,
format('40000000-0000-4000-8000-%s',lpad(n::text,12,'0'))::uuid,
case when n<=19 then 'occupied'::public.unit_status else 'vacant'::public.unit_status end,'2026-01-01',false from generate_series(1,23)n;

insert into public.property_score_snapshots (id,organization_id,property_id,score_date,operating_health_score,cash_flow_status,cash_inflow,cash_outflow,net_cash_flow,collection_rate,occupancy_rate,expense_ratio,lease_expiry_risk,rent_gap_percentage,rent_gap_amount,possible_annual_rent_increase,formula_version,input_snapshot,output_snapshot)
select format('c0000000-0000-4000-8000-%s',lpad((((p-1)*3)+m)::text,12,'0'))::uuid,'20000000-0000-4000-8000-000000000001',
format('30000000-0000-4000-8000-%s',lpad(p::text,12,'0'))::uuid,('2026-04-30'::date+m*interval '1 month')::date,
74+p*3+m,case when m=2 then 'yellow'::public.cash_flow_status else 'green'::public.cash_flow_status end,38000+p*5000+m*1200,
9000+m*1800,29000+p*5000-m*600,88+m,case when p=1 then 83.33 else 81.82 end,20+m,case when m=3 then 18 else 8 end,
-8+m,-(18000-m*1000),42000+m*2500,'v1.0.0',jsonb_build_object('seed',true,'property',p,'month',m),jsonb_build_object('status','calculated','formula_version','v1.0.0')
from generate_series(1,2)p cross join generate_series(1,3)m;
commit;
