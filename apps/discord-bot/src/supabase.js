import { createClient } from "@supabase/supabase-js";

export function createBotSupabase(config) {
  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        "x-crazzy-worker": config.workerId,
      },
    },
  });
}
