# Final acceptance matrix: only measured evidence counts

| Check | Result | Evidence | Remaining proof |
|---|---|---|---|
| JavaScript parse | PASS | node --check on 4 principal JS files | Browser regression after update |
| Architecture/domain role tests | PASS | `node --test tests/*.test.js`: 57/57 | Cross-role RLS under actual Supabase sessions |
| Bounded read timeout and retries | PASS (mock) | `tests/resilience.test.js` | Real network outage test |
| Non-idempotent writes are not auto-retried | PASS (mock) | `tests/resilience.test.js` | Real ambiguous dispatch response reconciliation |
| Accurate dashboard count (no 120 cap) | IMPLEMENTED | `repo.count`, exact head-only API | Check on actual data and RLS scope |
| RLS policies prevent unauthorized SELECT | NOT VERIFIED | `sql/08_FINAL_VERIFICATION_READ_ONLY.sql` only inspects metadata | Staff-account tests |
| No overselling in concurrent dispatch | NOT VERIFIED | DB RPC should lock/validate | 2 simultaneous test requests in isolated test data |
| Historical order/stock reconciliation | NOT VERIFIED | Read-only SQL report | Resolve all negative remaining orders |
| C4 rendering and formal submission | PARTIAL | `docs/C4.md`, 19-Q report draft | Actual images, group info, contributions |
| Netlify published release | NOT DONE | deliberately keeping main stable | Merge/publish after acceptance |

The previous local browser testing reported by user covers normal navigation and pages. This is not a substitute for DB-side authorization/concurrency tests.
