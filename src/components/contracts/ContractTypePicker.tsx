import { FileSignature, Handshake } from "lucide-react";
import type { Tenant } from "@/hooks/useTenant";

type ContractType = "residential" | "insurance";

export function ContractTypePicker({
  tenant,
  onPick,
}: {
  tenant: Tenant;
  onPick: (t: ContractType) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <button
        type="button"
        onClick={() => onPick("residential")}
        className="group flex flex-col items-start gap-3 rounded-2xl border p-6 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg"
        style={{
          borderColor: "var(--border)",
          background: "var(--bg-card)",
        }}
      >
        <span
          className="flex h-11 w-11 items-center justify-center rounded-xl"
          style={{
            background: `linear-gradient(135deg, ${tenant.accent_color}, ${tenant.accent_color_dark})`,
            color: "white",
          }}
        >
          <FileSignature className="h-5 w-5" strokeWidth={2.4} />
        </span>
        <div>
          <h3 className="text-[17px] font-bold text-foreground">Construction Agreement</h3>
          <p className="mt-1 text-[13px] text-muted-foreground">
            For cash or financed jobs where the scope of work is known and pricing is final.
          </p>
        </div>
      </button>

      <button
        type="button"
        onClick={() => onPick("insurance")}
        className="group flex flex-col items-start gap-3 rounded-2xl border p-6 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg"
        style={{
          borderColor: "var(--border)",
          background: "var(--bg-card)",
        }}
      >
        <span
          className="flex h-11 w-11 items-center justify-center rounded-xl"
          style={{
            background: "var(--bg-elevated)",
            color: "var(--text-dim)",
            border: "1px solid var(--border)",
          }}
        >
          <Handshake className="h-5 w-5" strokeWidth={2.4} />
        </span>
        <div>
          <h3 className="text-[17px] font-bold text-foreground">Insurance Contingency</h3>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Handshake agreement before the insurance claim is approved.
          </p>
        </div>
      </button>
    </div>
  );
}
