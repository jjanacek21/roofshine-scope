import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ExternalLink, RefreshCw, Save, AlertTriangle } from "lucide-react";

export function SigningFrame({
  url,
  onBack,
  onSave,
}: {
  url: string;
  onBack: () => void;
  onSave: () => void;
}) {
  const [loadState, setLoadState] = useState<"loading" | "ok" | "error">("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  // If the iframe doesn't fire onLoad within 6s assume it failed
  // (X-Frame-Options blocks, DNS failure, 404, etc. don't always trigger onError).
  useEffect(() => {
    setLoadState("loading");
    const t = window.setTimeout(() => {
      setLoadState((s) => (s === "loading" ? "error" : s));
    }, 6000);
    return () => window.clearTimeout(t);
  }, [url, reloadKey]);

  return (
    <div className="flex flex-col gap-3">
      <div
        className="relative overflow-hidden rounded-2xl border"
        style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
      >
        <iframe
          key={reloadKey}
          ref={iframeRef}
          src={url}
          title="Sign contract"
          className="block w-full"
          style={{ height: "calc(100vh - 320px)", minHeight: 520, border: 0 }}
          allow="clipboard-write; downloads"
          onLoad={() => setLoadState("ok")}
          onError={() => setLoadState("error")}
        />

        {loadState === "error" && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center"
            style={{ background: "var(--bg-card)" }}
          >
            <AlertTriangle className="h-8 w-8 text-amber-500" />
            <div>
              <h3 className="text-base font-semibold text-foreground">
                Couldn't load the signing app
              </h3>
              <p className="mt-1 text-[12px] text-muted-foreground">
                The signer at{" "}
                <code className="font-mono-num text-foreground">{url.split("?")[0]}</code> didn't
                respond. Check the tenant's signing URL in Admin → Contracts, or open it in a new
                tab to confirm it's live.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setReloadKey((k) => k + 1)}
                className="btn-ghost inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold"
              >
                <RefreshCw className="h-3 w-3" strokeWidth={2.4} />
                Retry
              </button>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold"
              >
                <ExternalLink className="h-3 w-3" strokeWidth={2.4} />
                Open in new tab
              </a>
            </div>
          </div>
        )}
      </div>

      <div
        className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3"
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
        <div className="flex items-center gap-2">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost inline-flex h-10 items-center gap-2 rounded-lg px-3 text-[13px] font-semibold"
          >
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={2.4} />
            Open in new tab
          </a>
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
    </div>
  );
}
