import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { CbSurface } from "./CbSurface";
import { CbReveal } from "./motion";
import { CbCard, CbButton } from "./primitives";
import { useCbSession } from "@/components/auth/CbSessionProvider";

const TABS = [
  { to: "/cb/admin/branding", label: "Branding" },
  { to: "/cb/admin/team", label: "Team" },
  { to: "/cb/admin/pricing", label: "Pricing" },
] as const;

export function CbAdminShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const { workspace, loading } = useCbSession();
  const isAdmin = workspace?.role === "admin" || workspace?.role === "owner";

  return (
    <CbSurface>
      <div className="min-h-screen" style={{ background: "var(--cb-bg)" }}>
        <div className="mx-auto w-full max-w-[840px] px-5 pb-24 pt-8">
          <CbReveal>
            <button
              type="button"
              onClick={() => navigate({ to: "/cb" })}
              className="mb-4 inline-flex items-center gap-1 text-[13px]"
              style={{ color: "var(--cb-text-muted)" }}
            >
              <ChevronLeft className="h-4 w-4" />
              Inspections
            </button>
            <h1 className="cb-display" style={{ fontSize: 26, lineHeight: 1.15 }}>
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-1 text-[13.5px]" style={{ color: "var(--cb-text-muted)" }}>
                {subtitle}
              </p>
            ) : null}
          </CbReveal>

          <CbReveal delay={60}>
            <nav className="mt-5 flex flex-wrap gap-2" aria-label="Admin sections">
              {TABS.map((t) => (
                <Link
                  key={t.to}
                  to={t.to}
                  className="cb-chip"
                  activeProps={{
                    className: "cb-chip is-active",
                    style: { background: "var(--cb-accent)", color: "#fff", borderColor: "transparent" },
                  }}
                >
                  {t.label}
                </Link>
              ))}
              <Link to="/cb/settings" className="cb-chip">
                Settings
              </Link>
            </nav>
          </CbReveal>

          <div className="mt-6">
            {loading ? null : !isAdmin ? (
              <CbCard elevation="card" style={{ padding: 20 }}>
                <p className="text-[15px] font-semibold">Admins only</p>
                <p className="mt-1 text-[13px]" style={{ color: "var(--cb-text-muted)" }}>
                  Ask a workspace admin to change branding, seats, or pricing.
                </p>
                <div className="mt-4">
                  <CbButton size="md" variant="secondary" onClick={() => navigate({ to: "/cb" })}>
                    Back to inspections
                  </CbButton>
                </div>
              </CbCard>
            ) : (
              children
            )}
          </div>
        </div>
      </div>
    </CbSurface>
  );
}
