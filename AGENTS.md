# AqarPro agent instructions

These instructions apply to the entire repository.

## Product and scope

- AqarPro is an Arabic, RTL, multi-tenant rental-property operations and financial performance application.
- Keep all user-facing product copy in clear Arabic unless a requirement says otherwise.
- Expand an English acronym at first use in user-facing documentation.
- Phase one excludes direct Ejar integration, loans, DSCR, document uploads, external notifications, banking, AI scoring, and mobile-native apps.
- Do not silently remove a requested core capability in the name of simplification.

## Architecture

- Use Next.js App Router, TypeScript strict mode, Supabase Auth, PostgreSQL, and Tailwind CSS.
- Keep `<html lang="ar" dir="rtl">` in the root layout.
- Use `Asia/Riyadh` for business-date presentation and period boundaries; keep stored timestamps as `timestamptz`.
- PostgreSQL migrations in `supabase/migrations/` are the source of truth for the data model.
- Every tenant-owned sensitive table must carry `organization_id uuid not null`; `organizations` is the tenant root and is keyed by `id`.
- All money columns must use `numeric(15,2)`, never `float`, `real`, or `double precision`.
- Use composite foreign keys that include `organization_id` for tenant-owned relationships.
- Normal application reads must exclude records with a non-null `deleted_at`.

## Naming

- TypeScript modules: `kebab-case.ts` or `kebab-case.tsx`.
- React components and TypeScript types: `PascalCase`.
- Functions and variables: `camelCase`.
- PostgreSQL objects, columns, policies, and SQL functions: `snake_case`.
- Migrations: `YYYYMMDDHHMM_description.sql`; append new migrations only.
- Tests: `*.test.ts`, `*.test.tsx`, or `*.test.mjs`.

## Security invariants

- Never commit secrets, real credentials, JWTs, personal data, or service-role keys.
- Never use a service-role key in browser code.
- Never depend on a nonexistent function such as `auth.org_id()`; use `auth.uid()` plus `organization_members`.
- Membership alone is insufficient for writes. Every write policy must also enforce an allowed application role.
- Keep helper functions such as `is_org_member(uuid)` and `has_org_role(uuid, text[])` reusable, `security definer`, and pinned to an empty search path.
- Enable RLS on every sensitive table. Add explicit policies; do not rely on application filtering.
- Do not permit direct `organization_id` mutation. A future transfer must use a reviewed, owner-only, audited procedure.
- Do not use `select *` for sensitive application queries.
- Preserve append-only score inputs/outputs and formula versions.
- Financial changes listed in `docs/security.md` must remain audited.

## Migration rules

- Never edit an old migration after it has been applied or reviewed. Create a new forward-only migration.
- Migrations must run from an empty database in filename order.
- Use foreign keys, check constraints, scoped unique indexes, and database-level role enforcement where RLS alone cannot restrict changed columns.
- Do not put secrets or production user identifiers in migrations or seed SQL.
- Keep Seed Data in `supabase/seed.sql`; use deterministic fictional IDs and Arabic fictional content.

## Commands

```bash
npm run supabase:start
npm run db:reset
npm run db:migrate
npm run db:lint
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
```

## Definition of done for every task

1. The requested slice is implemented without starting later tasks.
2. Relevant documentation and migrations are updated.
3. Tenant isolation and role effects are considered for every data operation.
4. No secret or real personal data is introduced.
5. `npm run lint`, `npm run typecheck`, relevant tests, and `npm run build` pass.
6. If a migration changed, apply all migrations from an empty database and inspect failures before handoff.
7. Report created/changed files, security implications, assumptions, and remaining risks.
