import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const migrationsDirectory = new URL("../supabase/migrations/", import.meta.url);

test(
  "foundational migrations apply from empty PostgreSQL and preserve invariants",
  { timeout: 60_000 },
  async () => {
    const database = new PGlite();

    try {
      await database.exec(`
        create schema auth;
        create table auth.users (
          id uuid primary key,
          email text
        );

        create or replace function auth.uid()
        returns uuid
        language sql
        stable
        as $$
          select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
        $$;

        create role anon nologin;
        create role authenticated nologin;
      `);

      const migrationFiles = (await readdir(migrationsDirectory))
        .filter((fileName) => fileName.endsWith(".sql"))
        .sort();

      assert.deepEqual(migrationFiles, [
        "202607150001_initial_schema.sql",
        "202607150002_security_functions_and_audit.sql",
        "202607150003_rls_policies.sql",
        "202607150004_unit_status_periods.sql",
        "202607150005_stage_five_workflows.sql",
        "202607150006_explicit_lease_termination_fields.sql",
        "202607150007_stage_six_financial_workflows.sql",
        "202607150008_financial_soft_delete_hardening.sql",
        "202607150009_stage_seven_integrity_hardening.sql",
      ]);

      for (const migrationFile of migrationFiles) {
        const sql = await readFile(new URL(migrationFile, migrationsDirectory), "utf8");
        await database.exec(sql);
      }

      const expectedTables = [
        "audit_logs",
        "expense_categories",
        "expenses",
        "lease_payment_schedules",
        "leases",
        "market_benchmarks",
        "organization_members",
        "organizations",
        "payments",
        "properties",
        "property_score_snapshots",
        "tenants",
        "unit_status_periods",
        "units",
      ];

      const tables = await database.query(`
        select table_name
        from information_schema.tables
        where table_schema = 'public'
          and table_type = 'BASE TABLE'
        order by table_name;
      `);
      assert.deepEqual(
        tables.rows.map(({ table_name: tableName }) => tableName),
        expectedTables,
      );

      const rlsTables = await database.query(`
        select c.relname as table_name
        from pg_catalog.pg_class as c
        join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relkind = 'r'
          and c.relrowsecurity
        order by c.relname;
      `);
      assert.deepEqual(
        rlsTables.rows.map(({ table_name: tableName }) => tableName),
        expectedTables,
      );

      const moneyColumns = await database.query(`
        select table_name, column_name, numeric_precision, numeric_scale
        from information_schema.columns
        where table_schema = 'public'
          and column_name in (
            'current_annual_rent',
            'annual_rent',
            'security_deposit',
            'amount_due',
            'amount_paid',
            'amount',
            'annual_market_rent',
            'lower_rent_range',
            'upper_rent_range',
            'cash_inflow',
            'cash_outflow',
            'net_cash_flow',
            'rent_gap_amount',
            'possible_annual_rent_increase'
          )
        order by table_name, column_name;
      `);
      assert.equal(moneyColumns.rows.length, 14);
      for (const column of moneyColumns.rows) {
        assert.equal(Number(column.numeric_precision), 15);
        assert.equal(Number(column.numeric_scale), 2);
      }

      const approximateNumbers = await database.query(`
        select table_name, column_name, data_type
        from information_schema.columns
        where table_schema = 'public'
          and data_type in ('real', 'double precision');
      `);
      assert.deepEqual(approximateNumbers.rows, []);

      const helpers = await database.query(`
        select p.proname, p.prosecdef, p.proconfig
        from pg_catalog.pg_proc as p
        join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname in ('is_org_member', 'has_org_role')
        order by p.proname;
      `);
      assert.equal(helpers.rows.length, 2);
      for (const helper of helpers.rows) {
        assert.equal(helper.prosecdef, true);
        assert.ok(helper.proconfig?.includes("search_path=\"\""));
      }

      const securityDefinerFunctions = await database.query(`
        select p.proname, p.proconfig
        from pg_catalog.pg_proc as p
        join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.prosecdef
        order by p.proname;
      `);
      assert.ok(securityDefinerFunctions.rows.length >= 7);
      for (const routine of securityDefinerFunctions.rows) {
        assert.ok(
          routine.proconfig?.includes("search_path=\"\""),
          `${routine.proname} must pin an empty search_path`,
        );
      }

      const policies = await database.query(`
        select count(*)::integer as count
        from pg_catalog.pg_policy as policy
        join pg_catalog.pg_class as table_class on table_class.oid = policy.polrelid
        join pg_catalog.pg_namespace as namespace on namespace.oid = table_class.relnamespace
        where namespace.nspname = 'public';
      `);
      assert.ok(policies.rows[0].count >= 49);

      const auditTriggers = await database.query(`
        select count(distinct trigger_name)::integer as count
        from information_schema.triggers
        where trigger_schema = 'public'
          and action_statement like '%write_audit_log%';
      `);
      assert.equal(auditTriggers.rows[0].count, 6);

      const ownerId = "10000000-0000-4000-8000-000000000001";
      await database.query(
        "insert into auth.users (id, email) values ($1, $2)",
        [ownerId, "owner@example.test"],
      );
      await database.query(
        "select set_config('request.jwt.claim.sub', $1, false)",
        [ownerId],
      );

      const createdOrganization = await database.query(
        "select public.create_organization($1) as id",
        ["منشأة اختبار Migrations"],
      );
      const organizationId = createdOrganization.rows[0].id;

      const ownerMembership = await database.query(
        `
          select role::text as role
          from public.organization_members
          where organization_id = $1 and user_id = $2;
        `,
        [organizationId, ownerId],
      );
      assert.deepEqual(ownerMembership.rows, [{ role: "owner" }]);

      const property = await database.query(
        `
          insert into public.properties (
            organization_id,
            name,
            property_type,
            city,
            district
          ) values ($1, $2, $3, $4, $5)
          returning id;
        `,
        [organizationId, "عمارة اختبار", "building", "الرياض", "طويق"],
      );
      await database.query(
        `
          insert into public.units (
            organization_id,
            property_id,
            unit_number,
            unit_type
          ) values ($1, $2, $3, $4);
        `,
        [organizationId, property.rows[0].id, "1", "غرفة وصالة"],
      );
      const synchronizedUnitCount = await database.query(
        "select total_units from public.properties where id = $1",
        [property.rows[0].id],
      );
      assert.equal(synchronizedUnitCount.rows[0].total_units, 1);

      await database.query(
        "select public.delete_organization($1)",
        [organizationId],
      );
      const deletedOrganization = await database.query(
        "select count(*)::integer as count from public.organizations where id = $1",
        [organizationId],
      );
      assert.equal(deletedOrganization.rows[0].count, 0);

      const layout = await readFile(`${projectRoot}/app/layout.tsx`, "utf8");
      assert.match(layout, /<html\s+lang="ar"\s+dir="rtl">/);
    } finally {
      await database.close();
    }
  },
);
