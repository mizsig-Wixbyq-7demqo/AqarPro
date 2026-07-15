import { createClient } from "@/lib/supabase/server.ts";
import { calculateRentGap, selectBenchmark, type BenchmarkCandidate } from "@/lib/scoring/engine.ts";
import { addDays, formatArabicMonth, getMonthBounds, getRiyadhToday } from "@/lib/domain/business-date.ts";

export interface PropertyRow { id:string; name:string; property_type:string; city:string; district:string; address:string|null; total_units:number; acquisition_date:string|null; notes:string|null; updated_at:string }
export interface UnitRow { id:string; property_id:string; unit_number:string; unit_type:string; bedrooms:number|null; bathrooms:number|null; area_sqm:number|null; floor_number:number|null; status:"occupied"|"vacant"|"maintenance"|"inactive"; current_annual_rent:number|null; notes:string|null; updated_at:string }
export interface TenantRow { id:string; full_name:string; phone:string|null; email:string|null; national_id_reference:string|null; notes:string|null }
export interface LeaseRow { id:string; property_id:string; unit_id:string; tenant_id:string; contract_number:string; start_date:string; end_date:string; annual_rent:number; payment_frequency:"monthly"|"quarterly"|"semi_annual"|"annual"|"custom"; security_deposit:number; grace_period_days:number; status:"draft"|"active"|"expired"|"terminated"|"cancelled"; updated_at:string }
interface ScheduleRow { id:string; lease_id:string; due_date:string; amount_due:number; status:"pending"|"partially_paid"|"paid"|"overdue"|"cancelled" }
interface PaymentRow { id:string; lease_id:string; payment_schedule_id:string|null; amount_paid:number; payment_date:string }
interface ExpenseRow { id:string; property_id:string; amount:number; expense_date:string; payment_status:"pending"|"paid"|"cancelled" }
interface SnapshotRow { property_id:string; score_date:string; operating_health_score:number|null; net_cash_flow:number; collection_rate:number|null; occupancy_rate:number|null; rent_gap_percentage:number|null; possible_annual_rent_increase:number|null; formula_version:string }
interface BenchmarkRow { id:string; city:string; district:string; unit_type:string; bedrooms:number|null; area_min_sqm:number|null; area_max_sqm:number|null; annual_market_rent:number; sample_count:number|null; source_name:string; source_type:"executed_contract"|"asking_listing"|"manual_estimate"; period_end:string }

export interface PropertyCardData extends PropertyRow {
  occupiedUnits:number;
  vacantUnits:number;
  occupancyRate:number|null;
  dueThisMonth:number;
  collectedThisMonth:number;
  collectionRate:number|null;
  expensesThisMonth:number;
  netCashFlow:number;
  overdueAmount:number;
  operatingHealthScore:number|null;
  rentGapPercentage:number|null;
  possibleAnnualIncrease:number|null;
  expiringLeases:number;
  snapshotDate:string|null;
}

export interface PortfolioDashboardData {
  monthLabel:string;
  today:string;
  totals:{properties:number;units:number;occupied:number;vacant:number;maintenance:number;inactive:number;occupancyRate:number|null;dueThisMonth:number;collectedThisMonth:number;overdueAmount:number;expensesThisMonth:number;netCashFlow:number;averageHealthScore:number|null};
  properties:PropertyCardData[];
}

export interface PropertyDetailData {
  property:PropertyRow;
  units:Array<UnitRow & {currentLease:(LeaseRow & {tenant:TenantRow})|null;marketAnnualRent:number|null;marketSource:string|null;rentGapPercentage:number|null}>;
  leases:Array<LeaseRow & {unit:UnitRow|null;tenant:TenantRow|null;scheduleCount:number;scheduledAmount:number;paidInstallments:number}>;
  tenants:TenantRow[];
  latestSnapshot:SnapshotRow|null;
  overview:PropertyCardData;
}

function rows<T>(result:{data:unknown;error:{message:string}|null}, message:string) {
  if (result.error) throw new Error(message);
  return (result.data ?? []) as T[];
}

function round(value:number) { return Math.round(value * 100) / 100; }

