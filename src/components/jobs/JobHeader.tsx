import { Link } from "@tanstack/react-router";
import { Share2, FileDown, Home } from "lucide-react";
import { TradeBadge } from "@/components/brand/TradeBadge";
import { StatusBadge } from "@/components/brand/StatusBadge";
import { toast } from "sonner";

export type JobHeaderJob = {
  id: string;
  name: string;
  job_number: string | null;
  status: string;
  primary_trade: string | null;
  property_address: string | null;
  price_book_id: string | null;
};

export function JobHeader({
  job,
  clientName,
  priceBookName,
  thumbnailUrl,
  onGeneratePdf,
}: {
  job: JobHeaderJob;
  clientName?: string | null;
  priceBookName?: string | null;
  thumbnailUrl?: string | null;
  onGeneratePdf?: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex gap-4">
        {/* Thumbnail */}
        <div
          className="hidden h-24 w-24 shrink-0 overflow-hidden rounded-xl border sm:block"
          style={{
            borderColor: "var(--border)",
            background: thumbnailUrl
              ? undefined
              : "linear-gradient(135deg, rgba(30,144,255,0.18), rgba(0,102,214,0.05))",
          }}
        >
          {thumbnailUrl ? (
            <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <Home className="h-8 w-8 opacity-50" />
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          {/* Job # + status + price book */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono-num text-[11px] uppercase tracking-wider text-muted-foreground">
              {job.job_number ?? "DRAFT"}
            </span>
            <StatusBadge status={job.status} />
            {priceBookName && (
              <span
                className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                style={{
                  backgroundColor: "var(--bg-elevated)",
                  border: "1px solid var(--border)",
                  color: "var(--text-dim)",
                }}
              >
                {priceBookName}
              </span>
            )}
          </div>

          {/* Title */}
          <h1
            className="font-extrabold leading-[1.1] text-foreground"
            style={{ fontSize: 24, letterSpacing: "-0.6px" }}
          >
            {clientName ? `${clientName} — ${job.name}` : job.name}
          </h1>

          {/* Address */}
          {job.property_address && (
            <p className="text-[13px] text-muted-foreground">{job.property_address}</p>
          )}

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-3 pt-1 text-[12px] text-muted-foreground">
            {clientName && <span>{clientName}</span>}
            {job.primary_trade && (
              <>
                <span>·</span>
                <TradeBadge trade={job.primary_trade} />
              </>
            )}
            {priceBookName && (
              <>
                <span>·</span>
                <span>{priceBookName}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 gap-2">
        <button
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            toast.success("Link copied to clipboard");
          }}
          className="btn-ghost flex h-9 items-center gap-2 rounded-lg px-3.5 text-[13px] font-semibold"
        >
          <Share2 className="h-3.5 w-3.5" strokeWidth={2.4} />
          Share
        </button>
        <Link
          to="/jobs/$id/report"
          params={{ id: job.id }}
          onClick={onGeneratePdf}
          className="btn-brand flex h-9 items-center gap-2 rounded-lg px-3.5 text-[13px] font-semibold"
        >
          <FileDown className="h-3.5 w-3.5" strokeWidth={2.4} />
          Generate PDF
        </Link>
      </div>
    </div>
  );
}
