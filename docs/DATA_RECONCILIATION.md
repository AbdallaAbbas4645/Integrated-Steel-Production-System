# Data reconciliation and material risk

Observed in user screenshots on 2026-10-29: a 12mm stock screen showed 50 tonnes produced and 50 tonnes dispatched; later loading screens showed order `090` with **−5 t remaining** and a different stock display reading 50 t available. The screens were captured at different points in time, so do not infer a single shared database snapshot or assert a new error. The negative remaining quantity is a real warning: a historic order may have been overfilled. Calculate remaining order as `qty_tons - SUM(loading_events.loaded_tons where status in Loaded, Dispatched)`.

**Do not auto-correct, delete, or write back historic transactions.** Require reconciliation against sales orders, truck documents, physical stock and audit trail; document an opening-balance decision if historic dispatches preceded tracked production. These operational records are currently test data mixed with legacy data; a final deployment should distinguish test from real entries.
