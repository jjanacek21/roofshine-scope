import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CbInstantMeasureInput } from "@/lib/cb-measure.server";

/** Thin RPC wrapper. Implementation lives in src/lib/cb-measure.server.ts. */
export const cbInstantMeasureFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: CbInstantMeasureInput) => input)
  .handler(async ({ data, context }) => {
    const { runCbInstantMeasure } = await import("@/lib/cb-measure.server");
    return runCbInstantMeasure(context.supabase, context.userId, data);
  });
