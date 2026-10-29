# Delivery status and limitations

**Verified in this package:** source files packaged, JavaScript syntax checks; unit/domain automated tests (see execution output after running locally). Documentation includes C4, ADR, SOLID, domain map, resilience decisions, acceptance criteria, and a traceability matrix.

**Not verified:** live Supabase database migration, actual RLS permissions with seven staff roles, simultaneous dispatch safety, full browser E2E, and final instructor grading rubric. These are hard completion gates, not minor polish.

**Important backup note:** exported CSVs preserve table rows but not auth users/passwords, function definitions, RLS rules, triggers, or complete restorable database state. Production migration carries real risk.
