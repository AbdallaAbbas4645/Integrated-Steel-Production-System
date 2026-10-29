# Quality attribute scenarios

## QA-01 Integrity / safety of stock
**Source:** Two loading operators. **Stimulus:** both dispatch the last 10 tons of the same bar size concurrently. **Environment:** active network and deployed DB. **Artifact:** `factory_stage` RPC and sales orders. **Expected response:** serialized writes, exactly one valid operation if combined demand exceeds available stock; reject second without partial stock change. **Measurement:** 0 negative stock, 0 accepted over-order dispatches over 100 concurrent test pairs. **Status:** defined; not measured on live Supabase.

## QA-02 Authorization
**Source:** authenticated melting operator. **Stimulus:** calls `factory_stage('dispatch', order_id, ...)`. **Expected response:** permission exception and zero new loading rows. **Measurement:** 100% forbidden actions denied in role test matrix. **Status:** defined, requires live RLS/RPC integration.

## QA-03 Recoverability
**Source:** a browser loses network during dispatch. **Stimulus:** RPC response is unknown. **Expected response:** display failure, reload order and dispatch list, never retry blindly. **Measurement:** zero duplicate fulfillment after manual reconciliation. **Status:** manual workflow, needs integration test and idempotency key in future.

## QA-04 Performance
**Source:** management user opens daily dashboard. **Stimulus:** 10,000 rows across contexts. **Expected response:** useful key metrics within 3 seconds over representative broadband; pagination rather than fixed 120-row sampling. **Status:** target only; currently overview counts limited sample of 120 rows, must fix before claiming achieved.
