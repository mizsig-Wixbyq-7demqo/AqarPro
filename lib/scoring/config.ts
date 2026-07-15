export const FORMULA_VERSION = "v1.0.0" as const;
export const HEALTH_WEIGHTS = { collection: .35, occupancy: .30, expenseEfficiency: .20, leaseExpiry: .15 } as const;
export const EXPENSE_BANDS = [
  { maximum: 20, score: 100 }, { maximum: 30, score: 80 },
  { maximum: 40, score: 60 }, { maximum: 50, score: 30 },
  { maximum: Number.POSITIVE_INFINITY, score: 0 },
] as const;
export const CASH_FLOW_CONFIG = { minimumMonths: 3, nearZeroRatio: .05, volatilityRatio: 1.5 } as const;
