import { Quote, ListChecks, MessageCircleQuestion, Info } from "lucide-react";
import type { PlaybookSection, PlaybookBlock } from "@/lib/playbook";
import { fillPlaceholders } from "@/lib/playbook";

export function PlaybookSectionView({
  section,
  ctx,
}: {
  section: PlaybookSection;
  ctx?: Record<string, string | number | null | undefined>;
}) {
  return (
    <section className="space-y-4">
      <header>
        <h3 className="text-base font-semibold text-foreground">{section.title}</h3>
        <p className="text-xs text-[var(--text-dim)]">{section.short}</p>
      </header>
      <div className="space-y-3">
        {section.blocks.map((b, i) => (
          <BlockView key={i} block={b} ctx={ctx} />
        ))}
      </div>
    </section>
  );
}

function BlockView({
  block,
  ctx,
}: {
  block: PlaybookBlock;
  ctx?: Record<string, string | number | null | undefined>;
}) {
  const fill = (s: string) => (ctx ? fillPlaceholders(s, ctx) : s);

  if (block.kind === "script") {
    return (
      <div
        className="rounded-xl border p-4"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
      >
        <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">
          <Quote className="h-3.5 w-3.5" />
          {block.label}
        </div>
        <div className="space-y-2 text-sm leading-relaxed text-foreground">
          {block.lines.map((l, i) => (
            <p key={i}>{fill(l)}</p>
          ))}
        </div>
      </div>
    );
  }

  if (block.kind === "qa") {
    return (
      <div
        className="rounded-xl border p-4"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
      >
        <div className="mb-2 flex items-start gap-2">
          <MessageCircleQuestion className="mt-0.5 h-4 w-4 text-[var(--text-dim)]" />
          <p className="text-sm font-semibold text-foreground">{fill(block.question)}</p>
        </div>
        <p className="pl-6 text-sm leading-relaxed text-[var(--text-dim)]">{fill(block.answer)}</p>
      </div>
    );
  }

  if (block.kind === "list") {
    return (
      <div
        className="rounded-xl border p-4"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
      >
        <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">
          <ListChecks className="h-3.5 w-3.5" />
          {block.label}
        </div>
        <ul className="space-y-1.5 text-sm text-foreground">
          {block.items.map((it, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-[var(--text-dim)]">•</span>
              <span>{fill(it)}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div
      className="flex gap-3 rounded-xl border p-4"
      style={{
        borderColor: "var(--border)",
        backgroundColor: "color-mix(in oklab, var(--primary) 8%, var(--bg-card))",
      }}
    >
      <Info className="h-4 w-4 shrink-0 text-[var(--primary)]" />
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-dim)]">{block.label}</p>
        <p className="mt-1 text-sm leading-relaxed text-foreground">{fill(block.body)}</p>
      </div>
    </div>
  );
}
