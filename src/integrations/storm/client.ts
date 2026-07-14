// Dedicated Supabase client for the external Storm Intelligence database.
// This project ingests nationwide severe thunderstorm warnings, hail, and wind
// on a 5-minute cron. Keep this client isolated from the main Lovable Cloud client.
import { createClient } from "@supabase/supabase-js";

const STORM_URL = "https://bzybochthigavmnmnlst.supabase.co";
const STORM_KEY = "sb_publishable_1wwTyYkmst-XqXw2UaEK_A_Ie4x9jHJ";

export const stormSupabase = createClient(STORM_URL, STORM_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    storage: undefined,
  },
  global: {
    fetch: (input, init) => {
      // sb_* keys are opaque, not JWTs. Strip default Authorization bearer so
      // PostgREST doesn't try to decode them as a JWT.
      const h = new Headers(init?.headers);
      if (h.get("Authorization") === `Bearer ${STORM_KEY}`) h.delete("Authorization");
      h.set("apikey", STORM_KEY);
      return fetch(input, { ...init, headers: h });
    },
  },
});
