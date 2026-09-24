import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./config";

export function createServiceRoleSupabaseClient() {
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY_NOT_CONFIGURED");

  return createClient(SUPABASE_URL, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
