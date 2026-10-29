# SteelOps V1.0 Candidate — University-first consolidation

This archive is an integration candidate based on V0.9 + the latest staff UX patch. It contains **no real credentials**, no direct deploy and **no new write migration**. The revised V0.8 migration was reported as executed in the user's Supabase project, but we cannot independently verify it remotely. Old migration files retained for audit/reference only; do not run again.

### What changed
- Consolidated two UI/role patch files with V0.9 source/documents/tests (avoids mixing different local versions).
- Added a fail-closed **navigation guard** to `app.js` (prevents direct client navigation to hidden view; NOT a database authorization control).
- Added automated role tests for 7 roles and six operational record types.
- Added read-only PostgreSQL security/order-overfill audit and documented reconciliation warning about order 090.
- Added explicit role matrix, final live acceptance checklist and university evidence checklist.

### One-time local testing
1. Keep a backup copy of your working local app directory.
2. Unzip this archive. Copy existing working **local-only** `config.js` into this directory (never upload secrets; use only sb_publishable key).
3. Open index.html. Test account navigation and read-only pages. **It connects to your actual Supabase DB.**
4. For tests: if Node.js is available `node --test tests/*.test.js`.
5. If satisfied, GitHub `development` → upload changed files/matching folders from this archive, excluding config.* and obsolete SQL migrations; commit as one update.
6. No Netlify deployment or production SQL until role/RLS verification is complete.

### Remaining before final university submission
Obtain exact instructor rubric, add names/screenshots, render C4 diagrams, date evidence, pass authenticated database role tests, reconcile order 090, complete end-to-end test and document results. Live tests are not included in the automated passing total.
