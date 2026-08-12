import type { ReactNode } from "react";

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
    <div
      className="flex min-h-screen items-center justify-center px-5 py-10"
      style={{
        background:
          "radial-gradient(ellipse at top, rgba(21,128,61,.12), transparent 55%), var(--bg)",
      }}
    >
      <div
        className="relative w-full max-w-[420px] p-10"
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 20,
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div className="mb-8 flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-[10px] text-sm font-black text-white"
            style={{ background: "var(--brand)" }}
          >
            CB
          </div>
          <span
            className="text-[17px] font-extrabold tracking-tight text-foreground"
          >
            Claim Buddy
          </span>
        </div>

        <h1 className="font-bold text-foreground" style={{ fontSize: 24, letterSpacing: "-0.5px" }}>
          {title}
        </h1>
        <p className="mb-7 mt-1.5 text-[13px]" style={{ color: "var(--text-muted)" }}>
          {subtitle}
        </p>

        {children}
      </div>
    </div>
  );
}
