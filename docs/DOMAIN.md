# Domain Driven Design — Domain, contexts, invariants

## Ubiquitous language
- **Heat**: a furnace batch identified by heat number, furnace A/B, weight and casting milestones.
- **Ready for Transfer**: casting finished; downstream logistics can begin.
- **Transfer**: one heat moved from CCM to rolling arrival; V0.8 currently assumes one transfer per heat.
- **Rolling Batch**: arrived heat converted into a bar size and final finished tonnage.
- **Finished inventory**: completed rolling tons minus eligible dispatched tons, by 12, 14, 16 mm size.
- **Sales Order**: customer, steel size, ordered tons, unit price, payment term.
- **Dispatch**: truck, driver and tons released against an order.
- **Change Request**: employee's proposed edit or deletion reviewed by Admin.

## Bounded contexts
1. **Production**: Heat aggregate; melting/casting events. Owner: Melting Supervisor.
2. **Logistics**: Transfer aggregate; only after heat is ready. Owner: Billet Transfer.
3. **Rolling**: Rolling Batch aggregate; quantity must not exceed delivered billet. Owner: Rolling Supervisor.
4. **Commercial**: Customers, Sales Orders; paid vs payment-on-delivery term. Owner: Sales.
5. **Fulfillment**: Dispatch record; order remaining and shared finished goods balance. Owner: Loading.
6. **Identity & Governance**: Profiles, RLS, audit log, change requests. Owner: Admin; management is read-only.

## Invariants
- Every stage event is timestamped by the database clock in the RPC, not caller-supplied time.
- A heat must finish casting before transport can start.
- Arrival weight > 0 and <= heat weight.
- Rolling starts only after arrival; produced weight > 0 and <= delivered weight.
- Dispatch weight > 0, <= remaining order tons, <= available stock for that size.
- Stage permissions are enforced on the server. Hiding a button alone is insufficient.

## Known modeling limits
- No split heat across transfers, multiple rolling sizes, lots/FIFO, yield/scrap ledger, or separate loading start/end steps.
- Historic admin edits can still affect inventory calculations; production rollout needs immutable corrections/compensating events.
- Database schema is shared across contexts; these are logical bounded contexts, not independently deployed microservices.
