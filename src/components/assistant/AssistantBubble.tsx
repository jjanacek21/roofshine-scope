import { useState } from "react";
import { useLocation, useParams } from "@tanstack/react-router";
import { Sparkles, X } from "lucide-react";
import { AssistantPanel } from "./AssistantPanel";

export function AssistantBubble() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  // Try to sniff a job id from the URL for context.
  let jobId: string | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const params = useParams({ strict: false }) as Record<string, string | undefined>;
    jobId = params.id ?? null;
  } catch {
    /* not in a route with params */
  }

  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        title={open ? "Close assistant" : "Ask the assistant"}
        className="fixed bottom-20 right-4 z-[89] flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-lg transition-transform hover:scale-105 sm:bottom-6"
      >
        {open ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
      </button>
      <AssistantPanel
        open={open}
        onClose={() => setOpen(false)}
        contextHint={{ path: location.pathname, job_id: jobId }}
      />
    </>
  );
}
