import { useCompany } from "@/hooks/useCompany";

interface LogoProps {
  collapsed?: boolean;
  size?: "sm" | "md" | "lg";
  /** When true, always render the GCN platform brand (use on auth screens). */
  platform?: boolean;
}

export function Logo({ collapsed = false, size = "md", platform = false }: LogoProps) {
  const markSize = size === "lg" ? 44 : size === "sm" ? 32 : 36;
  const fontSize = size === "lg" ? 20 : size === "sm" ? 14 : 16;
  const nameSize = size === "lg" ? 20 : 15;

  const { data: company } = useCompany();
  const useCompanyBrand = !platform && !!company;

  const displayName = useCompanyBrand ? company!.name : "GCN App";
  const tagline = useCompanyBrand ? "Powered by GCN App" : "Estimating OS for Contractors";
  const initial = useCompanyBrand ? (company!.name.trim()[0] ?? "C").toUpperCase() : "G";
  const logoUrl = useCompanyBrand ? company!.logo_url : null;

  return (
    <div className="flex items-center gap-3">
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={`${displayName} logo`}
          className="shrink-0 rounded-lg object-cover"
          style={{
            width: markSize,
            height: markSize,
            background: "var(--bg-hover)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
          }}
        />
      ) : (
        <div
          className="flex shrink-0 items-center justify-center rounded-lg font-black"
          style={{
            width: markSize,
            height: markSize,
            background: "linear-gradient(145deg, var(--chrome-1), var(--chrome-3))",
            color: "#0a0a0b",
            fontSize: fontSize,
            letterSpacing: "-0.5px",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.3), 0 2px 8px rgba(0,0,0,0.5)",
          }}
        >
          {initial}
        </div>
      )}
      {!collapsed && (
        <div className="flex flex-col leading-none">
          <span
            className="font-extrabold tracking-tight text-foreground"
            style={{ fontSize: nameSize, letterSpacing: "-0.3px" }}
          >
            {displayName}
          </span>
          <span
            className="mt-1 text-[10px] font-medium uppercase"
            style={{ color: "var(--text-muted)", letterSpacing: "2px" }}
          >
            {tagline}
          </span>
        </div>
      )}
    </div>
  );
}
