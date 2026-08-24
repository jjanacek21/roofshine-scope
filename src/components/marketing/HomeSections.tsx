import { useCallback, useEffect, useRef, useState } from "react";

/* ---------------- reveal helper ---------------- */

const STAGGER_MS = 70;
const STAGGER_CAP_MS = 420;

export function revealDelay(i: number) {
  return Math.min(i * STAGGER_MS, STAGGER_CAP_MS);
}

/** Observes a container and flips `is-in` on every `.cb-reveal` inside it. */
function useRevealGroup<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setInView(true);
            io.disconnect();
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.06 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return { ref, inView };
}

function rev(inView: boolean, i = 0, base = "") {
  return {
    className: `${base ? base + " " : ""}cb-reveal${inView ? " is-in" : ""}`,
    style: { transitionDelay: `${revealDelay(i)}ms` } as React.CSSProperties,
  };
}

/* ---------------- shared CSS ---------------- */

const CSS = `
.mkt-sec{padding:74px 22px}
.mkt-sec__in{max-width:1200px;margin:0 auto}
.mkt-h2{font-family:Archivo,system-ui,sans-serif;font-weight:800;letter-spacing:-.02em;
  font-size:clamp(1.6rem,3vw,2.35rem);line-height:1.12;margin:8px 0 0;color:var(--cb-text)}
.mkt-eyebrow{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;letter-spacing:.12em;
  text-transform:uppercase;color:var(--cb-text-muted)}
.mkt-p{font-size:16px;line-height:1.62;color:var(--cb-text-dim)}
.mkt-scroller{overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch}

/* 1 — marquee */
.mkt-marquee{position:relative;padding:42px 0;background:var(--cb-surface-2);
  border-top:1px solid var(--cb-hairline);border-bottom:1px solid var(--cb-hairline);overflow:hidden;
  -webkit-mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent);
  mask-image:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)}
.mkt-marquee__track{display:flex;gap:14px;width:max-content;animation:mkt-marq 58s linear infinite}
.mkt-marquee:hover .mkt-marquee__track,.mkt-marquee:focus-within .mkt-marquee__track{animation-play-state:paused}
@keyframes mkt-marq{from{transform:translate3d(0,0,0)}to{transform:translate3d(-50%,0,0)}}
.mkt-marquee__card{flex:0 0 172px;width:172px;padding:0;border:1px solid var(--cb-hairline);
  border-radius:14px;overflow:hidden;background:var(--cb-surface);cursor:zoom-in;
  box-shadow:var(--cb-shadow-sm,0 6px 18px rgba(0,0,0,.08));transition:transform .2s ease}
.mkt-marquee__card:hover{transform:translateY(-3px)}
.mkt-marquee__card img{display:block;width:100%;height:206px;object-fit:cover}

/* lightbox */
.mkt-lb{position:fixed;inset:0;z-index:120;background:rgba(8,10,13,.82);display:grid;place-items:center;
  padding:22px;animation:cb-fade .2s ease both}
.mkt-lb img{max-width:min(92vw,900px);max-height:86vh;border-radius:16px;
  box-shadow:0 40px 90px rgba(0,0,0,.5);background:#fff}
.mkt-lb__x{position:absolute;top:16px;right:18px;width:40px;height:40px;border-radius:999px;
  border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.1);color:#fff;font-size:20px;
  line-height:1;cursor:pointer}

/* 2 — on site */
.mkt-onsite__card{border:1px solid var(--cb-hairline);background:var(--cb-surface);border-radius:18px;
  box-shadow:var(--cb-shadow-card,0 10px 30px rgba(0,0,0,.06));overflow:hidden}
.mkt-onsite__row{display:grid;grid-template-columns:repeat(5,minmax(200px,1fr));min-width:1000px}
.mkt-onsite__col{padding:24px 20px;border-left:1px solid var(--cb-hairline)}
.mkt-onsite__col:first-child{border-left:0}
.mkt-num{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:12px;color:var(--cb-accent,#15803d);
  letter-spacing:.08em}
.mkt-onsite__col h3{margin:10px 0 8px;font-size:16px;font-weight:800;color:var(--cb-text)}
.mkt-onsite__col p{margin:0;font-size:14px;line-height:1.55;color:var(--cb-text-dim)}

/* 3 — three inspections */
.mkt-tri{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:26px}
.mkt-card{border:1px solid var(--cb-hairline);background:var(--cb-surface);border-radius:18px;padding:22px;
  box-shadow:var(--cb-shadow-card,0 10px 30px rgba(0,0,0,.06))}
.mkt-chip2{display:inline-block;font-size:11.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
  padding:5px 10px;border-radius:999px;background:rgba(21,128,61,.12);color:#15803d;
  border:1px solid rgba(21,128,61,.28)}
.mkt-chip2--amber{background:rgba(180,83,9,.12);color:#b45309;border-color:rgba(180,83,9,.3)}
.mkt-card h3{margin:14px 0 10px;font-size:18px;font-weight:800;color:var(--cb-text)}
.mkt-bul{list-style:none;margin:0;padding:0;display:grid;gap:9px}
.mkt-bul li{position:relative;padding-left:18px;font-size:14.5px;line-height:1.55;color:var(--cb-text-dim)}
.mkt-bul li::before{content:"";position:absolute;left:0;top:8px;width:7px;height:7px;border-radius:2px;
  background:#15803d}
.mkt-bul--amber li::before{background:#b45309}
.mkt-split{display:grid;grid-template-columns:1.05fr .95fr;gap:34px;align-items:center;margin-top:34px}
.mkt-bezel2{padding:9px;border-radius:30px;background:linear-gradient(165deg,#3a424e,#14161a);
  box-shadow:0 34px 70px rgba(0,0,0,.3);max-width:330px;margin:0 auto;width:100%}
.mkt-bezel2 img{display:block;width:100%;border-radius:22px}

/* 4 — stats */
.mkt-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:26px}
.mkt-stat{position:relative;overflow:hidden;border:1px solid var(--cb-hairline);background:var(--cb-surface);
  border-radius:18px;padding:26px 22px;box-shadow:var(--cb-shadow-card,0 10px 30px rgba(0,0,0,.06))}
.mkt-stat::before{content:"";position:absolute;left:-40px;bottom:-60px;width:210px;height:210px;
  background:radial-gradient(circle,rgba(21,128,61,.20),transparent 68%);pointer-events:none}
.mkt-stat__n{position:relative;font-family:Archivo,system-ui,sans-serif;font-weight:900;letter-spacing:-.03em;
  font-size:clamp(2rem,4vw,2.9rem);line-height:1;color:var(--cb-text)}
.mkt-stat__l{position:relative;margin-top:10px;font-size:14.5px;line-height:1.5;color:var(--cb-text-dim)}

/* 5 — pull quote */
.mkt-quote{border-left:3px solid #15803d;border-radius:0 18px 18px 0;background:var(--cb-surface);
  border-top:1px solid var(--cb-hairline);border-right:1px solid var(--cb-hairline);
  border-bottom:1px solid var(--cb-hairline);
  box-shadow:var(--cb-shadow-floating,0 26px 60px rgba(0,0,0,.12));padding:34px clamp(20px,4vw,44px)}
.mkt-quote p{margin:0;font-family:var(--font-serif,"Instrument Serif",Georgia,serif);
  font-size:clamp(1.35rem,3.1vw,2.1rem);line-height:1.32;color:var(--cb-text)}

/* 6 — about */
.mkt-about{display:grid;grid-template-columns:1.05fr .95fr;gap:38px;align-items:start}
.mkt-mini{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.mkt-mini__c{border:1px solid var(--cb-hairline);background:var(--cb-surface);border-radius:16px;padding:18px;
  box-shadow:var(--cb-shadow-card,0 10px 30px rgba(0,0,0,.06))}
.mkt-mini__n{font-family:Archivo,system-ui,sans-serif;font-weight:900;font-size:1.5rem;color:var(--cb-text)}
.mkt-mini__l{margin-top:6px;font-size:13px;line-height:1.45;color:var(--cb-text-dim)}

/* 7 — closing */
.mkt-close{padding:74px 22px 96px}
.mkt-close__card{position:relative;max-width:820px;margin:0 auto;text-align:center;border-radius:24px;
  border:1px solid var(--cb-hairline);background:var(--cb-surface);
  box-shadow:var(--cb-shadow-floating,0 34px 80px rgba(0,0,0,.16));padding:48px 26px 52px;overflow:visible}
.mkt-close__glow{position:absolute;left:50%;bottom:-120px;transform:translateX(-50%);width:min(760px,110%);
  height:340px;pointer-events:none;z-index:-1;
  background:radial-gradient(ellipse at center,rgba(21,128,61,.34),transparent 66%);filter:blur(8px)}
.mkt-close__btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:24px}

@media (max-width:959px){
  .mkt-sec{padding:52px 22px}
  .mkt-close{padding:52px 22px 76px}
  .mkt-tri,.mkt-stats{grid-template-columns:1fr}
  .mkt-split,.mkt-about{grid-template-columns:1fr;gap:26px}
}
`;

