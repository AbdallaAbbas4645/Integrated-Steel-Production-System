# SteelOps V0.9 — major instructor-first academic milestone

## What this release completes
An integrated code/documentation/test hand-in candidate for the architecture track, based on the current V0.8 source. Includes 30 extra automated tests, requirements evidence matrix, context map, resilience pattern, security review, detailed acceptance checklist and documentation status. It retains the V0.8 application code without claiming its database-backed flows work.

## What to do now (single large safe operation)
1. Download and extract the ZIP.
2. Open GitHub project `Integrated-Steel-Production-System`.
3. Switch branch from `main` to `development` **before** uploading.
4. Upload the entire `docs/` folder, `reports/` folder, `tests/` folder, and `architecture.js` plus `README_V09_ACTION_PLAN.md` using Add file → Upload files (drag files/folders when supported). Do not upload `config.js`; do not touch Netlify.
5. Commit message: `docs(test): complete architecture evidence and extend domain tests`.
6. If Node.js is installed, in extracted folder run `node --test tests/*.test.js` to reproduce test evidence. Otherwise test files are still part of the academic deliverable.

## DB migration is a separate operation
`sql/05_integrated_workflow_V08_REVISED_REVIEW.sql` remains a review-only copy. Do NOT run it yet. It may alter live table privileges and old client flows; CSV export is not complete backup.

## Priorities from instructor conversation
OOP/SOLID; creational + structural + behavioral patterns; bounded contexts; single-service rationale; resilience; ADR; quality attributes; refactoring; C4; report and test evidence. The exact original rubric is not in this package, so manual rubric comparison remains pending.
