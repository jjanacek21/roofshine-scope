import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://lhsmeevflgrqizkchhpu.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_dBP35hR9AMuGy__OZJlMNA_hOfU5phz";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  },
});
