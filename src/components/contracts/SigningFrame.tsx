import { useEffect } from "react";
import { ArrowLeft, Save } from "lucide-react";

export function SigningFrame({
  url,
  onBack,
  onSave,
}: {
  url: string;
  onBack: () => void;
  onSave: () => void;
}) {
  useEffect(() => {
    // TODO: when GCN-Sign.html postMessages the signed PDF blob back, auto-upload
    // here instead of requiring a manual file pick. Listener stub below — disabled.
    // const handler = (e: MessageEvent) => {
    //   if (e.origin !== new URL(url).origin) return;
    //   if (e.data?.type === "signed-pdf") { /* upload e.data.blob automatically */ }
    // };
    // window.addEventListener("message", handler);
    // return () => window.removeEventListener("message", handler);
  }, [url]);

  return (
    <div className="flex flex-col gap-3">
      <div
        className="overflow-hidden rounded-2xl border"
        style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
      >
        <iframe
          src={url}
          title="Sign contract"
          className="block w-full"
          style={{ height: "calc(100vh - 320px)", minHeight: 520, border: 0 }}
          allow="clipboard-write; downloads"
        />
      </div>

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3"
        style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
      >
        <button
          type="button"
          onClick={onBack}
          className="btn-ghost inline-flex h-10 items-center gap-2 rounded-lg px-4 text-[13px] font-semibold"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.4} />
          Back
        </button>
        <button
          type="button"
          onClick={onSave}
          className="btn-brand inline-flex h-10 items-center gap-2 rounded-lg px-5 text-[13px] font-semibold"
        >
          <Save className="h-3.5 w-3.5" strokeWidth={2.4} />
          Save signed contract
        </button>
      </div>
    </div>
  );
}
