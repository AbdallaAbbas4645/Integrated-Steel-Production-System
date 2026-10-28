# ADR-001 — Modular web client with Supabase managed backend

**Status:** Accepted (initial scope, October 2026)

## Context
The course evaluates software architecture and design choices, not feature count alone. The system coordinates melting/casting, billet transfer, rolling, sales and loading, with per-role permissions and admin-reviewed corrections. The student has previously used HTML/CSS/JavaScript on Netlify and Supabase.

## Decision
Deploy a static JavaScript frontend on Netlify. Put data, authentication, row-level security, guarded admin approval functions and audit triggers in Supabase PostgreSQL. Keep frontend separation into domain (`models.js`), persistence (`repository.js`) and presentation/workflow (`app.js`). Do **not** split the application into microservices yet.

## Rationale
- A single deployable frontend and managed database are understandable and adequate for a class project.
- RLS protects departmental boundaries at the database, not only in browser UI.
- The Repository Pattern isolates Supabase details from the domain model and page logic.
- Server-side approval RPCs ensure pending employee requests cannot directly change records.
- Netlify/Supabase Free tiers keep development costs small, when production deploys are batched.

## Tradeoffs & risks
- Reliance on Supabase service availability and SDK/CDN. Auth requests should handle network errors visibly; a later version could self-host the SDK bundle.
- All modules share one DB; a large industrial deployment may need queuing, auditing retention policy, backup/restore testing and stronger availability guarantees.
- Operational figures are not yet reconciled against physical inventory or order fulfillment. The MVP is not a source of truth for financial billing.

## Quality attribute scenario
**Security**: Given an authenticated rolling supervisor, when they attempt an HTTP update or delete on the `heats` table, Postgres RLS must reject or affect zero rows; the only permitted change to an existing owned record is a pending edit request, which must not modify source data until the administrator approves it. Test with two roles and verify audit logs.

## Revisit in later sprint
Add a documented SOLID before/after refactor, C4 context/container diagrams, retry strategy for network calls, resilient offline read-only UI, and test coverage for authorization policies.
