import assert from "node:assert/strict";
import {readdir,readFile} from "node:fs/promises";
import test from "node:test";
import {PGlite} from "@electric-sql/pglite";

const migrations=new URL("../supabase/migrations/",import.meta.url);
const seed=new URL("../supabase/seed.sql",import.meta.url);
const organization="20000000-0000-4000-8000-000000000001";
const property="30000000-0000-4000-8000-000000000001";
const owner="10000000-0000-4000-8000-000000000001";
const manager="10000000-0000-4000-8000-000000000002";
const accountant="10000000-0000-4000-8000-000000000003";
const viewer="10000000-0000-4000-8000-000000000004";

async function setup(){
  const database=new PGlite();
  await database.exec("create schema auth;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create role anon nologin;create role authenticated nologin;");
  for(const file of (await readdir(migrations)).filter(name=>name.endsWith(".sql")).sort())await database.exec(await readFile(new URL(file,migrations),"utf8"));
  await database.exec(await readFile(seed,"utf8"));
  return database;
}

async function as(database,userId){
  await database.exec("reset role;set role authenticated");
  await database.query("select set_config('request.jwt.claim.sub',$1,false)",[userId]);
}

test("stage six payment allocation is atomic and role protected",{timeout:60_000},async()=>{
  const database=await setup();
  try{
    const scheduleResult=await database.query(`
      select schedule.id, schedule.amount_due::numeric as amount_due
      from lease_payment_schedules as schedule
      where schedule.organization_id=$1
        and schedule.status<>'cancelled'
        and not exists(select 1 from payments where payment_schedule_id=schedule.id and deleted_at is null)
      order by schedule.due_date desc
      limit 1
    `,[organization]);
    const schedule=scheduleResult.rows[0];
    assert.ok(schedule);

    await as(database,accountant);
    await assert.rejects(()=>database.query("select record_schedule_payment($1,$2,1,'2099-01-01','','','')",[organization,schedule.id]),/future/i);
    const partial=await database.query("select record_schedule_payment($1,$2,1000,'2026-07-15','تحويل بنكي','STAGE-6','دفعة جزئية') id",[organization,schedule.id]);
    const paymentId=partial.rows[0].id;
    assert.equal((await database.query("select status::text status from lease_payment_schedules where id=$1",[schedule.id])).rows[0].status,"partially_paid");
    await assert.rejects(()=>database.query("select record_schedule_payment($1,$2,$3,'2026-07-15','','','')",[organization,schedule.id,Number(schedule.amount_due)]),/remaining|exceeds/i);
    await assert.rejects(()=>database.query("update payments set deleted_at=now() where id=$1",[paymentId]),/deletion state|Role|approved payment fields/i);
    await assert.rejects(()=>database.query("select void_payment($1,$2)",[organization,paymentId]),/cannot void|Role/i);

    await as(database,viewer);
    await assert.rejects(()=>database.query("select record_schedule_payment($1,$2,1,'2026-07-15','','','')",[organization,schedule.id]),/cannot record|Role/i);

    await as(database,manager);
    await database.query("select void_payment($1,$2)",[organization,paymentId]);
    assert.ok((await database.query("select deleted_at is not null deleted from payments where id=$1",[paymentId])).rows[0].deleted);
    await database.query("delete from payments where id=$1",[paymentId]);
    assert.equal((await database.query("select count(*)::int count from payments where id=$1",[paymentId])).rows[0].count,1);
    assert.notEqual((await database.query("select status::text status from lease_payment_schedules where id=$1",[schedule.id])).rows[0].status,"partially_paid");

    await as(database,owner);
    await database.query("select record_schedule_payment($1,$2,$3,'2026-07-15','تحويل بنكي','STAGE-6-FULL','تحصيل كامل')",[organization,schedule.id,Number(schedule.amount_due)]);
    assert.equal((await database.query("select status::text status from lease_payment_schedules where id=$1",[schedule.id])).rows[0].status,"paid");
    assert.equal(Number((await database.query("select sum(amount_paid) total from payments where payment_schedule_id=$1 and deleted_at is null",[schedule.id])).rows[0].total),Number(schedule.amount_due));
  }finally{
    await database.exec("reset role");
    await database.close();
  }
});

test("stage six expenses, market sources, and snapshots enforce their role matrix",{timeout:60_000},async()=>{
  const database=await setup();
  try{
    const category=(await database.query("select id from expense_categories where organization_id=$1 order by id limit 1",[organization])).rows[0].id;
    await as(database,accountant);
    await assert.rejects(()=>database.query("insert into expenses(organization_id,property_id,expense_category_id,amount,expense_date,payment_status,description,created_by) values($1,$2,$3,10,'2099-01-01','paid','تاريخ مستقبلي',$4)",[organization,property,category,accountant]),/future/i);
    const expense=(await database.query("insert into expenses(organization_id,property_id,expense_category_id,amount,expense_date,payment_status,description,created_by) values($1,$2,$3,975,'2026-07-15','paid','مصروف اختبار المرحلة السادسة',$4) returning id",[organization,property,category,accountant])).rows[0].id;
    assert.ok(expense);
    await assert.rejects(()=>database.query("update expenses set deleted_at=now() where id=$1",[expense]),/deletion state|Role|approved expense fields/i);

    await as(database,viewer);
    await database.query("update expenses set amount=1000 where id=$1",[expense]);
    assert.equal(Number((await database.query("select amount from expenses where id=$1",[expense])).rows[0].amount),975);

    await as(database,manager);
    await database.query("update expenses set deleted_at=now() where id=$1",[expense]);
    assert.ok((await database.query("select deleted_at is not null deleted from expenses where id=$1",[expense])).rows[0].deleted);
    await database.query("delete from expenses where id=$1",[expense]);
    assert.equal((await database.query("select count(*)::int count from expenses where id=$1",[expense])).rows[0].count,1);
    const benchmark=(await database.query("insert into market_benchmarks(organization_id,city,district,unit_type,annual_market_rent,source_name,source_type,period_start,period_end,created_by) values($1,'الرياض','طويق','شقة',57000,'اختبار موثق','manual_estimate','2026-07-01','2026-07-15',$2) returning id",[organization,manager])).rows[0].id;
    await assert.rejects(()=>database.query("insert into market_benchmarks(organization_id,city,district,unit_type,annual_market_rent,source_name,source_type,period_start,period_end,created_by) values($1,'الرياض','طويق','شقة',57000,'مرجع مستقبلي','manual_estimate','2099-01-01','2099-01-02',$2)",[organization,manager]),/future/i);
    await database.query("delete from market_benchmarks where id=$1",[benchmark]);
    assert.equal((await database.query("select count(*)::int count from market_benchmarks where id=$1",[benchmark])).rows[0].count,1);

    await database.query("insert into property_score_snapshots(organization_id,property_id,score_date,cash_flow_status,input_snapshot,output_snapshot) values($1,$2,'2026-07-15','insufficient_data','{}','{}')",[organization,property]);
    await assert.rejects(()=>database.query("insert into property_score_snapshots(organization_id,property_id,score_date,cash_flow_status,input_snapshot,output_snapshot) values($1,$2,'2026-07-15','insufficient_data','{}','{}')",[organization,property]));

    await as(database,owner);
    await database.query("delete from market_benchmarks where id=$1",[benchmark]);
    assert.equal((await database.query("select count(*)::int count from market_benchmarks where id=$1",[benchmark])).rows[0].count,0);
  }finally{
    await database.exec("reset role");
    await database.close();
  }
});