/* ---------------- 1. marquee ---------------- */

const SHOTS = [
  "m1_pin.jpg",
  "m2_measuring.jpg",
  "m3_footprint.jpg",
  "m4_drawing.jpg",
  "m5_lines.jpg",
  "m6_label.jpg",
  "m7_labeled.jpg",
  "progress.jpg",
  "wideshots.jpg",
  "rb_cover.jpg",
].map((f) => `/marketing/screens/${f}`);

function MarqueeSection({ onOpen }: { onOpen: (src: string) => void }) {
  const loop = [...SHOTS, ...SHOTS];
  return (
    <section className="mkt-marquee" id="gallery" aria-label="Screenshot gallery">
      <div className="mkt-marquee__track">
        {loop.map((src, i) => (
          <button
            key={`${src}-${i}`}
            type="button"
            className="mkt-marquee__card"
            onClick={() => onOpen(src)}
            aria-label="Open screenshot"
          >
            <img src={src} alt="" loading="lazy" width={172} height={206} />
          </button>
        ))}
      </div>
    </section>
  );
}

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="mkt-lb" onClick={onClose} role="dialog" aria-modal="true">
      <button type="button" className="mkt-lb__x" onClick={onClose} aria-label="Close">
        ×
      </button>
      <img src={src} alt="" onClick={(e) => e.stopPropagation()} />
    </div>
  );
}

