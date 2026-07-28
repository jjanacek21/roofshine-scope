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

// Write path (dispositions) must run as the signed-in app user so RLS scopes
// rows to them. We reuse the app's Supabase session bearer token instead of
// the session-less anon client above.
export async function stormAuthedRpc<T = unknown>(
  fn: string,
  args: Record<string, unknown>,
): Promise<{ data: T | null; error: { message: string } | null }> {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) {
    return { data: null, error: { message: "You must be signed in." } };
  }
  const res = await fetch(`${STORM_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: STORM_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(args),
  });
  const text = await res.text();
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!res.ok) {
    return { data: null, error: { message: parsed?.message ?? `Request failed (${res.status})` } };
  }
  return { data: parsed as T, error: null };
}
