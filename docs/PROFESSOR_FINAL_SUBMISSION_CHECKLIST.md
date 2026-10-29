# University project final evidence checklist

**Unverified prerequisite:** the original course rubric is not present in this distribution; this evidence is based on requirements discussed in chat, so independent line-by-line sign-off is necessary.

| Requested theme | In-repository evidence | Final validation |
|---|---|---|
| OOP + SOLID | `architecture.js`, `docs/SOLID.md` | Explain each class and dependence; identify remaining monolithic app.js |
| Creational | `CommandFactory` (`architecture.js`) | Tests create validated immutable command |
| Structural | `SupabaseWorkflowAdapter`, `repository.js` | Test fake client adapter |
| Behavioral | `HeatStateMachine`, `EventBus`, `ScheduleStrategy` | Test transitions, events and timing |
| DDD domain / bounded contexts | `docs/DOMAIN.md`, `docs/CONTEXT_MAP.md` | Explain heat and order boundaries |
| Modular service choice | `docs/ARCHITECTURE.md` | Contrast single-service vs microservices |
| Resilience | `docs/RESILIENCE.md` | Distinguish designed from tested; concurrency/idempotency are not signed off |
| Architecture decision records | `docs/ADR-001.md` through `ADR-003.md` | Present consequences and alternatives |
| Quality scenario | `docs/QUALITY.md` | Run measurable scenario, attach evidence |
| Refactoring | `docs/REFACTORING.md`, `architecture.js` | Demonstrate before-and-after |
| C4 context/container/component | `docs/C4.md` | Render diagrams and capture image for submission |
| Report | `reports/README.md` | Add team, professor, class, screenshots, test outputs, references |
| Git evidence | Development Git branch commit history | Capture final commit and URL |
| Access & audit | `docs/ROLE_MATRIX.md`, `sql/07_SECURITY_AUDIT_READ_ONLY.sql` | All 7 logins live test pending |

**Never claim 100% complete from this checklist alone**. Acceptance requires evidence, exact rubric and end-to-end test completion.
