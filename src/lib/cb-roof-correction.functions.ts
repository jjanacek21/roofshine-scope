import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CbPlanSection } from "@/lib/cbRoofPlan";

export const saveCbRoofCorrectionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { jobId: string; section: CbPlanSection }) => input)
  .handler(async ({ data, context }) => {
    const { saveCbRoofCorrection } = await import("@/lib/cb-roof-correction.server");
    return saveCbRoofCorrection(context.supabase, context.userId, data);
  });