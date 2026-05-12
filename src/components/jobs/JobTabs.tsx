import { Link, useLocation } from "@tanstack/react-router";
import { LayoutGrid, Ruler, Camera, Receipt, FileText, FileSignature, Package } from "lucide-react";

const TABS = [
  { to: "/jobs/$id" as const, label: "Overview", icon: LayoutGrid, exact: true },
  { to: "/jobs/$id/measure" as const, label: "Measurements", icon: Ruler },
  { to: "/jobs/$id/photos" as const, label: "Photos", icon: Camera },
  { to: "/jobs/$id/estimate" as const, label: "Estimate", icon: Receipt },
  { to: "/jobs/$id/order-form" as const, label: "Order Form", icon: Package },
  { to: "/jobs/$id/contract" as const, label: "Contract", icon: FileSignature },
  { to: "/jobs/$id/report" as const, label: "Report", icon: FileText },
];

export function JobTabs({ jobId }: { jobId: string }) {
  const { pathname } = useLocation();

  function isActive(to: string, exact?: boolean) {
    const resolved = to.replace("$id", jobId);
    if (exact) return pathname === resolved || pathname === `${resolved}/`;
    return pathname === resolved || pathname.startsWith(`${resolved}/`);
  }

  return (
    <div
      className="flex gap-1 overflow-x-auto border-b"
      style={{ borderColor: "var(--border)" }}
    >
      {TABS.map((t) => {
        const active = isActive(t.to, t.exact);
        const Icon = t.icon;
        return (
          <Link
            key={t.to}
            to={t.to}
            params={{ id: jobId }}
            className={`inline-flex shrink-0 items-center gap-2 px-4 py-2.5 text-[13px] transition-colors ${
              active
                ? "border-b-2 font-bold text-foreground"
                : "border-b-2 border-transparent text-muted-foreground hover:text-foreground"
            }`}
            style={active ? { borderBottomColor: "var(--brand)" } : undefined}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={active ? 2.5 : 2} />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
