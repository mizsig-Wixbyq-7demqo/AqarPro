import { addDays, addMonths, daysInclusive } from "./business-date.ts";
import {isValidIsoDate} from "./validation.ts";

export const paymentFrequencies = ["monthly", "quarterly", "semi_annual", "annual", "custom"] as const;
export type PaymentFrequency = (typeof paymentFrequencies)[number];

export interface ScheduleInput {
  startDate: string;
  endDate: string;
  annualRent: number;
  frequency: PaymentFrequency;
  customInstallments?: number;
}

export interface ScheduleInstallment {
  due_date: string;
  amount_due: number;
}

const standardFrequency = {
  monthly: { months: 1, installmentsPerYear: 12 },
  quarterly: { months: 3, installmentsPerYear: 4 },
  semi_annual: { months: 6, installmentsPerYear: 2 },
  annual: { months: 12, installmentsPerYear: 1 },
} as const;

function splitCents(totalCents: number, count: number) {
  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;
  return Array.from({ length: count }, (_, index) => (base + (index >= count - remainder ? 1 : 0)) / 100);
}

function assertInput(input: ScheduleInput) {
  if (!isValidIsoDate(input.startDate) || !isValidIsoDate(input.endDate)) {
    throw new Error("تواريخ العقد غير صحيحة.");
  }
  if (input.startDate > input.endDate) throw new Error("تاريخ نهاية العقد يسبق تاريخ بدايته.");
  if (!Number.isFinite(input.annualRent) || input.annualRent <= 0) throw new Error("الإيجار السنوي يجب أن يكون أكبر من صفر.");
}

export function generatePaymentSchedule(input: ScheduleInput): ScheduleInstallment[] {
  assertInput(input);

  if (input.frequency === "custom") {
    const count = input.customInstallments ?? 0;
    const contractDays = daysInclusive(input.startDate, input.endDate);
    if (!Number.isInteger(count) || count < 1 || count > 24 || count > contractDays) {
      throw new Error("عدد الدفعات المخصصة يجب أن يكون بين 1 و24 وألا يتجاوز أيام العقد.");
    }
    const dueDates = Array.from({ length: count }, (_, index) =>
      addDays(input.startDate, Math.floor(((contractDays - 1) * index) / count)),
    );
    const totalCents = Math.round(input.annualRent * 100 * contractDays / 365);
    const amounts = splitCents(totalCents, count);
    return dueDates.map((due_date,index)=>{const amount=amounts[index];if(amount===undefined)throw new Error("تعذر توزيع قيمة الدفعات.");return{due_date,amount_due:amount};});
  }

  const config = standardFrequency[input.frequency];
  const dueDates: string[] = [];
  for (let index = 0; index < 120; index += 1) {
    const dueDate = addMonths(input.startDate, index * config.months);
    if (dueDate > input.endDate || (index > 0 && dueDate === input.endDate)) break;
    dueDates.push(dueDate);
  }
  if (!dueDates.length) throw new Error("تعذر إنشاء دفعات ضمن مدة العقد.");
  const totalCents = Math.round(input.annualRent * 100 * dueDates.length / config.installmentsPerYear);
  const amounts = splitCents(totalCents, dueDates.length);
  return dueDates.map((due_date,index)=>{const amount=amounts[index];if(amount===undefined)throw new Error("تعذر توزيع قيمة الدفعات.");return{due_date,amount_due:amount};});
}
