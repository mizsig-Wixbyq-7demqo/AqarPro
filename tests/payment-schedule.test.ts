import assert from "node:assert/strict";
import test from "node:test";
import {generatePaymentSchedule} from "../lib/domain/payment-schedule.ts";

const sum=(rows:ReturnType<typeof generatePaymentSchedule>)=>Math.round(rows.reduce((total,row)=>total+row.amount_due,0)*100)/100;

test("monthly annual lease creates twelve exact installments",()=>{
  const rows=generatePaymentSchedule({startDate:"2026-01-01",endDate:"2026-12-31",annualRent:48_000,frequency:"monthly"});
  assert.equal(rows.length,12);assert.equal(rows.at(0)?.due_date,"2026-01-01");assert.equal(rows.at(11)?.due_date,"2026-12-01");assert.equal(sum(rows),48_000);
});

test("quarterly schedule preserves cents",()=>{
  const rows=generatePaymentSchedule({startDate:"2026-02-28",endDate:"2027-02-27",annualRent:50_000.03,frequency:"quarterly"});
  assert.equal(rows.length,4);assert.equal(sum(rows),50_000.03);assert.deepEqual(rows.map(row=>row.due_date),["2026-02-28","2026-05-28","2026-08-28","2026-11-28"]);
});

test("semi annual and annual frequencies use contract dates",()=>{
  assert.equal(generatePaymentSchedule({startDate:"2026-07-15",endDate:"2027-07-14",annualRent:72_000,frequency:"semi_annual"}).length,2);
  assert.equal(generatePaymentSchedule({startDate:"2026-07-15",endDate:"2027-07-14",annualRent:72_000,frequency:"annual"}).length,1);
});

test("custom schedule spreads installments and keeps the total",()=>{
  const rows=generatePaymentSchedule({startDate:"2026-01-01",endDate:"2026-12-31",annualRent:36_500,frequency:"custom",customInstallments:5});
  assert.equal(rows.length,5);assert.equal(sum(rows),36_500);assert.equal(new Set(rows.map(row=>row.due_date)).size,5);
});

test("invalid dates, rent, and custom count are rejected",()=>{
  assert.throws(()=>generatePaymentSchedule({startDate:"2027-01-01",endDate:"2026-01-01",annualRent:1,frequency:"annual"}),/نهاية/);
  assert.throws(()=>generatePaymentSchedule({startDate:"2026-01-01",endDate:"2026-12-31",annualRent:0,frequency:"monthly"}),/أكبر من صفر/);
  assert.throws(()=>generatePaymentSchedule({startDate:"2026-01-01",endDate:"2026-12-31",annualRent:1,frequency:"custom",customInstallments:25}),/1 و24/);
});