async function readPortfolioRows(organizationId:string) {
  const supabase = await createClient();
  const [propertiesResult, unitsResult, leasesResult, schedulesResult, paymentsResult, expensesResult, snapshotsResult] = await Promise.all([
    supabase.from("properties").select("id, name, property_type, city, district, address, total_units, acquisition_date, notes, updated_at").eq("organization_id",organizationId).is("deleted_at",null).order("name"),
    supabase.from("units").select("id, property_id, unit_number, unit_type, bedrooms, bathrooms, area_sqm, floor_number, status, current_annual_rent, notes, updated_at").eq("organization_id",organizationId).is("deleted_at",null).order("unit_number"),
    supabase.from("leases").select("id, property_id, unit_id, tenant_id, contract_number, start_date, end_date, annual_rent, payment_frequency, security_deposit, grace_period_days, status, updated_at").eq("organization_id",organizationId).is("deleted_at",null),
    supabase.from("lease_payment_schedules").select("id, lease_id, due_date, amount_due, status").eq("organization_id",organizationId),
    supabase.from("payments").select("id, lease_id, payment_schedule_id, amount_paid, payment_date").eq("organization_id",organizationId).is("deleted_at",null),
    supabase.from("expenses").select("id, property_id, amount, expense_date, payment_status").eq("organization_id",organizationId).is("deleted_at",null),
    supabase.from("property_score_snapshots").select("property_id, score_date, operating_health_score, net_cash_flow, collection_rate, occupancy_rate, rent_gap_percentage, possible_annual_rent_increase, formula_version").eq("organization_id",organizationId).order("score_date",{ascending:false}),
  ]);
  return {
    properties:rows<PropertyRow>(propertiesResult,"تعذر قراءة العقارات."),
    units:rows<UnitRow>(unitsResult,"تعذر قراءة الوحدات."),
    leases:rows<LeaseRow>(leasesResult,"تعذر قراءة العقود."),
    schedules:rows<ScheduleRow>(schedulesResult,"تعذر قراءة الاستحقاقات."),
    payments:rows<PaymentRow>(paymentsResult,"تعذر قراءة التحصيل."),
    expenses:rows<ExpenseRow>(expensesResult,"تعذر قراءة المصروفات."),
    snapshots:rows<SnapshotRow>(snapshotsResult,"تعذر قراءة المؤشرات."),
  };
}

function aggregateProperties(data:Awaited<ReturnType<typeof readPortfolioRows>>, today=getRiyadhToday()) {
  const {start,next}=getMonthBounds(today), expiryLimit=addDays(today,90);
  const leaseProperty=new Map(data.leases.map(lease=>[lease.id,lease.property_id]));
  const paidBySchedule=new Map<string,number>();
  for(const payment of data.payments) if(payment.payment_schedule_id) paidBySchedule.set(payment.payment_schedule_id,(paidBySchedule.get(payment.payment_schedule_id)??0)+Number(payment.amount_paid));
  const latestSnapshot=new Map<string,SnapshotRow>();
  for(const snapshot of data.snapshots) if(!latestSnapshot.has(snapshot.property_id)) latestSnapshot.set(snapshot.property_id,snapshot);

  return data.properties.map<PropertyCardData>(property=>{
    const units=data.units.filter(unit=>unit.property_id===property.id);
    const leases=data.leases.filter(lease=>lease.property_id===property.id);
    const leaseIds=new Set(leases.map(lease=>lease.id));
    const dueThisMonth=data.schedules.filter(item=>leaseIds.has(item.lease_id)&&item.due_date>=start&&item.due_date<next&&item.status!=="cancelled").reduce((sum,item)=>sum+Number(item.amount_due),0);
    const collectedThisMonth=data.payments.filter(item=>leaseProperty.get(item.lease_id)===property.id&&item.payment_date>=start&&item.payment_date<next).reduce((sum,item)=>sum+Number(item.amount_paid),0);
    const overdueAmount=data.schedules.filter(item=>leaseIds.has(item.lease_id)&&item.due_date<today&&!(["paid","cancelled"] as string[]).includes(item.status)).reduce((sum,item)=>sum+Math.max(0,Number(item.amount_due)-(paidBySchedule.get(item.id)??0)),0);
    const expensesThisMonth=data.expenses.filter(item=>item.property_id===property.id&&item.payment_status==="paid"&&item.expense_date>=start&&item.expense_date<next).reduce((sum,item)=>sum+Number(item.amount),0);
    const occupiedUnits=units.filter(unit=>unit.status==="occupied").length;
    const vacantUnits=units.filter(unit=>unit.status==="vacant").length;
    const available=units.filter(unit=>unit.status!=="inactive"&&unit.status!=="maintenance").length;
    const snapshot=latestSnapshot.get(property.id);
    return {...property,total_units:units.length,occupiedUnits,vacantUnits,occupancyRate:available?round(occupiedUnits/available*100):null,dueThisMonth:round(dueThisMonth),collectedThisMonth:round(collectedThisMonth),collectionRate:dueThisMonth?round(collectedThisMonth/dueThisMonth*100):null,expensesThisMonth:round(expensesThisMonth),netCashFlow:round(collectedThisMonth-expensesThisMonth),overdueAmount:round(overdueAmount),operatingHealthScore:snapshot?.operating_health_score===null||snapshot?.operating_health_score===undefined?null:Number(snapshot.operating_health_score),rentGapPercentage:snapshot?.rent_gap_percentage===null||snapshot?.rent_gap_percentage===undefined?null:Number(snapshot.rent_gap_percentage),possibleAnnualIncrease:snapshot?.possible_annual_rent_increase===null||snapshot?.possible_annual_rent_increase===undefined?null:Number(snapshot.possible_annual_rent_increase),expiringLeases:leases.filter(lease=>lease.status==="active"&&lease.end_date>=today&&lease.end_date<=expiryLimit).length,snapshotDate:snapshot?.score_date??null};
  });
}

