# Acceptance criteria — demo script

## Instructor demo (code and documentation)
1. Explain one-sentence business problem and actors.
2. Show C4 context, container and component view (`docs/C4.md`).
3. Show domain contexts (`docs/CONTEXT_MAP.md`).
4. Demonstrate `CommandFactory` validation and immutable command.
5. Demonstrate `HeatStateMachine` rejecting invalid transitions.
6. Demonstrate `SupabaseWorkflowAdapter` with a fake RPC, satisfying dependency inversion.
7. Demonstrate Observer via `EventBus` event publication after successful save only.
8. Demonstrate Schedule Strategy using 210/150/70/60-minute planning figures and avoid treating combined cycle as independent melting time.
9. Run `node --test tests/*.test.js` and show passing output.
10. Present ADR decisions, resilience limitations, and known gaps rather than claiming perfect completion.

## Operational E2E (not yet proven)
- Login for admin, melting, transfer, rolling, sales, loading, and read-only management.
- A user must be prevented from writing outside assigned department.
- Heat: start melting → end melting → start casting → end casting.
- Transfer: start transfer → confirm arrived quantity.
- Rolling: start → finish with confirmed finished tons and diameter.
- Inventory increases by produced tons and decreases by loaded / dispatched tons without going below zero.
- Sales order must not ship more than ordered quantity.
- Edit request from non-admin requires admin approval and audit.
- Concurrent dispatch attempts for same stock must not oversell.

**Do not perform the operational E2E on the production database with live records until legacy data and migration have been reviewed.**