/* ---------------- 2. on site ---------------- */

const ONSITE = [
  ["01", "Measure", "Pin the address, trace the roof from satellite, label every edge before you get out of the truck."],
  ["02", "Roof", "Slope by slope: test squares, damage counts, flashings, penetrations, photos tied to the facet."],
  ["03", "Exterior", "Four elevations, gutters, screens, soft metals — wide shots plus the close-ups that prove it."],
  ["04", "Interior", "Ceilings, walls and the attic. Every room you enter is documented or marked not inspected."],
  ["05", "Deliver", "Measurement report, photo report, carrier-style estimate and the contract — before you leave."],
];

function OnSiteSection({ inView }: { inView: boolean }) {
  return (
    <div className="mkt-sec__in">
      <div className="mkt-eyebrow">The visit</div>
      <h2 {...rev(inView, 0, "mkt-h2")}>
        What happens on site
      </h2>
      <div className="mkt-scroller" style={{ marginTop: 22 }}>
        <div className="mkt-onsite__card">
          <div className="mkt-onsite__row">
            {ONSITE.map(([n, title, body], i) => (
              <div className="mkt-onsite__col" key={n} {...rev(inView, i + 1)}>
                <div className="mkt-num">{n}</div>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- 3. three inspections ---------------- */

function TriSection({ inView }: { inView: boolean }) {
  return (
    <div className="mkt-sec__in">
      <div className="mkt-eyebrow">Three inspections, one job</div>
      <h2 {...rev(inView, 0, "mkt-h2")}>
        The roof was never the whole claim.
      </h2>

      <div className="mkt-tri">
        <div {...rev(inView, 1, "mkt-card")}>
          <span className="mkt-chip2">Roof</span>
          <h3>Slope by slope</h3>
          <ul className="mkt-bul">
            <li>Test squares with hit counts per slope.</li>
            <li>Ridge, hip, valley and flashing condition.</li>
            <li>Photos attach to the facet they came from.</li>
          </ul>
        </div>

        <div {...rev(inView, 2, "mkt-card")}>
          <span className="mkt-chip2">Exterior — 4 elevations</span>
          <h3>All the way around</h3>
          <ul className="mkt-bul">
            <li>A wide shot per elevation, prompted in order.</li>
            <li>Gutters, downspouts, screens and soft metals.</li>
            <li>Collateral damage the adjuster tends to miss.</li>
          </ul>
        </div>

        <div {...rev(inView, 3, "mkt-card")}>
          <span className="mkt-chip2 mkt-chip2--amber">Interior</span>
          <h3>Inside counts too</h3>
          <ul className="mkt-bul mkt-bul--amber">
            <li>Room by room: ceilings, walls, windows, attic.</li>
            <li>Stains and leaks tied back to the slope above.</li>
            <li>Skip it and the report prints Not inspected — never a blank.</li>
          </ul>
        </div>
      </div>

      <div className="mkt-split">
        <div {...rev(inView, 4)}>
          <h3 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 12px" }}>
            One progress list, all three inspections
          </h3>
          <p className="mkt-p" style={{ maxWidth: "56ch" }}>
            The rep never wonders what is left. Roof, exterior and interior live in the same checklist
            with the same counter, so a job is either finished or it tells you exactly which item is
            not. Pick it up on the next visit and it opens on the step you stopped at.
          </p>
          <p className="mkt-p" style={{ maxWidth: "56ch" }}>
            Nothing is optional by accident — an item you deliberately skip is recorded as skipped and
            prints that way on the report.
          </p>
        </div>
        <div {...rev(inView, 5, "mkt-bezel2")}>
          <img
            src="/marketing/screens/progress.jpg"
            alt="Inspection progress checklist covering roof, exterior and interior"
            loading="lazy"
            width={752}
            height={896}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------------- 4. stats ---------------- */

const STATS: Array<[string, string]> = [
  ["~10s", "Address to traced footprint."],
  ["0×", "Re-keying between measurement, estimate and contract."],
  ["4 docs", "What you leave with: measurements, photos, estimate, contract."],
];

function WhySection({ inView }: { inView: boolean }) {
  return (
    <div className="mkt-sec__in">
      <div className="mkt-eyebrow">The difference</div>
      <h2 {...rev(inView, 0, "mkt-h2")}>
        Why reps switch
      </h2>
      <div className="mkt-stats">
        {STATS.map(([n, l], i) => (
          <div className="mkt-stat" key={n} {...rev(inView, i + 1)}>
            <div className="mkt-stat__n">{n}</div>
            <div className="mkt-stat__l">{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- 6. about ---------------- */

const MINI: Array<[string, string]> = [
  ["FL", "Licensed restoration contractor"],
  ["3", "Inspections in every job"],
  ["1", "Engine behind both products"],
  ["0", "Desktop software required"],
];

function AboutSection({ inView }: { inView: boolean }) {
  return (
    <div className="mkt-sec__in">
      <div className="mkt-about">
        <div>
          <div className="mkt-eyebrow">About</div>
          <h2 {...rev(inView, 0, "mkt-h2")}>
            Built by a roofer, on real claims.
          </h2>
          <p className="mkt-p" style={{ maxWidth: "58ch" }}>
            Global Contractor Network is a Florida restoration contractor. Claim Buddy started as the
            tool we needed on our own storm routes — measurements that hold up, an inspection that
            covers the whole loss, and paperwork the homeowner can sign at the table.
          </p>
          <p className="mkt-p" style={{ maxWidth: "58ch" }}>
            gcn.claims runs in the phone browser, so there is nothing to install and nothing to sync.
            The same measurement and estimating engine powers globalcontractor.app, the full production
            platform our own crews run on every day.
          </p>
        </div>
        <div className="mkt-mini">
          {MINI.map(([n, l], i) => (
            <div className="mkt-mini__c" key={l} {...rev(inView, i + 1)}>
              <div className="mkt-mini__n">{n}</div>
              <div className="mkt-mini__l">{l}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- wrapper ---------------- */

function Section({
  id,
  children,
  style,
}: {
  id?: string;
  children: (inView: boolean) => React.ReactNode;
  style?: React.CSSProperties;
}) {
  const { ref, inView } = useRevealGroup<HTMLElement>();
  return (
    <section className="mkt-sec" id={id} ref={ref as React.Ref<HTMLElement>} style={style}>
      {children(inView)}
    </section>
  );
}

export default function HomeSections() {
  const [lb, setLb] = useState<string | null>(null);
  const open = useCallback((src: string) => setLb(src), []);
  const quote = useRevealGroup<HTMLElement>();
  const close = useRevealGroup<HTMLElement>();

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <MarqueeSection onOpen={open} />
      {lb && <Lightbox src={lb} onClose={() => setLb(null)} />}

      <Section>{(v) => <OnSiteSection inView={v} />}</Section>

      <Section id="inspections" style={{ background: "var(--cb-surface-2)" }}>
        {(v) => <TriSection inView={v} />}
      </Section>

      <Section>{(v) => <WhySection inView={v} />}</Section>

      <section className="mkt-sec" ref={quote.ref as React.Ref<HTMLElement>}>
        <div className="mkt-sec__in">
          <blockquote {...rev(quote.inView, 0, "mkt-quote")}>
            <p>
              The rep who documents the whole loss on the first visit does not go back for photos, and
              does not negotiate from a scope the carrier wrote.
            </p>
          </blockquote>
        </div>
      </section>

      <Section id="about" style={{ background: "var(--cb-surface-2)" }}>
        {(v) => <AboutSection inView={v} />}
      </Section>

      <section className="mkt-close" ref={close.ref as React.Ref<HTMLElement>}>
        <div className="mkt-sec__in">
          <div {...rev(close.inView, 0, "mkt-close__card")}>
            <span className="mkt-close__glow" />
            <h2 className="mkt-h2">We measure a roof you know on the call.</h2>
            <p className="mkt-p" style={{ margin: "14px auto 0", maxWidth: "52ch" }}>
              Bring an address you have already been to. We will trace it live and you can check the
              squares against your own numbers.
            </p>
            <div className="mkt-close__btns">
              <a
                href="/cb/signup"
                className="cb-btn cb-btn-lg cb-btn-primary"
                style={{ textDecoration: "none" }}
              >
                <span className="cb-specular" />
                <span className="cb-btn-label">Book a demo</span>
              </a>
              <a
                href="/#pricing"
                className="cb-btn cb-btn-lg cb-btn-secondary"
                style={{ textDecoration: "none" }}
              >
                <span className="cb-specular" />
                <span className="cb-btn-label">See pricing</span>
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
