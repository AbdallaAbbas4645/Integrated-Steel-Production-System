# Instructor requirements — evidence matrix (V0.9)

**Important:** This is a mapping from requirements discussed in the project conversation. We have not independently verified the professor's original rubric, scoring, or deadlines. Do not label a requirement "accepted" before checking the original handout.

| Requirement | Evidence in repository | Demonstration / verification | Status |
|---|---|---|---|
| OOP | `architecture.js`: classes `HeatStateMachine`, `CommandFactory`, `EventBus`, `ScheduleStrategy`, `WorkflowService` | Run `node --test tests/*.test.js` | Implemented in domain layer |
| SRP / SOLID | `docs/SOLID.md`, `architecture.js`, `repository.js` | Review separation of validation / service / transport | Partial: monolithic `app.js` remains |
| Creational pattern | `CommandFactory` in `architecture.js` | Validation tests create immutable commands | Implemented |
| Structural pattern | `SupabaseWorkflowAdapter`, repository adapter | Fake-client contract tests | Implemented |
| Behavioral pattern | `HeatStateMachine`, `EventBus`, `ScheduleStrategy` | Transition/event/schedule tests | Implemented |
| Domain model and boundaries | `docs/DOMAIN.md`, `docs/CONTEXT_MAP.md` | Explain production vs commercial boundaries | Documented; enforcement partially implemented |
| Single service / decomposition rationale | `docs/ARCHITECTURE.md` | Explain modular monolith tradeoffs | Documented |
| Resilience | `docs/RESILIENCE.md` | Fake backend failure and retry policy tests | Documented, implementation partial |
| ADR | `docs/ADR-001.md` through `ADR-003.md` | Explain tradeoffs in presentation | Drafts prepared |
| Quality attribute scenario | `docs/QUALITY.md`, `docs/ACCEPTANCE_CRITERIA.md` | Verify via metrics and test cases | Documented; live validation pending |
| Refactoring evidence | `docs/REFACTORING.md` | Show old workflow RPC calls versus service/adapter | Partial |
| C4 | `docs/C4.md` | Render Mermaid and verify links | Draft |
| Instructor report | `reports/README.md` | Match to actual assignment rubric | Draft |
| Deployment, role / RLS security | SQL migration and `docs/SECURITY_REVIEW.md` | Live Supabase E2E role matrix | Pending |

**Submission gate:** Each rubric row must have: code location, evidence/test result, and one paragraph explaining why the pattern was used. Never claim finished until the instructor's actual rubric is checked.
