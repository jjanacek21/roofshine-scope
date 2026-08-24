import { useMemo, useState } from "react";
import MarketingShell from "./MarketingShell";
import Lightbox from "@/components/marketing/Lightbox";
import { CATEGORY_LABELS, CATEGORY_ORDER, SCREENS, type Screen } from "@/lib/marketingScreens";

const CSS = `
.gal-chips{display:flex;gap:8px;flex-wrap:wrap;margin-top:22px}
.gal-chip{border:1px solid var(--cb-hairline);background:var(--cb-surface);color:var(--cb-text-dim);
  border-radius:999px;padding:9px 15px;font-size:13.5px;font-weight:600;cursor:pointer;
  transition:all .18s var(--cb-ease)}
.gal-chip:hover{color:var(--cb-text);transform:translateY(-1px)}
.gal-chip.is-on{background:var(--cb-accent);border-color:var(--cb-accent);color:#fff;
  box-shadow:0 8px 20px rgba(21,128,61,.26)}
.gal-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:18px;margin-top:26px}
.gal-item{border:1px solid var(--cb-hairline);border-radius:16px;overflow:hidden;background:var(--cb-surface);
  padding:0;text-align:left;cursor:pointer;transition:transform .2s var(--cb-ease),box-shadow .2s var(--cb-ease)}
.gal-item:hover{transform:translateY(-3px);box-shadow:0 20px 40px rgba(9,12,16,.16)}
.gal-item img{width:100%;display:block;aspect-ratio:4/5;object-fit:cover;background:#0f1216}
.gal-item.is-paper img{aspect-ratio:816/1056;object-fit:contain;background:#fff}
.gal-b{padding:12px 14px 14px}
.gal-t{font-size:14px;font-weight:700}
.gal-c{font-size:12.5px;color:var(--cb-text-muted);margin-top:4px;line-height:1.45}
.gal-k{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--cb-accent);
  font-weight:700;margin-bottom:6px}
`;

export default function GalleryPage() {
  const [cat, setCat] = useState<string>("all");
  const [lb, setLb] = useState<Screen | null>(null);

  const chips = useMemo(
    () => [
      { id: "all", label: "All" },
      ...CATEGORY_ORDER.filter((c) => SCREENS.some((s) => s.category === c)).map((c) => ({
        id: c,
        label: CATEGORY_LABELS[c] ?? c,
      })),
    ],
    [],
  );

  const items = useMemo(
    () => (cat === "all" ? SCREENS : SCREENS.filter((s) => s.category === cat)),
    [cat],
  );

  return (
    <MarketingShell>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "44px 22px 70px" }}>
        <h1 style={{ fontSize: "clamp(30px,5vw,46px)", letterSpacing: "-0.03em", margin: 0 }}>
          Every screen, up close.
        </h1>
        <p style={{ marginTop: 12, fontSize: 17, color: "var(--cb-text-dim)", maxWidth: 620, lineHeight: 1.55 }}>
          {SCREENS.length} screenshots straight out of the app. Tap any one to open it full size.
        </p>

        <div className="gal-chips" role="tablist" aria-label="Filter screenshots">
          {chips.map((c) => (
            <button
              key={c.id}
              type="button"
              role="tab"
              aria-selected={c.id === cat}
              className={`gal-chip ${c.id === cat ? "is-on" : ""}`}
              onClick={() => setCat(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="gal-grid">
          {items.map((s) => (
            <button
              key={s.key}
              type="button"
              className={`gal-item ${s.shape === "paper" ? "is-paper" : ""}`}
              onClick={() => setLb(s)}
            >
              <img src={s.src} alt={s.title} loading="lazy" />
              <div className="gal-b">
                <div className="gal-k">{CATEGORY_LABELS[s.category] ?? s.category}</div>
                <div className="gal-t">{s.title}</div>
                <div className="gal-c">{s.caption}</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {lb && <Lightbox src={lb.src} title={lb.title} onClose={() => setLb(null)} />}
    </MarketingShell>
  );
}
