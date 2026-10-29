# SteelOps — consolidated implementation handoff

This package is based directly on the user-provided latest `development` GitHub archive, not a guessed older version.

## What changed
- `architecture.js`: bounded read-only retries + timeout, with no unsafe automatic write retries.
- `repository.js`: uses resilient reads and an exact Supabase count API.
- `app.js`: overview now displays exact totals rather than a misleading 120-row sample.
- `index.html`: ensures the architecture module loads before the repository.
- `tests/resilience.test.js`: automated failure/timeout tests.
- `docs/RESILIENCE_IMPLEMENTATION.md`: linked professor evidence, quality-driven refactoring and limitations.
- `reports/README.md`: 19-question professor-aligned DRAFT, not final submission. Group number / real contributions / screenshots must be verified by students.

## Windows / GitHub
1. Make a backup copy of the currently working local project folder.
2. Extract this ZIP to a new folder. Copy your working local `config.js` **only to the extracted folder**; it is intentionally excluded from this ZIP.
3. Open local `index.html`; verify sign-in, all pages and overview count. Then use a test-only record to exercise a change request (if safe).
4. Upload only changed files to GitHub branch `development` and Commit changes. Do not upload local secrets or keys; do not replace your live config.
5. Do not merge to `main` or deploy on Netlify until live RLS, oversell concurrency and historical reconciliation are verified.

## Academic acceptance
See `reports/README.md` and `docs/RESILIENCE_IMPLEMENTATION.md`. The report is a truthful draft, not evidence that live security and concurrency tests have passed. Full 100% production readiness cannot be certified from an offline ZIP.
