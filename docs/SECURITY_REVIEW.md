# Security review / data integrity checklist

- [x] Browser uses Supabase publishable key only; `config.js` must not be committed.
- [x] Architecture adapter centralizes new workflow RPC actions.
- [ ] Live RLS role matrix verified with all seven users.
- [ ] `admin_set_staff_role` function verified to reject unauthorized changes.
- [ ] Privileges for direct table INSERT/UPDATE/DELETE inspected post-migration.
- [ ] Workflow SQL functions verified SECURITY DEFINER have safe search path and trusted owner.
- [ ] Change request approval + audit history tested with a non-admin.
- [ ] Existing legacy loaded shipments and inventory reconciliation checked.
- [ ] Schema backup and restoration approach tested.

## Risk register
| Risk | Impact | Mitigation |
|---|---|---|
| Wrong role gains admin privileges | Critical | Check role-assignment RPC and RLS under employee login |
| Double click dispatch | High | Server-side atomic validation; E2E parallel request test pending |
| Legacy loaded shipment consumes stock with no production record | High | Reconcile opening stock and past dispatches before production use |
| Schema migration breaks V0.6 | High | Development branch, reviewed migration, baseline snapshots; do not execute blindly |
| `file://` browser compatibility | Medium | Prefer local server for cross-browser testing where available |
