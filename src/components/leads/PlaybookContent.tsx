import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { renderInline, type PlaybookCategory, type PlaybookSection, PLAYBOOK_COLOR_HEX } from "@/lib/playbook";
import { cn } from "@/lib/utils";

interface Props {
  category: PlaybookCategory;
  /** Sections collapsed by default? Floating panel = true; Training = false. */
  collapsedByDefault?: boolean;
  /** Smaller spacing for the floating panel. */
  dense?: boolean;
}

export function PlaybookCategoryView({ category, collapsedByDefault = false, dense = false }: Props) {
  const accent = PLAYBOOK_COLOR_HEX[category.color];
  return (
    <section className={dense ? "space-y-2" : "space-y-3"}>
      <header className="flex items-center gap-2">
        <span className="text-xl leading-none" aria-hidden>{category.emoji}</span>
        <h3
          className={cn("font-semibold tracking-tight", dense ? "text-sm" : "text-base")}
          style={{ color: accent }}
        >
          {category.title}
        </h3>
      </header>
      <div className={dense ? "space-y-1.5" : "space-y-2"}>
        {category.sections.map((s) => (
          <SectionAccordion key={s.id} section={s} accent={accent} defaultOpen={!collapsedByDefault} dense={dense} />
        ))}
      </div>
    </section>
  );
}

function SectionAccordion({
  section,
  accent,
  defaultOpen,
  dense,
}: {
  section: PlaybookSection;
  accent: string;
  defaultOpen: boolean;
  dense: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className="rounded-xl border"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center justify-between gap-2 text-left",
          dense ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2.5 text-sm",
        )}
      >
        <span className="font-medium text-foreground">{section.title}</span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 shrink-0 transition-transform", open && "rotate-180")}
          style={{ color: accent }}
        />
      </button>
      {open && (
        <div
          className={cn(
            "border-t whitespace-pre-line text-foreground/90",
            dense ? "px-2.5 pb-2 pt-1.5 text-[11px] leading-snug" : "px-3.5 pb-3 pt-2 text-sm leading-relaxed",
          )}
          style={{ borderColor: "var(--border)" }}
        >
          {section.body.split("\n").map((line, i) => (
            <div key={i}>{renderInline(line)}{line.length === 0 ? "\u00A0" : ""}</div>
          ))}
        </div>
      )}
    </div>
  );
}
