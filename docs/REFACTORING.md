# Architecture refactoring record — before / after

## Before (V0.7)
`app.js` directly called `client.rpc('factory_stage', ...)` and performed UI orchestration, network transport and some validation together. Production scheduling was inline and tightly bound to the DOM.

## After (V0.8)
- Extracted an independent, testable `architecture.js` domain/application layer.
- Added `CommandFactory` validation and standardized command objects.
- Added `WorkflowService` which invokes a port and emits successful workflow events.
- Moved RPC mapping to `SupabaseWorkflowAdapter`.
- Added reusable `HeatStateMachine`, `EventBus`, `ScheduleStrategy`, inventory calculation and order stock guard.
- Added Node built-in tests using fake ports.

## Measurable outcome
The new layer can be loaded into Node with no DOM or Supabase dependency; six domain/adapter tests pass. The existing UI keeps working through a small integration change. The rest of app.js is still monolithic and the State/Strategy classes are not fully utilized by all UI paths.

## Future refactoring backlog
Split `app.js` into presentation features, add stable repository interfaces, pagination, immutable stock ledger, idempotency keys, and TypeScript interfaces. Do not classify future work as delivered.
