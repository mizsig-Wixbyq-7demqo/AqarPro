import { CASH_FLOW_CONFIG, EXPENSE_BANDS, FORMULA_VERSION, HEALTH_WEIGHTS } from "./config.ts";

export type Availability = "available" | "insufficient_data";
export type CashFlowStatus = "green" | "yellow" | "red" | "insufficient_data";
export interface Metric { value: number | null; score: number | null; availability: Availability; note?: string }
export interface HealthInput {
  amountDue: number; amountCollected: number; occupiedUnitDays: number;
  availableUnitDays: number; paidExpenses: number; activeAnnualRent: number;
  expiringAnnualRent: number;
}
export interface HealthResult {
  score: number | null; availability: Availability; formulaVersion: typeof FORMULA_VERSION;
  components: {
    collection: Metric & { weight: number }; occupancy: Metric & { weight: number };
    expenseEfficiency: Metric & { weight: number }; leaseExpiry: Metric & { weight: number };
  };
  inputs: HealthInput; notes: string[];
}
export interface CashFlowMonth { month: string; inflow: number; outflow: number }
export interface BenchmarkCandidate {
  id: string; city: string; district: string; unitType: string; bedrooms: number | null;
  areaMinSqm: number | null; areaMaxSqm: number | null; annualMarketRent: number;
  sampleCount: number | null; sourceType: "executed_contract" | "asking_listing" | "manual_estimate";
  periodEnd: string;
}
export interface ComparableUnit { currentAnnualRent: number; marketAnnualRent: number | null; occupied: boolean }

const round = (value: number, digits = 2) => Math.round((value + Number.EPSILON) * 10 ** digits) / 10 ** digits;
const pct = (a: number, b: number) => round(a / b * 100);
const available = (value: number, score = value): Metric => ({ value: round(value), score: round(Math.max(0, Math.min(100, score))), availability: "available" });
const missing = (note: string): Metric => ({ value: null, score: null, availability: "insufficient_data", note });

