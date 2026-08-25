import { createServerFn } from "@tanstack/react-start";
import type { CbAiInput, CbAiReport } from "@/lib/cbReportAi";

export const cbWriteReportNarrative = createServerFn({ method: "POST" })
  .inputValidator((data: { input: CbAiInput }) => data)
  .handler(async ({ data }): Promise<{ ok: true; report: CbAiReport } | { ok: false; error: string }> => {
    const { writeReportNarrative } = await import("@/lib/cb-report-ai.server");
    try {
      return { ok: true, report: await writeReportNarrative(data.input) };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "The report writer failed." };
    }
  });
