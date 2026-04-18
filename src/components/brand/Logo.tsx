interface LogoProps {
  collapsed?: boolean;
}

export function Logo({ collapsed = false }: LogoProps) {
  return (
    <div className="flex items-center gap-3">
      {/* Chrome "B" logo mark */}
      <div
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-base font-extrabold text-white"
        style={{
          background: "var(--gradient-chrome)",
          boxShadow:
            "var(--shadow-chrome), 0 0 12px rgba(30, 144, 255, 0.25)",
          border: "1px solid var(--border-strong)",
        }}
      >
        <span
          style={{
            background: "linear-gradient(180deg, #ffffff 0%, #a8a8b3 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          B
        </span>
      </div>
      {!collapsed && (
        <div className="flex flex-col leading-none">
          <span className="text-[15px] font-bold tracking-tight text-foreground">
            BuildScope
          </span>
          <span
            className="text-[10px] font-semibold uppercase"
            style={{
              color: "var(--brand)",
              letterSpacing: "0.18em",
            }}
          >
            AI
          </span>
        </div>
      )}
    </div>
  );
}