export async function getPortfolioDashboard(organizationId:string):Promise<PortfolioDashboardData> {
  const today=getRiyadhToday(),data=await readPortfolioRows(organizationId),properties=aggregateProperties(data,today);
  const totalUnits=data.units.length,occupied=data.units.filter(x=>x.status==="occupied").length,vacant=data.units.filter(x=>x.status==="vacant").length,maintenance=data.units.filter(x=>x.status==="maintenance").length,inactive=data.units.filter(x=>x.status==="inactive").length,available=totalUnits-maintenance-inactive;
  const health=properties.flatMap(x=>x.operatingHealthScore===null?[]:[x.operatingHealthScore]);
  return {monthLabel:formatArabicMonth(today),today,properties,totals:{properties:properties.length,units:totalUnits,occupied,vacant,maintenance,inactive,occupancyRate:available?round(occupied/available*100):null,dueThisMonth:round(properties.reduce((s,x)=>s+x.dueThisMonth,0)),collectedThisMonth:round(properties.reduce((s,x)=>s+x.collectedThisMonth,0)),overdueAmount:round(properties.reduce((s,x)=>s+x.overdueAmount,0)),expensesThisMonth:round(properties.reduce((s,x)=>s+x.expensesThisMonth,0)),netCashFlow:round(properties.reduce((s,x)=>s+x.netCashFlow,0)),averageHealthScore:health.length?round(health.reduce((s,x)=>s+x,0)/health.length):null}};
}

function toBenchmark(row:BenchmarkRow):BenchmarkCandidate { return {id:row.id,city:row.city,district:row.district,unitType:row.unit_type,bedrooms:row.bedrooms,areaMinSqm:row.area_min_sqm,areaMaxSqm:row.area_max_sqm,annualMarketRent:Number(row.annual_market_rent),sampleCount:row.sample_count,sourceType:row.source_type,periodEnd:row.period_end}; }

export async function getPropertyDetail(organizationId:string,propertyId:string):Promise<PropertyDetailData|null> {
  const data=await readPortfolioRows(organizationId),property=data.properties.find(x=>x.id===propertyId);
  if(!property)return null;
  const supabase=await createClient();
  const [tenantsResult,benchmarksResult]=await Promise.all([
    supabase.from("tenants").select("id, full_name, phone, email, national_id_reference, notes").eq("organization_id",organizationId).is("deleted_at",null).order("full_name"),
    supabase.from("market_benchmarks").select("id, city, district, unit_type, bedrooms, area_min_sqm, area_max_sqm, annual_market_rent, sample_count, source_name, source_type, period_end").eq("organization_id",organizationId).eq("city",property.city).eq("district",property.district).order("period_end",{ascending:false}),
  ]);
  const tenants=rows<TenantRow>(tenantsResult,"تعذر قراءة المستأجرين."),benchmarks=rows<BenchmarkRow>(benchmarksResult,"تعذر قراءة بيانات السوق."),tenantById=new Map(tenants.map(x=>[x.id,x])),unitById=new Map(data.units.map(x=>[x.id,x]));
  const propertyLeases=data.leases.filter(x=>x.property_id===propertyId).sort((a,b)=>b.start_date.localeCompare(a.start_date));
  const activeByUnit=new Map<string,LeaseRow>();
  for(const lease of propertyLeases) if((lease.status==="active"||lease.status==="draft")&&!activeByUnit.has(lease.unit_id))activeByUnit.set(lease.unit_id,lease);
  const sourcePriority:BenchmarkRow["source_type"][]=["executed_contract","asking_listing","manual_estimate"];
  const units=data.units.filter(x=>x.property_id===propertyId).map(unit=>{
    const lease=activeByUnit.get(unit.id),tenant=lease?tenantById.get(lease.tenant_id):undefined;
    let selected:BenchmarkCandidate|null=null,sourceName:string|null=null;
    for(const sourceType of sourcePriority){selected=selectBenchmark(benchmarks.map(toBenchmark),{city:property.city,district:property.district,unitType:unit.unit_type,bedrooms:unit.bedrooms,areaSqm:unit.area_sqm},sourceType);if(selected){sourceName=benchmarks.find(x=>x.id===selected?.id)?.source_name??null;break;}}
    const current=lease?.annual_rent??unit.current_annual_rent,gap=current===null?{percentage:null}:calculateRentGap(Number(current),selected?.annualMarketRent??null);
    return {...unit,currentLease:lease&&tenant?{...lease,tenant}:null,marketAnnualRent:selected?.annualMarketRent??null,marketSource:sourceName,rentGapPercentage:gap.percentage};
  });
  const leases=propertyLeases.map(lease=>{const schedules=data.schedules.filter(x=>x.lease_id===lease.id);return {...lease,unit:unitById.get(lease.unit_id)??null,tenant:tenantById.get(lease.tenant_id)??null,scheduleCount:schedules.length,scheduledAmount:round(schedules.reduce((s,x)=>s+Number(x.amount_due),0)),paidInstallments:schedules.filter(x=>x.status==="paid").length};});
  const cards=aggregateProperties(data);
  return {property,units,leases,tenants,latestSnapshot:data.snapshots.find(x=>x.property_id===propertyId)??null,overview:cards.find(x=>x.id===propertyId)!};
}
