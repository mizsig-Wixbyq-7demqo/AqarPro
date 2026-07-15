import {isValidIsoDate} from "./validation.ts";

const BUSINESS_TIME_ZONE = "Asia/Riyadh";

export function getRiyadhToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function parseIsoDate(value: string) {
  if(!isValidIsoDate(value))throw new Error("تاريخ ISO غير صحيح.");
  const year=Number(value.slice(0,4)),month=Number(value.slice(5,7)),day=Number(value.slice(8,10));
  return new Date(Date.UTC(year, month - 1, day));
}

export function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function addDays(value: string, days: number) {
  const date = parseIsoDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

export function addMonths(value: string, months: number) {
  const date = parseIsoDate(value);
  const originalDay = date.getUTCDate();
  const firstOfTarget = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(firstOfTarget.getUTCFullYear(), firstOfTarget.getUTCMonth() + 1, 0)).getUTCDate();
  firstOfTarget.setUTCDate(Math.min(originalDay, lastDay));
  return toIsoDate(firstOfTarget);
}

export function daysInclusive(start: string, end: string) {
  return Math.floor((parseIsoDate(end).getTime() - parseIsoDate(start).getTime()) / 86_400_000) + 1;
}

export function getMonthBounds(today = getRiyadhToday()) {
  const date=parseIsoDate(today),year=date.getUTCFullYear(),month=date.getUTCMonth()+1;
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const next = toIsoDate(new Date(Date.UTC(year, month, 1)));
  return { start, next };
}

export function formatArabicDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ar-SA", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parseIsoDate(value));
}

export function formatArabicMonth(value: string) {
  return new Intl.DateTimeFormat("ar-SA", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(parseIsoDate(value));
}
