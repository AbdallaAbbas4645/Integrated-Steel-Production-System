# SteelOps — Software Design & Architecture Project Report (Draft)

## 1. Project summary
SteelOps is a role-based production and operations management prototype for a steel factory, starting from furnace melts and casting at a shared CCM, tracking billet transport and rolling, recording finished goods, sales orders and truck dispatch, with administrator-approved correction requests and audit trail.

## 2. Problem statement
Without a shared timeline and trustworthy stage transitions, melting, transport, rolling, sales and dispatch may have inconsistent records. SteelOps links each operation to a heat and each delivery to a sales order, and separates read-only users from authorized operators.

## 3. Stakeholders and roles
Administrator; Melting Supervisor; Billet Transfer; Rolling Supervisor; Sales; Loading & Dispatch; Management read-only. Each staff member logs in with separate Supabase Auth identity. Database role must not be inferred from UI alone.

## 4. Domain model and boundaries
See `docs/DOMAIN.md` for Heat, Transfer, Rolling Batch, Sales Order, Dispatch and Staff aggregates and invariants. Logical bounded contexts are Production, Logistics, Rolling, Commercial, Fulfillment and Governance.

## 5. Architecture
Managed-backend modular single service; `index.html`, `app.js`, `models.js`, `architecture.js`, `repository.js`; Supabase authentication, RLS, RPC and PostgreSQL. Rationale in `docs/ADR-001.md`; Mermaid C4 diagrams in `docs/C4.md`.

## 6. OOP, SOLID and patterns
`architecture.js` implements Factory Method (`CommandFactory`), Adapter (`SupabaseWorkflowAdapter`), Observer (`EventBus`), State (`HeatStateMachine`), Strategy (`ScheduleStrategy`) and an application service using dependency inversion (`WorkflowService`). `repository.js` isolates CRUD from UI. Refer to `docs/SOLID.md` and unit tests. The state machine is not yet the authority for every UI transition — the server RPC enforces transition conditions.

## 7. Resilience and consistency
Server checks roles and quantity; transaction-level advisory lock prevents simultaneous stock updates from passing against the same balance. Non-idempotent writes are not automatically retried. Staging needs concurrent dispatch tests and idempotency enhancement. `docs/QUALITY.md` gives explicit testable quality scenarios.

## 8. Architectural decisions
Three ADRs document deployment, server-authoritative workflow, and computed inventory. See `docs/ADR-001.md`, `ADR-002.md`, `ADR-003.md`.

## 9. Refactoring
Compared with V0.7, extracted standalone testable domain/application components while retaining browser UI. Detailed before/after is documented in `docs/REFACTORING.md`.

## 10. Testing
Six automated unit tests passed locally using Node. **Supabase RLS and integration tests are not yet executed**. Execute the acceptance checklist in `docs/TEST_PLAN.md` before reporting functionality as verified.

## 11. Limitations and next work
One transfer and one rolling batch per heat, no split by steel size, no immutable finished-goods ledger, no guaranteed delivery idempotency, no production dashboard pagination or complete C4 diagram export. No claim of production-grade readiness.

## 12. Submission checklist
Match instructor's actual assignment PDF, add student/team information, screenshots, GitHub commit hash, rendered diagrams, execution/test evidence, and individual responsibilities. This is a draft, not a confirmed final rubric-compliant submission.
