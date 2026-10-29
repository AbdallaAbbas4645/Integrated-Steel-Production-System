# Implemented resilience pattern (Module 8)

`architecture.js` implements `resilientRead()`: timeout (default 8 seconds), up to two retries, exponential delays (150/300 ms), and selective retry for transient network, 408, 429 and 5xx errors. Permanent authorization failures are not retried. `repository.js` uses this policy for records, profiles, and count reads; `SupabaseWorkflowAdapter.inventory()` uses it for inventory reads. **Writes are deliberately not retried** because a timeout can hide a committed transaction. A duplicate dispatch would be dangerous.

Evidence: `tests/resilience.test.js` (network recovery; no retry on 403; timeout; writes executed once; observer event emitted on success). Client timeout only stops waiting: it does **not** cancel the underlying HTTP request. Therefore this is intentionally limited to read-only operations. Production write idempotency is not implemented yet. Operator must reload and reconcile uncertain write outcomes.

## Quality evaluation -> targeted refactor (Module 10)

Original overview called `repo.fetch(table)` (max 120 records) and displayed count as `120+` for larger tables. This gave an inaccurate summary and fetched many full rows needlessly. Updated overview calls `repo.count(table)` with Supabase `{count:'exact',head:true}`. This removes the 120-row cap and avoids transferring record bodies. **Evaluation method**: deterministic tests exercise retry/failure behavior and check the source for the exact-count path. Large dataset latency remains unmeasured against a real backend. Do not claim a 3-second SLA without a benchmark.

## Outstanding live checks

1. Confirm per-role RLS on SELECT and RPC writes using separate staff accounts (UI hiding alone is insufficient).
2. Simulate 2 concurrent dispatch requests over the last available tons; exactly one should commit.
3. Verify customer/order stock reconciliation before any real dispatch (historical order 090 previously showed -5 tons remaining).
4. Test network loss during a write and reconcile before manually retrying.
