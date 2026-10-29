# Resilience decisions (documented; partial implementation)

**Failure mode:** RPC returns network error, 401/403, timeout, or a database constraint error.

1. **Fail closed:** no UI optimistic stock increment or dispatch success on RPC errors. `WorkflowService.run` emits `workflow.saved` only on success (covered by automated test).
2. **Atomic transactions:** use a single SQL function per stage change. Stock and order quantity must be validated in the transaction, with a concurrency lock around dispatch.
3. **No blind retries of non-idempotent writes.** A timeout might occur *after* a successful database commit. Before retry, reload the record and confirm whether the stage was saved. A future idempotency key is recommended.
4. **Read paths:** manual refresh on transient network errors; indicate stale/unavailable inventory instead of using cached numbers for approval.
5. **Authentication:** expired tokens require sign-in; never bypass role checks.
6. **Audit and alerts:** review rejected stage actions and denied permissions; future monitoring is planned.

## Tradeoff
A modular monolith with PostgreSQL transactions is currently safer than multiple services requiring distributed sagas for a student project. This is a design rationale, not an empirical scalability claim.

## Missing verification
Supabase concurrency testing, privilege escalation testing, API error mapping, recovery drills, and automated end-to-end UI tests must occur before production deployment.
