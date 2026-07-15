import type { HealthResult } from "./engine.ts";
interface Client { from(table: "property_score_snapshots"): { insert(v: Record<string, unknown>): { select(f: string): { single(): Promise<{ data: { id: string } | null; error: { message: string } | null }> } } } }
export async function savePropertyScoreSnapshot(client: Client, input: {
  organizationId: string; propertyId: string; scoreDate: string; health: HealthResult;
  cashFlowStatus: "green" | "yellow" | "red" | "insufficient_data"; cashInflow: number; cashOutflow: number;
  rentGapPercentage: number | null; rentGapAmount: number | null; possibleAnnualRentIncrease: number | null;
}) {
  const { data, error } = await client.from("property_score_snapshots").insert({
    organization_id: input.organizationId, property_id: input.propertyId, score_date: input.scoreDate,
    operating_health_score: input.health.score, cash_flow_status: input.cashFlowStatus,
    cash_inflow: input.cashInflow, cash_outflow: input.cashOutflow, net_cash_flow: input.cashInflow - input.cashOutflow,
    collection_rate: input.health.components.collection.value, occupancy_rate: input.health.components.occupancy.value,
    expense_ratio: input.health.components.expenseEfficiency.value, lease_expiry_risk: input.health.components.leaseExpiry.value,
    rent_gap_percentage: input.rentGapPercentage, rent_gap_amount: input.rentGapAmount,
    possible_annual_rent_increase: input.possibleAnnualRentIncrease, formula_version: input.health.formulaVersion,
    input_snapshot: input.health.inputs, output_snapshot: input.health,
  }).select("id").single();
  if (error || !data) throw new Error(error?.message ?? "تعذر حفظ لقطة المؤشر.");
  return data.id;
}
