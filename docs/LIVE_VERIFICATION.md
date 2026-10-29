# Final live verification: not yet executed

Use a non-production tenant for mutating tests if possible; project currently uses Supabase Free. The local file `index.html` still connects to the configured production database. For production, perform the read-only checklist before requesting permission to create test records.

## Read-only checks
1. Sign in as each of 7 accounts. Verify the role matrix in `ROLE_MATRIX.md` and that hidden pages cannot be opened by manipulating navigation.
2. In Supabase SQL Editor run `sql/07_SECURITY_AUDIT_READ_ONLY.sql`. Export results. Review RLS policies and privileged functions for missing controls.
3. Read `heats`, `transfers`, `rolling_batches` and matched sales orders; reconcile opening production and dispatched quantities without deleting anything.
4. Confirm `factory_inventory` for 12/14/16mm matches SQL aggregate totals; check 090 over-delivery (historical negative remaining quantity) and its source.
5. Confirm no secret or service_role key in Git history. Publishable key is not a secret, but is protected solely by RLS.

## Mutating acceptance (requires explicit authorization and backups)
- Create labeled test heat and record 4 stages; ensure no skipped transition.
- Transfer start and arrive; reject duplicate start; arrive > heat weight rejected.
- Rolling start and finish; reject duplicated start, unexpected size and tons exceeding transfer.
- Sales order then dispatch; reject stock shortage, exceeded order and wrong employee role; check atomicity with two concurrent requests.
- Staff member requests old-record correction; administrator approves one and rejects another, verify `audit_log` actor/changes.
- Load app in a fresh browser, check English date/time control and refresh persistence.

## Acceptance status
**Automated domain tests run in this release; live authenticated API/RLS and UI tests are pending.** Do not label the system production-ready or submit as fully verified until these cases have dated evidence and the exact professor rubric is checked.
