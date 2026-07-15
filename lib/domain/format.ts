const numberFormatter = new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 0 });
const decimalFormatter = new Intl.NumberFormat("ar-SA", { minimumFractionDigits: 0, maximumFractionDigits: 1 });

export const formatNumber = (value: number) => numberFormatter.format(value);
export const formatMoney = (value: number | null) => value === null ? "لا توجد بيانات كافية" : `${numberFormatter.format(Math.round(value))} ر.س`;
export const formatPercent = (value: number | null) => value === null ? "لا توجد بيانات كافية" : `${decimalFormatter.format(value)}٪`;

export function signedMoney(value: number | null) {
  if (value === null) return "لا توجد بيانات كافية";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${numberFormatter.format(Math.abs(Math.round(value)))} ر.س`;
}
