# Test plan (do not equate unit passing with production readiness)

## Automated
From extracted folder, run `node --test tests/domain.test.js`. Six tests cover transition validation, Factory command validation including Arabic digits, forecast math, inventory, observer/service with fake adapter, RPC adapter shape.

## Manual integration / acceptance — staging Supabase ONLY
1. Authenticate as Admin; verify `profiles` displays all seven existing roles correctly.
2. Attempt `dispatch` as melting role using browser session; expect unauthorized, no rows.
3. Create new heat, start/end melt and casting, check Ready for Transfer.
4. As transport, start transfer; confirm arrival with 25 t. Try duplicate start; expect rejection.
5. As rolling, start 12-mm rolling; end with 24 t; confirm 24 t finished inventory.
6. As sales, create customer and order for 20 t of 12-mm with proper payment term.
7. As loading, dispatch 10 t; assert inventory 14, remaining order 10. Try dispatch of 15 t, expect rejection.
8. Open two sessions and try to over-dispatch remaining stock simultaneously; only valid operations should persist.
9. Staff makes change request, Admin approves/rejects; confirm audit record and old/new snapshots.
10. Login as Management; ensure no create/edit/dispatch access even through RPC.
11. Reload Chrome; verify persistence. Test back/forward, error notifications and stale data refresh.
12. Check existing historic data before/after migration and verify no loss.

## SQL-specific preflight
Check existing constraints on `transfers`, `rolling_batches`, `sales_orders`, `loading_events`, function owner grants, triggers and the current RLS policy definitions. Stage migration in a separate DB. CSV exports alone cannot restore functions/policies. Compare row counts and records, then test rollback on staging before considering deployment.
