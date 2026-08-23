import { useEffect, type ReactNode } from "react";
import { Download, X } from "lucide-react";
import { CbButton } from "@/components/cb/primitives";

/**
 * Full-screen document viewer used by the presentation deck: the measurement
 * report, the carrier estimate and the photo documentation all open in here.
 */
export function CbDocOverlay({
  open,
  title,
  onClose,
  onDownload,
  downloading,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  onDownload?: () => void;
  downloading?: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col"
      style={{ background: "var(--cb-bg, #f4f6f5)" }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <header
        className="flex shrink-0 items-center gap-3 border-b px-4 py-3"
        style={{ borderColor: "var(--cb-border, #e2e8f0)", background: "var(--cb-surface, #fff)" }}
      >
        <h2 className="cb-display flex-1 truncate" style={{ fontSize: 17, margin: 0 }}>
          {title}
        </h2>
        {onDownload ? (
          <CbButton variant="secondary" onClick={onDownload} disabled={downloading}>
            <Download className="mr-1 h-4 w-4" />
            {downloading ? "Building…" : "PDF"}
          </CbButton>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-11 w-11 items-center justify-center rounded-xl border"
          style={{ borderColor: "var(--cb-border, #e2e8f0)", background: "var(--cb-surface, #fff)" }}
        >
          <X className="h-5 w-5" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-6">{children}</div>
    </div>
  );
}
