-- STEP 2 (once, after 01_setup.sql): replace the placeholder with the exact email
-- you created in Supabase Authentication > Users. Do not send me the email.
-- This step is intentionally separate so no user gets admin by mistake.
UPDATE public.profiles
SET role = 'admin', full_name = 'System Administrator', is_active = true
WHERE email = 'REPLACE_WITH_YOUR_LOGIN_EMAIL';
-- Verify the result: should return exactly one record whose role is admin.
SELECT email, role, is_active FROM public.profiles
WHERE email = 'REPLACE_WITH_YOUR_LOGIN_EMAIL';
