# Architecture overview

## Deployment choice
A modular **single-client / managed-backend** application was selected for a university project and early factory prototype. UI is plain JavaScript/CSS/HTML; authentication, PostgreSQL, RLS and transactional workflows use Supabase. Hosting may be Netlify when tested. Separate microservices would require operational complexity without a clear academic or operational benefit at this scale.

## Layers
- **Presentation**: `index.html`, `style.css`, `app.js` (DOM, forms, cards, role-dependent views).
- **Domain**: `models.js` (`SteelRecord`), `architecture.js` (`HeatStateMachine`, `ScheduleStrategy`, `CommandFactory`, `inventoryFrom`).
- **Application**: `architecture.js` (`WorkflowService` + `EventBus`), shared errors.
- **Ports/adapters**: `SupabaseWorkflowAdapter`, `SteelRepository`.
- **Persistence authority**: `factory_stage` / `factory_inventory` PostgreSQL functions, RLS, policies; DB must be tested before claiming full enforcement.

## Design patterns actually used
`CommandFactory.create` (Factory Method), `SupabaseWorkflowAdapter` (Adapter), `SteelRepository` (Repository), `EventBus` (Observer), `HeatStateMachine` (State), `ScheduleStrategy` (Strategy). Actual workflow UI calls `WorkflowService.run`, which uses CommandFactory → Adapter → RPC. State pattern is currently used and unit-tested in the domain layer; the UI still derives stage buttons from database timestamps, so don't claim the State class drives all UI navigation.

## Reliability and security boundaries
- Authentication is Supabase Auth. Each request gets current user identity via `auth.uid()` in secure RPC.
- `factory_stage` validates role and quantities; SQL operates in a DB transaction and serializes stock-impacting updates with an advisory lock.
- **No retry of write operations** on ambiguous network failures: avoid duplicate dispatch until state is re-fetched.
- Database migration uses `SECURITY DEFINER`: review schema, grants, search path, RLS and function owner with a DB administrator before running.
- CSV exports are not full schema/policy backups.
- Never ship service-role keys, user passwords, or live private config in GitHub.
