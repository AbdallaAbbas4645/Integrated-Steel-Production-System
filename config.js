// Supabase Dashboard > Settings > API Keys: use ONLY sb_publishable_... (never secret/service_role).
// Supabase Project Overview: URL ends with .supabase.co (NOT /rest/v1/).
// This file is browser-visible by design. Publishable key + strict RLS is the correct setup.
window.STEEL_CONFIG = {
  url: "REPLACE_WITH_YOUR_SUPABASE_PROJECT_URL",
  publishableKey: "REPLACE_WITH_YOUR_PUBLISHABLE_KEY"
};
