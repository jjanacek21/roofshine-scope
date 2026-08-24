import { useState } from "react";
import MarketingShell from "./MarketingShell";
import StepPlayer from "@/components/marketing/StepPlayer";
import Lightbox from "@/components/marketing/Lightbox";
import { screens, type Screen } from "@/lib/marketingScreens";

type Tab = {
  id: string;
  label: string;
  headline: string;
  body: string;
  keys: string[];
  player?: boolean;
  aspect: "phone" | "paper";
  intervalMs?: number;
};

const TABS: Tab[] = [
  {
    id: "measure",
    label: "Measure",
    headline: "Measure the roof before you get out of the truck.",
    body: "Drop a pin, let the outline trace itself, then draw ridges, hips and valleys and label every edge. Squares, pitch and linear footage are done before you touch a ladder.",
    keys: ["m1_pin", "m2_measuring", "m3_footprint", "m4_drawing", "m5_lines", "m6_label", "m7_labeled"],
    player: true,
    aspect: "phone",
  },
  {
    id: "takeoff",
    label: "Roof takeoff",
    headline: "The takeoff fills itself in.",
    body: "Drip edge, rake edge, ridge cap, valley and gutter quantities carry straight over from the labeled measurement. Expand a category and adjust anything that is different in the field.",
    keys: ["tk_1", "tk_2"],
    aspect: "phone",
  },
  {
    id: "exterior",
    label: "Exterior & interior",
    headline: "Every elevation, every room, in order.",
    body: "The app prompts one wide shot per elevation, then walks the interior room by room. Anything skipped prints as not inspected instead of quietly disappearing.",
    keys: ["ex_1", "ex_2", "wideshots"],
    aspect: "phone",
  },
  {
    id: "photos",
    label: "Photos",
    headline: "Photos tagged to the damage they prove.",
    body: "Each photo is attached to the slope, elevation or room it came from, so the report writes itself instead of you sorting a camera roll at 9pm.",
    keys: ["ph_1", "wideshots"],
    aspect: "phone",
  },
  {
    id: "estimate",
    label: "Estimate",
    headline: "Price per square, or full carrier line item.",
    body: "Pick the pricing mode per job. Line items pull from a regional, Xactimate-coded price book — and any quantity you edit by hand stays edited through a recalculation.",
    keys: ["cr_1", "cr_2", "cr_3", "cr_4"],
    player: true,
    aspect: "phone",
    intervalMs: 2400,
  },
  {
    id: "report",
    label: "Damage report",
    headline: "A damage report a desk adjuster can follow.",
    body: "Property, claim and inspection details up front, then the findings written next to the photographs that support them.",
    keys: ["rb_cover", "rb_1"],
    aspect: "paper",
  },
  {
    id: "presentation",
    label: "Presentation",
    headline: "Present it at the kitchen table.",
    body: "Tap a stat to open the measurement report, the photo documentation or the carrier-style estimate — full size, no scrolling through a PDF on a phone.",
    keys: ["pr_1", "progress"],
    aspect: "phone",
  },
  {
    id: "authorization",
    label: "Authorization",
    headline: "Signed before you leave the driveway.",
    body: "Scope of work in two balanced columns, contract price and payment schedule underneath, signature captured on the same screen.",
    keys: ["au_1"],
    aspect: "phone",
  },
];

const CSS = `
.mkt-tabs{display:flex;gap:8px;overflow-x:auto;padding:4px 0 10px;-webkit-overflow-scrolling:touch;
  scrollbar-width:none}
.mkt-tabs::-webkit-scrollbar{display:none}
.mkt-tab{flex:0 0 auto;border:1px solid var(--cb-hairline);background:var(--cb-surface);
  color:var(--cb-text-dim);border-radius:999px;padding:10px 16px;font-size:14px;font-weight:600;
  cursor:pointer;transition:all .18s var(--cb-ease)}
.mkt-tab:hover{color:var(--cb-text);transform:translateY(-1px)}
.mkt-tab.is-on{background:var(--cb-accent);border-color:var(--cb-accent);color:#fff;
  box-shadow:0 8px 20px rgba(21,128,61,.28)}
.mkt-2col{display:grid;grid-template-columns:0.95fr 1.05fr;gap:34px;align-items:center;margin-top:26px}
@media(max-width:960px){.mkt-2col{grid-template-columns:1fr;gap:24px}}
.mkt-bezel{border-radius:34px;padding:12px;background:linear-gradient(160deg,#20262e,#0d1014);
  box-shadow:0 34px 70px rgba(9,12,16,.34),inset 0 1px 0 rgba(255,255,255,.12)}
.mkt-bezel > div{border-radius:24px;overflow:hidden;background:#0f1216}
.mkt-paper{border-radius:12px;overflow:hidden;border:1px solid var(--cb-hairline);background:#fff;
  box-shadow:0 26px 60px rgba(9,12,16,.22)}
.mkt-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:16px;margin-top:30px}
.mkt-card{border:1px solid var(--cb-hairline);border-radius:16px;overflow:hidden;background:var(--cb-surface);
  cursor:pointer;text-align:left;padding:0;transition:transform .2s var(--cb-ease),box-shadow .2s var(--cb-ease)}
.mkt-card:hover{transform:translateY(-3px);box-shadow:0 18px 36px rgba(9,12,16,.16)}
.mkt-card img{width:100%;display:block;aspect-ratio:4/5;object-fit:cover;background:#0f1216}
.mkt-card.is-paper img{aspect-ratio:816/1056;object-fit:contain;background:#fff}
.mkt-card__b{padding:12px 14px 14px}
.mkt-card__t{font-size:14px;font-weight:700}
.mkt-card__c{font-size:12.5px;color:var(--cb-text-muted);margin-top:4px;line-height:1.45}
`;

