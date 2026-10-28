# Integrated Steel Production and Operations Management System

A role-controlled factory operations web application. **University project — development version 0.2.**

## Business problem

Melting/casting, billet transfers, rebar rolling, sales and truck loading have separate operational responsibilities. Paper/manual tracking leads to delays, missing handoffs, and accidental changes to production records. The system uses one database and department-specific access to coordinate these operations.

## Main use cases

- Sign in with a staff account (Supabase Auth).
- Melting Supervisor: register a furnace heat (A/B), weight, melting start and CCM pouring time.
- Transfer Supervisor: record the heat's billet arrival at the rolling mill.
- Rolling Supervisor: record bar size 12/14/16 mm, rolling start/end and produced tons.
- Sales: manage customers and orders by bar size, quantity and price.
- Loading: record trucks, drivers, loaded quantity and dispatch status.
- Management: read-only access across the factory.
- Admin: assign department roles; make direct changes; approve or reject employees' correction/deletion requests; inspect audit logs.

## Architecture / course topics

**Architectural style:** one static web client (HTML/CSS/JavaScript) plus Supabase-hosted PostgreSQL/Auth (managed backend). This remains a modular monolith with one deployable frontend because a university-sized project does not need microservices. Boundaries are Melting, Transfer, Rolling, Sales, Dispatch, Identity/Authorization and Audit.

- **Single Responsibility (SOLID):** `models.js` (domain & validation), `repository.js` (data persistence), `app.js` (UI/control flow).
- **Repository Pattern:** `SteelRepository` wraps Supabase queries.
- **Factory/Model construction:** `new SteelRecord(table, formValues)` validates and normalizes typed domain records.
- **Observer / event-driven UI:** Supabase Auth state change listener updates the signed-in interface.
- **RLS security:** PostgreSQL enforces per-role read/insert/update/delete; hiding tabs in UI is NOT a security boundary.
- **Audit:** database triggers record mutations, including administrator-approved changes.
- **ADR:** see `docs/ADR-001-architecture.md`.

This is initial implementation; the final university report still needs an explicit before/after SOLID refactor, justified patterns, a quality scenario, design diagrams, and evaluation.

## File structure

```text
index.html                 UI entry point and script tags
style.css                  layout/styles
config.js                  Project URL + publishable key (no secrets)
models.js                  OOP domain model and validation
repository.js              Supabase repository adapter
app.js                     UI, role navigation, auth, workflows
sql/01_setup.sql           Migration from the tutorial's `heats` table
sql/02_make_admin.sql      Administrator bootstrap (replace YOUR email)
docs/ADR-001-architecture.md
```

## Setup (run SQL BEFORE publishing code)

1. **Back up your existing Supabase database**, particularly the `heats` table. The migration adds tables and columns; it does not delete earlier heats, but database migrations always deserve a backup.
2. In Supabase SQL Editor, run `sql/01_setup.sql` once. It adds roles, tables, RLS, audit and approval RPC functions. A successful run returns `Success. No rows returned`.
3. In `sql/02_make_admin.sql`, replace **both** instances of `REPLACE_WITH_YOUR_LOGIN_EMAIL` with the email account you created under Authentication > Users. Run it in SQL Editor. Verify one row is returned with `role = admin`. **Do not share this email or password in a chat.**
4. In `config.js`, replace `REPLACE_WITH_YOUR_SUPABASE_PROJECT_URL` with `https://<your-ref>.supabase.co` and replace `REPLACE_WITH_YOUR_PUBLISHABLE_KEY` with the `sb_publishable_...` value from Settings → API Keys. A publishable key is browser-visible by design; **NEVER** use `sb_secret_`, `service_role`, database password or JWT secret in GitHub/frontend files.
5. Upload the new `index.html`, `style.css`, `config.js`, `models.js`, `repository.js`, `app.js` to the **development branch** on GitHub in a single commit. `README.md` and the `sql/` and `docs/` folders should also be included in the repository. Do not edit `main` yet.
6. Locally open `index.html` to inspect the layout; live login needs network and a properly configured project URL. When ready, review changes, merge `development` → `main`, and re-enable **one** Netlify production deploy (the old production site stays online while builds are stopped).
7. For new staff: create their email/password in Supabase Authentication → Users; then sign in as admin to assign their role and active status in the **Staff & Roles** page. Newly-created accounts default to `viewer` (no production write access).

### Database migration note

The earlier tutorial used a `heats` table and policies named `Users can read own heats` and `Users can insert own heats`. This migration **replaces those per-user policies** with per-department access, while retaining the previously registered heat records. The prior test heat whose `user_id` is NULL remains visible to authorized supervisors; it has no editable "owner" and only Admin can edit/delete it.

### Safety & limitations

- All inserts/updates to production records are validated by the database and RLS. Employees can create records in their own modules but cannot directly update/delete an existing record. They can request one-field edits/deletion. Admin approvals are applied by a guarded server-side RPC.
- On this version, the Overview counts only the most recent 120 rows. It is NOT an audited production total.
- Physical inventory reconciliation, dispatch order fulfillment checks, melting transfer/rolling predictions and advanced reporting are **future milestones**. Do not use this MVP to make automated production or sales decisions without reconciliation.
- The current Supabase Free tier and Netlify usage limits still apply. Keep Netlify automated builds stopped during development.

## Manual verification checklist

- Login as admin; each module listed; save one heat.
- Refresh; record still exists in Supabase.
- Create employee users and assign their department role; log in as employee; other sections should be inaccessible.
- Employee creates a record; then requests a field edit. Confirm record does not change until Admin approves.
- Admin approves; record changes. Admin rejects a second request; no record change.
- Manager can view reports/audit but cannot add/edit/delete.
- Supabase RLS denies operations performed directly from a staff account against another module.
