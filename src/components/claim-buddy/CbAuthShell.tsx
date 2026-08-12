import type { ReactNode } from "react";
import { CbSurface } from "@/components/cb/CbSurface";
import { CbCard } from "@/components/cb/primitives";
import { CbHeadline, CbReveal } from "@/components/cb/motion";

/** Shared framing for the standalone Claim Buddy auth screens. */
export function CbAuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <CbSurface>
      <div
        className="flex min-h-screen items-center justify-center px-5 py-10"
        style={{
          background:
            "radial-gradient(ellipse at top, rgba(var(--cb-accent-rgb), .12), transparent 55%), var(--cb-bg)",
        }}
      >
        <CbCard elevation="floating" className="w-full max-w-[440px]" style={{ padding: 30 }}>
          <CbReveal>
            <div className="mb-8 flex items-center gap-2.5">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-[10px] text-sm font-black"
                style={{
                  background:
                    "linear-gradient(160deg, var(--cb-accent-bright), var(--cb-accent-deep))",
                  color: "var(--cb-on-accent)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,.28), var(--cb-shadow-card)",
                }}
              >
                CB
              </div>
              <span className="text-[17px] font-extrabold tracking-tight">Claim Buddy</span>
            </div>
          </CbReveal>

          <CbHeadline
            text={title}
            as="h1"
            className="cb-display"
            style={{ fontSize: 26, lineHeight: 1.15 }}
          />
          <CbReveal delay={110}>
            <p className="mb-7 mt-2 text-[13.5px]" style={{ color: "var(--cb-text-muted)" }}>
              {subtitle}
            </p>
          </CbReveal>

          <CbReveal delay={165}>{children}</CbReveal>
        </CbCard>
      </div>
    </CbSurface>
  );
}