export function calculateCollectionRate(due: number, collected: number): Metric {
  if (due <= 0) return missing("لا توجد دفعات مستحقة خلال الفترة.");
  const value = pct(Math.max(0, collected), due);
  return available(value, Math.min(value, 100));
}
export function calculateOccupancyRate(occupiedDays: number, availableDays: number): Metric {
  if (availableDays <= 0) return missing("لا توجد أيام وحدات متاحة خلال الفترة.");
  return available(pct(Math.max(0, Math.min(occupiedDays, availableDays)), availableDays));
}
export function calculateExpenseEfficiency(expenses: number, collected: number): Metric {
  if (collected <= 0) return expenses > 0
    ? { value: null, score: 0, availability: "available", note: "مصروفات دون تحصيل." }
    : missing("لا يوجد تحصيل يسمح بالحساب.");
  const value = pct(Math.max(0, expenses), collected);
  return available(value, EXPENSE_BANDS.find(b => value <= b.maximum)?.score ?? 0);
}
export function calculateLeaseExpiryRisk(expiring: number, active: number): Metric {
  if (active <= 0) return missing("لا توجد عقود نشطة.");
  const value = pct(Math.max(0, Math.min(expiring, active)), active);
  return available(value, 100 - value);
}
export function calculateOperatingHealthScore(inputs: HealthInput): HealthResult {
  const c = calculateCollectionRate(inputs.amountDue, inputs.amountCollected);
  const o = calculateOccupancyRate(inputs.occupiedUnitDays, inputs.availableUnitDays);
  const e = calculateExpenseEfficiency(inputs.paidExpenses, inputs.amountCollected);
  const l = calculateLeaseExpiryRisk(inputs.expiringAnnualRent, inputs.activeAnnualRent);
  const components = {
    collection: { ...c, weight: HEALTH_WEIGHTS.collection },
    occupancy: { ...o, weight: HEALTH_WEIGHTS.occupancy },
    expenseEfficiency: { ...e, weight: HEALTH_WEIGHTS.expenseEfficiency },
    leaseExpiry: { ...l, weight: HEALTH_WEIGHTS.leaseExpiry },
  };
  const complete = Object.values(components).every(x => x.score !== null);
  const score = complete ? round((c.score ?? 0) * .35 + (o.score ?? 0) * .30 + (e.score ?? 0) * .20 + (l.score ?? 0) * .15) : null;
  return { score, availability: complete ? "available" : "insufficient_data", formulaVersion: FORMULA_VERSION,
    components, inputs: { ...inputs }, notes: Object.values(components).flatMap(x => x.note ? [x.note] : []) };
}
export function calculateCashFlow(months: CashFlowMonth[]) {
  const monthly = months.map(m => ({ ...m, net: round(m.inflow - m.outflow) }));
  const totalInflow = round(monthly.reduce((s, m) => s + m.inflow, 0));
  const totalOutflow = round(monthly.reduce((s, m) => s + m.outflow, 0));
  const netCashFlow = round(totalInflow - totalOutflow);
  let status: CashFlowStatus = "insufficient_data";
  if (monthly.length >= CASH_FLOW_CONFIG.minimumMonths) {
    const recent = monthly.slice(-3), positive = recent.filter(m => m.net > 0).length, negative = recent.filter(m => m.net < 0).length;
    const avgMag = recent.reduce((s, m) => s + Math.abs(m.net), 0) / 3;
    const nearZero = Math.abs(netCashFlow) <= Math.max(totalInflow, totalOutflow, 1) * CASH_FLOW_CONFIG.nearZeroRatio;
    const volatile = positive > 0 && negative > 0 && Math.max(...recent.map(m => Math.abs(m.net))) > avgMag * CASH_FLOW_CONFIG.volatilityRatio;
    status = netCashFlow < 0 || negative === 3 ? "red" : nearZero || volatile || negative >= 2 ? "yellow" : netCashFlow > 0 && positive >= 2 ? "green" : "yellow";
  }
  return { status, totalInflow, totalOutflow, netCashFlow, averageMonthlyNet: monthly.length ? round(netCashFlow / monthly.length) : null, monthly, formulaVersion: FORMULA_VERSION };
}
export function classifyRentGap(value: number): string {
  return value < -10 ? "أقل كثيرًا من السوق" : value < -3 ? "أقل قليلًا من السوق" : value <= 5 ? "قريب من السوق" : value <= 12 ? "أعلى من السوق" : "أعلى كثيرًا من السوق";
}
export function calculateRentGap(current: number, market: number | null) {
  if (!market || market <= 0) return { percentage: null, amount: null, classification: "لا توجد بيانات سوق كافية للمقارنة" };
  const amount = round(current - market), percentage = pct(amount, market);
  return { percentage, amount, classification: classifyRentGap(percentage) };
}
export function calculatePropertyRentGap(units: ComparableUnit[]) {
  const comparable = units.filter(u => u.occupied && u.marketAnnualRent !== null && u.marketAnnualRent > 0);
  if (!comparable.length) return { percentage: null, amount: null, possibleAnnualIncrease: null, comparableUnits: 0 };
  const current = comparable.reduce((s, u) => s + u.currentAnnualRent, 0), market = comparable.reduce((s, u) => s + (u.marketAnnualRent ?? 0), 0);
  const amount = round(current - market), possibleAnnualIncrease = round(comparable.reduce((s, u) => s + Math.max((u.marketAnnualRent ?? 0) - u.currentAnnualRent, 0), 0));
  return { percentage: pct(amount, market), amount, possibleAnnualIncrease, comparableUnits: comparable.length };
}
export function selectBenchmark(candidates: BenchmarkCandidate[], unit: { city: string; district: string; unitType: string; bedrooms: number | null; areaSqm: number | null }, sourceType: BenchmarkCandidate["sourceType"]) {
  return candidates.filter(c => c.sourceType === sourceType && c.city === unit.city && c.district === unit.district && c.unitType === unit.unitType
    && !(c.bedrooms !== null && unit.bedrooms !== null && c.bedrooms !== unit.bedrooms)
    && !(unit.areaSqm !== null && ((c.areaMinSqm !== null && unit.areaSqm < c.areaMinSqm) || (c.areaMaxSqm !== null && unit.areaSqm > c.areaMaxSqm))))
    .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd) || (b.sampleCount ?? 0) - (a.sampleCount ?? 0))[0] ?? null;
}
