# Role access and governance (V1.0 candidate)

| Role | Day-to-day pages | May create | May propose edit/delete | May approve |
|---|---|---|---|---|
| admin | Every page | All modules | Direct admin edit | Yes |
| melting | Melting & Casting | Heat | Department records | No |
| billet_transport | Billet Transfer | Transfer | Department records | No |
| rolling | Rolling Mill | Rolling | Department records | No |
| sales | Customers, Sales & Orders; Inventory summary | Customer, order | Department records | No |
| loading | Loading & Dispatch | Loading | Department records | No |
| management | All operations, read-only | None | None | No |
| viewer | Overview | None | None | No |

Overview and own Change Requests are supporting navigation, not operational responsibility. The application navigation guard and models.js implement **presentation authorization only**. PostgreSQL RLS, GRANTs and SECURITY DEFINER functions are the final boundary and require live role testing. Changes to existing records are administrative approval actions; pending requests do not alter records.

**Live acceptance**: for every account, inspect nav and attempt one permitted and one forbidden RPC/API request; verify no unrelated records can be read, not merely that the page is hidden. Avoid writing test data in production without a labeled test plan.
