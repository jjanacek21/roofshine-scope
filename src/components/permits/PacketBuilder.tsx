import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FileStack, Loader2, PackageCheck } from "lucide-react";
import { buildAndFilePacket, planPacket, type PacketItem, type PacketPlan } from "@/lib/permits/packet";
import type { PermitContext } from "@/lib/permits/context";
import type { JobPermitDocument } from "@/lib/permits/db";

/**
 * The packet, in the order the counter reads it.
 *
 * This sits below the checklist and answers the other half of the question.
 * The checklist says what is missing; this says what the envelope looks like —
 * which document goes first, which needs a notary, which has to be recorded
 * before the first inspection. A contractor who has assembled one of these by
 * hand will recognise the order immediately, because it came from packets these
 * counters accepted.
 */

const card = { borderColor: "var(--border)", background: "var(--bg-card)" };

const STATUS: Record<PacketItem["status"], { label: string; color: string; dot: string }> = {
  included: { label: "in packet", color: "var(--muted-foreground)", dot: "#16a34a" },
  missing: { label: "needed", color: "#b91c1c", dot: "#dc2626" },
  unreadable: { label: "could not read", color: "#b45309", dot: "#f59e0b" },
  confirm: { label: "confirm", color: "#b45309", dot: "#f59e0b" },
  not_applicable: { label: "not required here", color: "var(--muted-foreground)", dot: "var(--border)" },
};

export function PacketBuilder({
  context,
  documents,
  permitId,
  material,
  yearBuilt,
}: {
  context: PermitContext | null;
  documents: JobPermitDocument[];
  permitId: string | null;
  material?: string | null;
  yearBuilt?: number | null;
}) {
  const [plan, setPlan] = useState<PacketPlan | null>(null);
  const [building, setBuilding] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    if (!context) return;
    setLoading(true);
    planPacket(context, documents, { material, yearBuilt })
      .then((p) => live && setPlan(p))
      .catch(() => live && setPlan(null))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [context, documents, material, yearBuilt]);

  async function handleBuild() {
    if (!context || !plan) return;
    setBuilding(true);
    try {
      const { packet, downloadUrl, filed } = await buildAndFilePacket({
        ctx: context,
        uploaded: documents,
        permitId,
        material,
        yearBuilt,
        info: {
          jurisdiction: plan.jurisdiction,
          ownerName: context.values.owner_name ?? "—",
          address: [
            context.values.property_address,
            context.values.property_city,
            context.values.property_state,
            context.values.property_zip,
          ]
            .filter(Boolean)
            .join(", "),
          valuation: context.values.valuation ? `$${context.values.valuation}` : "—",
          hvhz: !!context.department?.is_hvhz,
          scope: context.values.scope_description ?? "",
          company: context.values.contractor_company ?? "—",
          licence: context.values.license_number ?? "—",
        },
      });

      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = packet.fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 30_000);

      setPlan(packet.plan);
      const short = packet.plan.items.filter((i) => i.status === "missing").length;
      if (short) {
        toast.warning(
          `Packet built — ${packet.totalPages} pages. ${short} document${short === 1 ? "" : "s"} still needed before it can go in.`,
        );
      } else {
        toast.success(
          filed
            ? `Packet built — ${packet.totalPages} pages, saved to Documents.`
            : `Packet built — ${packet.totalPages} pages.`,
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not build the packet");
    } finally {
      setBuilding(false);
    }
  }

  if (loading) {
    return <div className="h-32 animate-pulse rounded-xl" style={{ background: "var(--bg-card)" }} />;
  }

  if (!plan?.structure) {
    return (
      <section className="rounded-xl border p-4" style={card}>
        <h3 className="text-[13px] font-semibold text-foreground">Packet layout</h3>
        <p className="mt-1 text-[12px] text-muted-foreground">
          No packet layout on file for {plan?.jurisdiction ?? "this jurisdiction"} yet. The checklist
          above still applies — assembling it in order needs this counter mapped first, which happens
          by reading a packet it has already accepted.
        </p>
      </section>
    );
  }

  const ready = plan.items.filter((i) => i.status === "missing").length === 0;
  const pages = plan.items.reduce((n, i) => n + (i.status === "included" ? i.pages || 1 : 0), 0);

  return (
    <section className="rounded-xl border p-4" style={card}>
      <div className="mb-1 flex items-baseline justify-between">
        <h3 className="text-[13px] font-semibold text-foreground">Packet layout</h3>
        <span className="text-[11px] text-muted-foreground">
          {plan.items.filter((i) => i.status !== "not_applicable").length} documents
        </span>
      </div>
      <p className="mb-3 text-[12px] text-muted-foreground">
        The order {plan.jurisdiction} reads them in.
        {plan.structure.notes ? ` ${plan.structure.notes}` : ""}
      </p>

      <ol className="space-y-1">
        {plan.items.map((it, i) => {
          const s = STATUS[it.status];
          return (
            <li
              key={`${it.type}-${i}`}
              className="flex items-start gap-2.5 rounded-lg px-2 py-1.5"
              style={it.status === "missing" ? { background: "rgba(220,38,38,0.05)" } : undefined}
            >
              <span
                className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: s.dot }}
              />
              <span className="w-5 shrink-0 pt-px text-[11px] tabular-nums text-muted-foreground">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span
                    className="text-[12.5px] text-foreground"
                    style={it.status === "not_applicable" ? { opacity: 0.5 } : undefined}
                  >
                    {it.name}
                  </span>
                  {it.needsNotary && <Tag>notary</Tag>}
                  {!it.needsNotary && it.needsSignature && <Tag>signature</Tag>}
                  {it.requiresRecording && <Tag>record it</Tag>}
                  <span className="text-[11px]" style={{ color: s.color }}>
                    {s.label}
                  </span>
                </div>
                {it.from && it.status === "included" && (
                  <p className="text-[11px] text-muted-foreground">from {it.from}</p>
                )}
                {it.note && <p className="text-[11px]" style={{ color: s.color }}>{it.note}</p>}
                {it.status === "missing" && it.instruction && (
                  <p className="text-[11px] text-muted-foreground">{it.instruction}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {plan.recording && (
        <p className="mt-3 text-[11px] text-muted-foreground">
          {Object.entries(plan.recording)
            .map(([doc, where]) => `The ${doc.toUpperCase()} is recorded with ${where}.`)
            .join(" ")}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() => void handleBuild()}
          disabled={building}
          className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50"
          style={{ background: ready ? "var(--brand)" : "var(--muted-foreground)" }}
        >
          {building ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : ready ? (
            <PackageCheck className="h-4 w-4" />
          ) : (
            <FileStack className="h-4 w-4" />
          )}
          {ready ? "Build packet" : "Build what we have"}
        </button>
        <span className="text-[11.5px] text-muted-foreground">
          {ready
            ? `About ${pages + 1} pages, cover sheet first.`
            : "Builds with what is in hand and lists the rest on the cover sheet."}
        </span>
      </div>
    </section>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="rounded px-1.5 py-px text-[10px] uppercase tracking-wide"
      style={{ background: "var(--border)", color: "var(--muted-foreground)" }}
    >
      {children}
    </span>
  );
}