export default function ProductPage() {
  const [tabId, setTabId] = useState(TABS[0].id);
  const [lb, setLb] = useState<Screen | null>(null);
  const tab = TABS.find((t) => t.id === tabId)!;
  const items = screens(tab.keys);
  const hero = items[0];

  return (
    <MarketingShell>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "44px 22px 70px" }}>
        <h1 style={{ fontSize: "clamp(30px,5vw,46px)", letterSpacing: "-0.03em", margin: 0 }}>
          Every screen a rep touches.
        </h1>
        <p
          style={{
            marginTop: 12,
            fontSize: 17,
            color: "var(--cb-text-dim)",
            maxWidth: 620,
            lineHeight: 1.55,
          }}
        >
          From the pin drop to the signed authorization — this is the whole job, in the order you
          actually work it.
        </p>

        <div className="mkt-tabs" role="tablist" aria-label="Product areas" style={{ marginTop: 26 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={t.id === tabId}
              className={`mkt-tab ${t.id === tabId ? "is-on" : ""}`}
              onClick={() => setTabId(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mkt-2col" key={tab.id}>
          <div>
            <h2 style={{ fontSize: "clamp(23px,3.2vw,31px)", letterSpacing: "-0.02em", margin: 0 }}>
              {tab.headline}
            </h2>
            <p
              style={{
                marginTop: 12,
                fontSize: 16,
                lineHeight: 1.6,
                color: "var(--cb-text-dim)",
                maxWidth: 520,
              }}
            >
              {tab.body}
            </p>
          </div>

          <div>
            {tab.player ? (
              <div className={tab.aspect === "paper" ? "mkt-paper" : "mkt-bezel"}>
                {tab.aspect === "paper" ? (
                  <StepPlayer
                    frames={items}
                    aspect="paper"
                    intervalMs={tab.intervalMs}
                    onFrameClick={(_i, f) =>
                      setLb(items.find((s) => s.src === f.src) ?? null)
                    }
                  />
                ) : (
                  <div>
                    <StepPlayer
                      frames={items}
                      aspect="phone"
                      intervalMs={tab.intervalMs}
                      onFrameClick={(_i, f) =>
                        setLb(items.find((s) => s.src === f.src) ?? null)
                      }
                    />
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setLb(hero)}
                style={{ display: "block", width: "100%", border: 0, background: "none", padding: 0, cursor: "pointer" }}
              >
                {hero.shape === "paper" ? (
                  <div className="mkt-paper">
                    <img src={hero.src} alt={hero.title} style={{ width: "100%", display: "block" }} />
                  </div>
                ) : (
                  <div className="mkt-bezel">
                    <div>
                      <img src={hero.src} alt={hero.title} style={{ width: "100%", display: "block" }} />
                    </div>
                  </div>
                )}
              </button>
            )}
          </div>
        </div>

        <div className="mkt-grid">
          {items.map((s) => (
            <button
              key={s.key}
              type="button"
              className={`mkt-card ${s.shape === "paper" ? "is-paper" : ""}`}
              onClick={() => setLb(s)}
            >
              <img src={s.src} alt={s.title} loading="lazy" />
              <div className="mkt-card__b">
                <div className="mkt-card__t">{s.title}</div>
                <div className="mkt-card__c">{s.caption}</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {lb && <Lightbox src={lb.src} title={lb.title} onClose={() => setLb(null)} />}
    </MarketingShell>
  );
}
