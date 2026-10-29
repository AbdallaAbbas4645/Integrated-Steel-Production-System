-- Integrated Steel Production & Operations Management System
-- Version 0.2: run once in Supabase SQL Editor, as project owner.
-- Designed to extend the existing public.heats table without deleting the H-TEST-001 row.
BEGIN;

CREATE TABLE IF NOT EXISTS public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL DEFAULT 'New user',
  role TEXT NOT NULL DEFAULT 'viewer'
    CHECK (role IN ('admin','management','melting','billet_transport','rolling','sales','loading','viewer')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.create_staff_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.profiles(user_id,email,full_name,role)
  VALUES(NEW.id, COALESCE(NEW.email,''), COALESCE(NEW.raw_user_meta_data->>'full_name','New user'),'viewer')
  ON CONFLICT(user_id) DO NOTHING;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS after_auth_user_create_staff ON auth.users;
CREATE TRIGGER after_auth_user_create_staff AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.create_staff_profile();
-- Backfill users already created before the trigger (including your current login).
INSERT INTO public.profiles(user_id,email,full_name,role)
SELECT id,COALESCE(email,''),COALESCE(raw_user_meta_data->>'full_name','New user'),'viewer'
FROM auth.users ON CONFLICT(user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.staff_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT role FROM public.profiles WHERE user_id = auth.uid() AND is_active = true LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_staff_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT COALESCE(public.staff_role() = 'admin',FALSE);
$$;

-- Existing heats table: keep its data and the columns already created in the tutorial.
CREATE TABLE IF NOT EXISTS public.heats (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 heat_number TEXT NOT NULL UNIQUE,
 furnace TEXT NOT NULL CHECK (furnace IN ('A','B')),
 weight_tons NUMERIC(10,2) NOT NULL CHECK (weight_tons > 0),
 start_time TIMESTAMPTZ NOT NULL,
 status TEXT NOT NULL DEFAULT 'In Progress',
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.heats ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE public.heats ADD COLUMN IF NOT EXISTS ccm_poured_at TIMESTAMPTZ;
ALTER TABLE public.heats ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.heats ALTER COLUMN user_id SET DEFAULT auth.uid();

CREATE TABLE IF NOT EXISTS public.transfers (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 heat_id BIGINT NOT NULL REFERENCES public.heats(id) ON DELETE RESTRICT,
 arrived_at TIMESTAMPTZ NOT NULL,
 delivered_tons NUMERIC(10,2) NOT NULL CHECK(delivered_tons > 0),
 notes TEXT,
 created_by UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.rolling_batches (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 heat_id BIGINT NOT NULL REFERENCES public.heats(id) ON DELETE RESTRICT,
 size_mm INT NOT NULL CHECK(size_mm IN (12,14,16)),
 started_at TIMESTAMPTZ NOT NULL,
 finished_at TIMESTAMPTZ,
 produced_tons NUMERIC(10,2) NOT NULL CHECK(produced_tons > 0),
 status TEXT NOT NULL DEFAULT 'In Progress',
 notes TEXT,
 created_by UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CONSTRAINT roll_finish_after_start CHECK(finished_at IS NULL OR finished_at >= started_at)
);
CREATE TABLE IF NOT EXISTS public.customers (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 name TEXT NOT NULL,
 phone TEXT,
 notes TEXT,
 created_by UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.sales_orders (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 order_no TEXT NOT NULL UNIQUE,
 customer_id BIGINT NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
 size_mm INT NOT NULL CHECK(size_mm IN (12,14,16)),
 qty_tons NUMERIC(10,2) NOT NULL CHECK(qty_tons > 0),
 price_per_ton NUMERIC(12,2) NOT NULL CHECK(price_per_ton >= 0),
 status TEXT NOT NULL DEFAULT 'Open',
 created_by UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.loading_events (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 order_id BIGINT NOT NULL REFERENCES public.sales_orders(id) ON DELETE RESTRICT,
 truck_plate TEXT NOT NULL,
 driver_name TEXT,
 loaded_tons NUMERIC(10,2) NOT NULL CHECK(loaded_tons > 0),
 loaded_at TIMESTAMPTZ NOT NULL,
 status TEXT NOT NULL DEFAULT 'Loaded',
 created_by UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.change_requests (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 target_table TEXT NOT NULL CHECK(target_table IN ('heats','transfers','rolling_batches','customers','sales_orders','loading_events')),
 record_id BIGINT NOT NULL,
 request_type TEXT NOT NULL CHECK(request_type IN ('update','delete')),
 requested_changes JSONB NOT NULL DEFAULT '{}'::jsonb,
 reason TEXT NOT NULL CHECK(length(trim(reason))>=5),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 requested_by UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
 requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 reviewed_by UUID REFERENCES auth.users(id),
 reviewed_at TIMESTAMPTZ,
 admin_note TEXT,
 CONSTRAINT request_changes_object CHECK(jsonb_typeof(requested_changes)='object')
);
CREATE TABLE IF NOT EXISTS public.audit_log (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor_id UUID,
 action TEXT NOT NULL,
 table_name TEXT NOT NULL,
 record_id BIGINT,
 old_data JSONB,
 new_data JSONB,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit records cannot be edited by the website. Writes occur only from database triggers.
CREATE OR REPLACE FUNCTION public.audit_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE rec_id BIGINT;
BEGIN
 IF TG_OP='DELETE' THEN
   rec_id=OLD.id;
   INSERT INTO public.audit_log(actor_id,action,table_name,record_id,old_data,new_data)
   VALUES(auth.uid(),TG_OP,TG_TABLE_NAME,rec_id,to_jsonb(OLD),NULL);
   RETURN OLD;
 ELSIF TG_OP='UPDATE' THEN
   rec_id=NEW.id;
   INSERT INTO public.audit_log(actor_id,action,table_name,record_id,old_data,new_data)
   VALUES(auth.uid(),TG_OP,TG_TABLE_NAME,rec_id,to_jsonb(OLD),to_jsonb(NEW));
   RETURN NEW;
 ELSE
   rec_id=NEW.id;
   INSERT INTO public.audit_log(actor_id,action,table_name,record_id,old_data,new_data)
   VALUES(auth.uid(),TG_OP,TG_TABLE_NAME,rec_id,NULL,to_jsonb(NEW));
   RETURN NEW;
 END IF;
END; $$;
DO $$ DECLARE t TEXT; BEGIN
 FOREACH t IN ARRAY ARRAY['heats','transfers','rolling_batches','customers','sales_orders','loading_events','change_requests'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS steel_audit_trigger ON public.%I',t);
  EXECUTE format('CREATE TRIGGER steel_audit_trigger AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_change()',t);
 END LOOP;
END $$;

-- RLS is enforced by Postgres; hiding tabs in HTML is only for user experience.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.heats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rolling_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loading_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Clean earlier tutorial policies, otherwise old per-user rules could conflict with role-based rules.
DROP POLICY IF EXISTS "Users can read own heats" ON public.heats;
DROP POLICY IF EXISTS "Users can insert own heats" ON public.heats;
DROP POLICY IF EXISTS steel_read_profiles ON public.profiles;
CREATE POLICY steel_read_profiles ON public.profiles FOR SELECT TO authenticated
 USING(user_id=auth.uid() OR public.staff_role() IN ('admin','management'));

-- Remove previous version's named policies before recreating them (safe when retrying setup).
DO $$ DECLARE t TEXT; p RECORD; BEGIN
 FOREACH t IN ARRAY ARRAY['heats','transfers','rolling_batches','customers','sales_orders','loading_events','change_requests','audit_log'] LOOP
  FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t AND policyname LIKE 'steel_%' LOOP
   EXECUTE format('DROP POLICY %I ON public.%I',p.policyname,t);
  END LOOP;
 END LOOP;
END $$;

CREATE POLICY steel_heats_read ON public.heats FOR SELECT TO authenticated
 USING(public.staff_role() IN ('admin','management','melting','billet_transport','rolling'));
CREATE POLICY steel_heats_write ON public.heats FOR INSERT TO authenticated
 WITH CHECK(public.staff_role() IN ('admin','melting') AND user_id=auth.uid());
CREATE POLICY steel_heats_update ON public.heats FOR UPDATE TO authenticated
 USING(public.is_staff_admin()) WITH CHECK(public.is_staff_admin());
CREATE POLICY steel_heats_delete ON public.heats FOR DELETE TO authenticated USING(public.is_staff_admin());

CREATE POLICY steel_transfers_read ON public.transfers FOR SELECT TO authenticated
 USING(public.staff_role() IN ('admin','management','melting','billet_transport','rolling'));
CREATE POLICY steel_transfers_write ON public.transfers FOR INSERT TO authenticated
 WITH CHECK(public.staff_role() IN ('admin','billet_transport') AND created_by=auth.uid());
CREATE POLICY steel_transfers_update ON public.transfers FOR UPDATE TO authenticated
 USING(public.is_staff_admin()) WITH CHECK(public.is_staff_admin());
CREATE POLICY steel_transfers_delete ON public.transfers FOR DELETE TO authenticated USING(public.is_staff_admin());

CREATE POLICY steel_rolling_read ON public.rolling_batches FOR SELECT TO authenticated
 USING(public.staff_role() IN ('admin','management','rolling'));
CREATE POLICY steel_rolling_write ON public.rolling_batches FOR INSERT TO authenticated
 WITH CHECK(public.staff_role() IN ('admin','rolling') AND created_by=auth.uid());
CREATE POLICY steel_rolling_update ON public.rolling_batches FOR UPDATE TO authenticated
 USING(public.is_staff_admin()) WITH CHECK(public.is_staff_admin());
CREATE POLICY steel_rolling_delete ON public.rolling_batches FOR DELETE TO authenticated USING(public.is_staff_admin());

CREATE POLICY steel_customers_read ON public.customers FOR SELECT TO authenticated
 USING(public.staff_role() IN ('admin','management','sales','loading'));
CREATE POLICY steel_customers_write ON public.customers FOR INSERT TO authenticated
 WITH CHECK(public.staff_role() IN ('admin','sales') AND created_by=auth.uid());
CREATE POLICY steel_customers_update ON public.customers FOR UPDATE TO authenticated
 USING(public.is_staff_admin()) WITH CHECK(public.is_staff_admin());
CREATE POLICY steel_customers_delete ON public.customers FOR DELETE TO authenticated USING(public.is_staff_admin());

CREATE POLICY steel_sales_read ON public.sales_orders FOR SELECT TO authenticated
 USING(public.staff_role() IN ('admin','management','sales','loading'));
CREATE POLICY steel_sales_write ON public.sales_orders FOR INSERT TO authenticated
 WITH CHECK(public.staff_role() IN ('admin','sales') AND created_by=auth.uid());
CREATE POLICY steel_sales_update ON public.sales_orders FOR UPDATE TO authenticated
 USING(public.is_staff_admin()) WITH CHECK(public.is_staff_admin());
CREATE POLICY steel_sales_delete ON public.sales_orders FOR DELETE TO authenticated USING(public.is_staff_admin());

CREATE POLICY steel_loading_read ON public.loading_events FOR SELECT TO authenticated
 USING(public.staff_role() IN ('admin','management','sales','loading'));
CREATE POLICY steel_loading_write ON public.loading_events FOR INSERT TO authenticated
 WITH CHECK(public.staff_role() IN ('admin','loading') AND created_by=auth.uid());
CREATE POLICY steel_loading_update ON public.loading_events FOR UPDATE TO authenticated
 USING(public.is_staff_admin()) WITH CHECK(public.is_staff_admin());
CREATE POLICY steel_loading_delete ON public.loading_events FOR DELETE TO authenticated USING(public.is_staff_admin());

CREATE OR REPLACE FUNCTION public.can_request_record(t TEXT, rec BIGINT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = '' AS $$
DECLARE r TEXT := public.staff_role();
BEGIN
 IF r IS NULL OR r IN ('viewer','management') THEN RETURN FALSE; END IF;
 IF t='heats' AND r IN ('melting','admin') THEN
  RETURN EXISTS (SELECT 1 FROM public.heats WHERE id=rec AND (user_id=auth.uid() OR r='admin'));
 ELSIF t='transfers' AND r IN ('billet_transport','admin') THEN
  RETURN EXISTS (SELECT 1 FROM public.transfers WHERE id=rec AND (created_by=auth.uid() OR r='admin'));
 ELSIF t='rolling_batches' AND r IN ('rolling','admin') THEN
  RETURN EXISTS (SELECT 1 FROM public.rolling_batches WHERE id=rec AND (created_by=auth.uid() OR r='admin'));
 ELSIF t='customers' AND r IN ('sales','admin') THEN
  RETURN EXISTS (SELECT 1 FROM public.customers WHERE id=rec AND (created_by=auth.uid() OR r='admin'));
 ELSIF t='sales_orders' AND r IN ('sales','admin') THEN
  RETURN EXISTS (SELECT 1 FROM public.sales_orders WHERE id=rec AND (created_by=auth.uid() OR r='admin'));
 ELSIF t='loading_events' AND r IN ('loading','admin') THEN
  RETURN EXISTS (SELECT 1 FROM public.loading_events WHERE id=rec AND (created_by=auth.uid() OR r='admin'));
 END IF;
 RETURN FALSE;
END; $$;
CREATE POLICY steel_requests_read ON public.change_requests FOR SELECT TO authenticated
 USING(requested_by=auth.uid() OR public.staff_role() IN ('admin','management'));
CREATE POLICY steel_requests_insert ON public.change_requests FOR INSERT TO authenticated
 WITH CHECK(requested_by=auth.uid() AND status='pending'
  AND reviewed_by IS NULL AND reviewed_at IS NULL
  AND public.can_request_record(target_table,record_id));
CREATE POLICY steel_requests_update ON public.change_requests FOR UPDATE TO authenticated
 USING(public.is_staff_admin()) WITH CHECK(public.is_staff_admin());
CREATE POLICY steel_audit_read ON public.audit_log FOR SELECT TO authenticated
 USING(public.staff_role() IN ('admin','management'));

-- Explicit table/column permissions: authenticated cannot change source records except as admin via RLS.
REVOKE ALL ON TABLE public.profiles,public.heats,public.transfers,public.rolling_batches,
 public.customers,public.sales_orders,public.loading_events,public.change_requests,public.audit_log
 FROM anon,authenticated;
GRANT SELECT ON TABLE public.profiles,public.heats,public.transfers,public.rolling_batches,
 public.customers,public.sales_orders,public.loading_events,public.change_requests,public.audit_log TO authenticated;
GRANT INSERT,UPDATE,DELETE ON TABLE public.heats,public.transfers,public.rolling_batches,
 public.customers,public.sales_orders,public.loading_events TO authenticated;
GRANT INSERT (target_table,record_id,request_type,requested_changes,reason,requested_by)
 ON public.change_requests TO authenticated;
-- Change-request review is performed only by a security-definer RPC, not direct API update.
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_staff_role(p_user_id UUID,p_role TEXT,p_full_name TEXT DEFAULT NULL,p_active BOOLEAN DEFAULT TRUE)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF NOT public.is_staff_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
 IF p_role NOT IN ('admin','management','melting','billet_transport','rolling','sales','loading','viewer')
  THEN RAISE EXCEPTION 'Invalid role'; END IF;
 IF p_user_id = auth.uid() AND (p_role <> 'admin' OR p_active = FALSE) THEN
   RAISE EXCEPTION 'Cannot remove your own admin access';
 END IF;
 UPDATE public.profiles SET role=p_role,
   full_name=COALESCE(NULLIF(trim(p_full_name),''),full_name),is_active=p_active
 WHERE user_id=p_user_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_review_change(
 p_request_id BIGINT, p_approve BOOLEAN, p_note TEXT DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE req public.change_requests%ROWTYPE; c JSONB;
BEGIN
 IF NOT public.is_staff_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
 SELECT * INTO req FROM public.change_requests WHERE id=p_request_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
 IF req.status <> 'pending' THEN RAISE EXCEPTION 'Request already reviewed'; END IF;
 c := req.requested_changes;
 IF p_approve THEN
  IF req.request_type = 'delete' THEN
   CASE req.target_table
    WHEN 'heats' THEN DELETE FROM public.heats WHERE id=req.record_id;
    WHEN 'transfers' THEN DELETE FROM public.transfers WHERE id=req.record_id;
    WHEN 'rolling_batches' THEN DELETE FROM public.rolling_batches WHERE id=req.record_id;
    WHEN 'customers' THEN DELETE FROM public.customers WHERE id=req.record_id;
    WHEN 'sales_orders' THEN DELETE FROM public.sales_orders WHERE id=req.record_id;
    WHEN 'loading_events' THEN DELETE FROM public.loading_events WHERE id=req.record_id;
    ELSE RAISE EXCEPTION 'Invalid target';
   END CASE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Target record not found'; END IF;
  ELSE
   -- Explicit column allowlists prevent an edit request changing owner IDs or primary keys.
   CASE req.target_table
    WHEN 'heats' THEN
     IF (SELECT COUNT(*) FROM jsonb_object_keys(c)) <> 1 OR NOT (c ?| ARRAY['heat_number','furnace','weight_tons','start_time','ccm_poured_at','status','notes'])
      THEN RAISE EXCEPTION 'Invalid heat change'; END IF;
     UPDATE public.heats SET
      heat_number=COALESCE(c->>'heat_number',heat_number),
      furnace=COALESCE(c->>'furnace',furnace),
      weight_tons=COALESCE((c->>'weight_tons')::numeric,weight_tons),
      start_time=COALESCE((c->>'start_time')::timestamptz,start_time),
      ccm_poured_at=CASE WHEN c ? 'ccm_poured_at' THEN NULLIF(c->>'ccm_poured_at','')::timestamptz ELSE ccm_poured_at END,
      status=COALESCE(c->>'status',status),notes=COALESCE(c->>'notes',notes)
     WHERE id=req.record_id;
    WHEN 'transfers' THEN
     IF (SELECT COUNT(*) FROM jsonb_object_keys(c)) <> 1 OR NOT (c ?| ARRAY['arrived_at','delivered_tons','notes']) THEN RAISE EXCEPTION 'Invalid transfer change'; END IF;
     UPDATE public.transfers SET arrived_at=COALESCE((c->>'arrived_at')::timestamptz,arrived_at),
       delivered_tons=COALESCE((c->>'delivered_tons')::numeric,delivered_tons),notes=COALESCE(c->>'notes',notes)
     WHERE id=req.record_id;
    WHEN 'rolling_batches' THEN
     IF (SELECT COUNT(*) FROM jsonb_object_keys(c)) <> 1 OR NOT (c ?| ARRAY['size_mm','started_at','finished_at','produced_tons','status','notes']) THEN RAISE EXCEPTION 'Invalid rolling change'; END IF;
     UPDATE public.rolling_batches SET size_mm=COALESCE((c->>'size_mm')::int,size_mm),
       started_at=COALESCE((c->>'started_at')::timestamptz,started_at),
       finished_at=CASE WHEN c ? 'finished_at' THEN NULLIF(c->>'finished_at','')::timestamptz ELSE finished_at END,
       produced_tons=COALESCE((c->>'produced_tons')::numeric,produced_tons),
       status=COALESCE(c->>'status',status),notes=COALESCE(c->>'notes',notes)
     WHERE id=req.record_id;
    WHEN 'customers' THEN
     IF (SELECT COUNT(*) FROM jsonb_object_keys(c)) <> 1 OR NOT (c ?| ARRAY['name','phone','notes']) THEN RAISE EXCEPTION 'Invalid customer change'; END IF;
     UPDATE public.customers SET name=COALESCE(c->>'name',name),phone=COALESCE(c->>'phone',phone),notes=COALESCE(c->>'notes',notes)
     WHERE id=req.record_id;
    WHEN 'sales_orders' THEN
     IF (SELECT COUNT(*) FROM jsonb_object_keys(c)) <> 1 OR NOT (c ?| ARRAY['order_no','customer_id','size_mm','qty_tons','price_per_ton','status']) THEN RAISE EXCEPTION 'Invalid sales change'; END IF;
     UPDATE public.sales_orders SET order_no=COALESCE(c->>'order_no',order_no),
       customer_id=COALESCE((c->>'customer_id')::bigint,customer_id),
       size_mm=COALESCE((c->>'size_mm')::int,size_mm),
       qty_tons=COALESCE((c->>'qty_tons')::numeric,qty_tons),
       price_per_ton=COALESCE((c->>'price_per_ton')::numeric,price_per_ton),
       status=COALESCE(c->>'status',status) WHERE id=req.record_id;
    WHEN 'loading_events' THEN
     IF (SELECT COUNT(*) FROM jsonb_object_keys(c)) <> 1 OR NOT (c ?| ARRAY['truck_plate','driver_name','loaded_tons','loaded_at','status']) THEN RAISE EXCEPTION 'Invalid loading change'; END IF;
     UPDATE public.loading_events SET truck_plate=COALESCE(c->>'truck_plate',truck_plate),
       driver_name=COALESCE(c->>'driver_name',driver_name),
       loaded_tons=COALESCE((c->>'loaded_tons')::numeric,loaded_tons),
       loaded_at=COALESCE((c->>'loaded_at')::timestamptz,loaded_at),
       status=COALESCE(c->>'status',status) WHERE id=req.record_id;
    ELSE RAISE EXCEPTION 'Invalid target';
   END CASE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Target record missing or operation not permitted'; END IF;
  END IF;
 END IF;
 UPDATE public.change_requests SET status=CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
   reviewed_by=auth.uid(),reviewed_at=now(),admin_note=p_note WHERE id=p_request_id;
END; $$;

REVOKE ALL ON FUNCTION public.admin_set_staff_role(UUID,TEXT,TEXT,BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_review_change(BIGINT,BOOLEAN,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_staff_role(UUID,TEXT,TEXT,BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_review_change(BIGINT,BOOLEAN,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_request_record(TEXT,BIGINT) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_transfers_heat ON public.transfers(heat_id);
CREATE INDEX IF NOT EXISTS idx_rolling_heat ON public.rolling_batches(heat_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON public.sales_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_loading_order ON public.loading_events(order_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON public.change_requests(status,requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_log(created_at DESC);
COMMIT;
