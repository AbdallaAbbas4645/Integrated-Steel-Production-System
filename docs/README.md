# Software Design & Architecture — Evidence index

> **Important**: This evidence package is built from the requirements previously discussed with the student. The verbatim university rubric is **not provided in the current artifact**; the exact number/categories of patterns, word counts, due dates and submission conventions **must be reconciled with the instructor's original PDF**. Do not assert full compliance until that reconciliation.

## Traceability matrix
| Expected deliverable | Implementation / evidence | Verification | Status |
|---|---|---|---|
| OOP | `architecture.js`: HeatStateMachine, CommandFactory, EventBus, ScheduleStrategy, SupabaseWorkflowAdapter, WorkflowService; `models.js`: SteelRecord | `node --test tests/domain.test.js` | Implemented, needs rubric review |
| SOLID | `docs/SOLID.md` and runtime classes | Unit tests and code inspection | Partially demonstrated; OCP and ISP are design choices, not formally proven |
| Creational pattern | Factory Method (`CommandFactory.create`) | Command tests | Implemented |
| Structural pattern | Adapter (`SupabaseWorkflowAdapter`), Repository (`SteelRepository`) | Mock RPC test | Implemented |
| Behavioral patterns | State (`HeatStateMachine`), Observer (`EventBus`), Strategy (`ScheduleStrategy`) | Transition, observer and schedule tests | Implemented in domain; State guidance not wired into every UI button |
| Domain Model / Bounded Context | `docs/DOMAIN.md` | Design inspection | Documented |
| Single service rationale | `docs/ARCHITECTURE.md` | Decision review | Documented |
| Resilience | Atomic RPC and transaction-level lock; no automatic network retries for non-idempotent writes | Database integration tests outstanding | Partial, do not claim complete |
| ADR | `docs/ADR-001.md`, `docs/ADR-002.md`, `docs/ADR-003.md` | Human review | Documented |
| Quality Attribute Scenario | `docs/QUALITY.md` | Integration measurement pending | Defined, not measured |
| Architecture refactoring | `docs/REFACTORING.md`, old V0.7 vs new V0.8 | Diff + unit tests | Documented |
| C4 architecture | `docs/C4.md` (Mermaid source) | Mermaid render | Documented |
| Testing | `tests/domain.test.js`, `docs/TEST_PLAN.md` | Node.js built-in test runner | 6 automated domain tests; live Supabase pending |
| Report | `reports/README.md` | Instructor review | Draft, not final submission |

## Exact verification command
Install Node.js 20+ or use Node.js 22. From the extracted project directory:

`node --test tests/domain.test.js`

Open `index.html` for UI review. Login and database behavior needs a real Supabase environment. **Do not run the SQL on production without full migration backup and staging tests.**
