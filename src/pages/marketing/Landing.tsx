import { useEffect, useRef, useState } from "react";
import StepPlayer, { type StepFrame } from "@/components/marketing/StepPlayer";
import HomeSections from "@/components/marketing/HomeSections";
import logoVideo from "@/assets/claimbuddy-logo.mp4.asset.json";
import {
  EMPTY_SITE_CONTENT,
  arr,
  blockOf,
  mediaKeyOf,
  obj,
  str,
  type SiteContent,
  type SiteJson,
} from "@/lib/site-content.types";


const STEP_FRAMES: StepFrame[] = [
  {
    src: "/marketing/screens/m1_pin.jpg",
    title: "Drop the pin",
    caption: "Type the address, confirm the right house on satellite.",
  },
  {
    src: "/marketing/screens/m2_measuring.jpg",
    title: "Measuring…",
    caption: "The roof traces itself from imagery in a few seconds.",
  },
  {
    src: "/marketing/screens/m3_footprint.jpg",
    title: "One outline per structure",
    caption: "House, garage, shed — each gets its own closed outline.",
  },
  {
    src: "/marketing/screens/m4_drawing.jpg",
    title: "Draw by hand too",
    caption: "Tap point to point when the imagery is behind the times.",
  },
  {
    src: "/marketing/screens/m5_lines.jpg",
    title: "Ridges, hips and valleys",
    caption: "Draw the interior lines; linear footage updates live.",
  },
  {
    src: "/marketing/screens/m6_label.jpg",
    title: "Label each edge",
    caption: "Pick a type once, then tap every edge that matches.",
  },
  {
    src: "/marketing/screens/m7_labeled.jpg",
    title: "Labeled and totaled",
    caption: "90.4 squares at 10:12 — ready for the takeoff.",
  },
];

/** Frame order is fixed — sequences are looked up by stable media key, never by position. */
function resolveFrames(content: SiteContent, block: SiteJson): StepFrame[] {
  const base = arr<StepFrame>(block, "frames", STEP_FRAMES);
  const byKey = new Map<string, (typeof content.media)[number]>();
  for (const m of content.media) {
    byKey.set(m.key, m);
    if (m.title) byKey.set(mediaKeyOf(m.title), m);
  }
  return base.map((f) => {
    const hit = byKey.get(mediaKeyOf(f.src));
    return hit
      ? { src: hit.url, title: hit.title || f.title, caption: hit.caption ?? f.caption }
      : f;
  });
}

const STEPS_CSS = `
.mkt-steps{background:var(--cb-bg);padding:78px 18px 86px}
.mkt-steps__inner{max-width:1180px;margin:0 auto;display:grid;grid-template-columns:1.02fr .98fr;
  gap:44px;align-items:center}
.mkt-steps h2{font-family:Archivo,system-ui,sans-serif;font-weight:800;letter-spacing:-.02em;
  font-size:clamp(1.7rem,3vw,2.5rem);line-height:1.1;margin:10px 0 0}
.mkt-steps__eyebrow{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;
  letter-spacing:.12em;text-transform:uppercase;color:var(--cb-text-muted)}
.mkt-steps__p{margin:16px 0 20px;font-size:16px;line-height:1.6;color:var(--cb-text-dim);max-width:56ch}
.mkt-chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:24px}
.mkt-chip{font-size:12.5px;font-weight:600;padding:7px 12px;border-radius:999px;
  border:1px solid var(--cb-hairline);background:var(--cb-surface);color:var(--cb-text-dim)}
.mkt-bezel{padding:9px;border-radius:30px;background:linear-gradient(165deg,#3a424e,#14161a);
  box-shadow:0 34px 70px rgba(0,0,0,.32);max-width:360px;margin:0 auto;color:#eef2f7;
  --cb-text-muted:rgba(238,242,247,.6);--cb-hairline:rgba(255,255,255,.16);--cb-surface:rgba(255,255,255,.08);--cb-text:#eef2f7}
@media (max-width:959px){.mkt-steps__inner{grid-template-columns:1fr;gap:30px}.mkt-steps{padding:52px 18px 60px}}
`;

function StepsSection({ content }: { content: SiteContent }) {
  const b = blockOf(content, "steps");
  const frames = resolveFrames(content, blockOf(content, "measure_player"));
  const chips = arr<string>(b, "chips", [
    "One outline per structure",
    "Drag any corner",
    "Draw by hand too",
    "Every edge gets a type",
  ]);
  const cta = obj(b, "cta", { href: "/cb/signup", label: "Measure your address on a call" });
  return (
    <section className="mkt-steps" id="app">
      <style dangerouslySetInnerHTML={{ __html: STEPS_CSS }} />
      <div className="mkt-steps__inner">
        <div>
          <div className="mkt-steps__eyebrow">{str(b, "eyebrow", "Address to labeled roof")}</div>
          <h2>{str(b, "heading", "Seven taps, and the roof is measured.")}</h2>
          <p className="mkt-steps__p">
            {str(
              b,
              "body",
              "This is the real thing, frame by frame — pin, trace, drag the corners onto the actual roof, draw the ridges and hips, label each edge. Squares and linear footage update the whole way through.",
            )}
          </p>
          <div className="mkt-chips">
            {chips.map((c) => (
              <span className="mkt-chip" key={c}>
                {c}
              </span>
            ))}
          </div>
          <a
            href={str(cta, "href", "/cb/signup")}
            className="cb-btn cb-btn-lg cb-btn-primary"
            style={{ textDecoration: "none", whiteSpace: "nowrap" }}
          >
            <span className="cb-specular" />
            <span className="cb-btn-label">{str(cta, "label", "Measure your address on a call")}</span>
          </a>
        </div>

        <div className="mkt-bezel">
          <StepPlayer frames={frames} aspect="phone" />
        </div>
      </div>
    </section>
  );
}

const HERO_CSS = `
.mkt-hero{position:relative;overflow:hidden;background:#0f1216;color:#eef2f7;isolation:isolate}
.mkt-hero__grid{position:absolute;inset:0;pointer-events:none;
  background-image:linear-gradient(rgba(255,255,255,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.07) 1px,transparent 1px);
  background-size:46px 46px;
  -webkit-mask-image:radial-gradient(ellipse 90% 70% at 50% 32%, #000 40%, transparent 100%);
  mask-image:radial-gradient(ellipse 90% 70% at 50% 32%, #000 40%, transparent 100%);}
.mkt-hero__glow{position:absolute;top:-160px;right:-120px;width:720px;height:620px;pointer-events:none;
  background:radial-gradient(circle at 50% 50%, rgba(21,128,61,.34), transparent 68%);filter:blur(30px)}
.mkt-hero__inner{position:relative;z-index:2;max-width:1180px;margin:0 auto;padding:74px 18px 92px;
  display:grid;grid-template-columns:1.08fr .92fr;gap:32px;align-items:center}
.mkt-hero__logo{width:min(400px,86vw);height:auto;display:block;background:transparent;
  /* The MP4 has an opaque black matte baked in; screen-blending drops pure black
     against the dark hero so the mark floats over the grid. */
  mix-blend-mode:screen;isolation:auto;
  filter:drop-shadow(0 10px 30px rgba(21,128,61,.28))}
.mkt-eyebrow{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:11px;letter-spacing:.12em;
  text-transform:uppercase;color:rgba(238,242,247,.62);margin:22px 0 12px}
.mkt-h1{font-family:Archivo,system-ui,sans-serif;font-weight:800;font-size:clamp(2.15rem,4.4vw,3.5rem);
  line-height:1.06;letter-spacing:-.02em;margin:0}
.mkt-word{display:inline-block;overflow:hidden;vertical-align:bottom}
.mkt-word > span{display:inline-block;transform:translateY(105%);transition:transform .62s var(--cb-ease,cubic-bezier(.22,1,.36,1))}
.mkt-hero.is-in .mkt-word > span{transform:translateY(0)}
.mkt-accent{color:var(--cb-accent-bright,#22c55e);position:relative}
.mkt-accent::after{content:"";position:absolute;left:0;right:0;bottom:.04em;height:3px;border-radius:3px;
  background:linear-gradient(90deg,var(--cb-accent-bright,#22c55e),transparent)}
.mkt-sub{margin:20px 0 26px;max-width:62ch;font-size:16.5px;line-height:1.6;color:rgba(238,242,247,.74)}
@keyframes mktGlowPulse{0%,100%{box-shadow:0 0 0 0 rgba(21,128,61,.42),0 8px 22px rgba(0,0,0,.35)}
  50%{box-shadow:0 0 28px 6px rgba(21,128,61,.5),0 8px 22px rgba(0,0,0,.35)}}
.mkt-cta-primary{animation:mktGlowPulse 3.4s ease-in-out infinite}
.mkt-hero-stats{display:flex;gap:10px;max-width:430px;margin-top:30px}
.mkt-hero-stat{flex:1;border-radius:14px;padding:12px 12px 11px;background:rgba(255,255,255,.045);
  border:1px solid rgba(255,255,255,.10)}
.mkt-hero-stat b{display:block;font-family:'JetBrains Mono',ui-monospace,monospace;font-size:19px;font-weight:700;color:#eef2f7}
.mkt-hero-stat span{display:block;margin-top:4px;font-size:10px;letter-spacing:.10em;text-transform:uppercase;color:rgba(238,242,247,.55)}
.mkt-note{margin-top:18px;font-size:12.5px;color:rgba(238,242,247,.5)}
.mkt-fanwrap{position:relative;min-height:430px;perspective:1400px;display:flex;align-items:center;justify-content:center}
.mkt-fan{position:relative;transform-style:preserve-3d;width:100%;height:430px;display:flex;align-items:center;justify-content:center}
.mkt-fan-dot{position:absolute;width:360px;height:360px;border-radius:999px;transform:translateZ(-320px);
  background:radial-gradient(circle,rgba(21,128,61,.5),transparent 70%);filter:blur(46px)}
.mkt-phone{position:absolute;width:clamp(150px,17vw,204px);border-radius:26px;overflow:hidden;
  border:1px solid rgba(255,255,255,.14);box-shadow:0 40px 80px rgba(0,0,0,.6);background:#0f1216}
.mkt-phone img{display:block;width:100%;height:auto}
.mkt-phone--l{transform:translate3d(-94%,4%,-200px) rotateY(25deg) rotateZ(-5deg)}
.mkt-phone--c{transform:translate3d(0,-4%,40px) rotateY(-3deg);z-index:3}
.mkt-phone--r{transform:translate3d(94%,7%,-200px) rotateY(-25deg) rotateZ(5deg)}
@media (max-width:959px){
  .mkt-hero__inner{grid-template-columns:1fr;padding:44px 18px 64px}
  .mkt-fanwrap{min-height:330px}
  .mkt-fan{height:330px}
}
@media (prefers-reduced-motion:reduce){
  .mkt-cta-primary{animation:none}
  .mkt-word > span{transition:none;transform:none}
}
`;

const HEADLINE = [
  "Measure",
  "the",
  "roof",
  "before",
  "you",
  "knock",
  "on",
  "the",
  "door.",
];

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return reduced;
}

function CountUp({ to, duration = 2100 }: { to: number; duration?: number }) {
  const [v, setV] = useState(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced) {
      setV(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setV(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, duration, reduced]);
  return <>{v.toFixed(1)}</>;
}

function Hero({ content }: { content: SiteContent }) {
  const b = blockOf(content, "hero");
  const headlineText = str(b, "headline", HEADLINE.join(" "));
  const words = headlineText.split(/\s+/).filter(Boolean);
  const accentWord = str(b, "accent_word", "door.");
  const stats = arr<{ value: string; label: string }>(b, "stats", [
    { value: "90.4", label: "Squares" },
    { value: "10:12", label: "Pitch" },
    { value: "31", label: "Line items" },
  ]);
  const primary = obj(b, "primary_cta", { href: "/cb/signup", label: "Book a demo" });
  const secondary = obj(b, "secondary_cta", { href: "/#gallery", label: "See every screen" });
  const [inView, setInView] = useState(false);
  const reduced = useReducedMotion();
  const fanRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setInView(true), 60);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (reduced) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;
    const el = fanRef.current;
    if (!el) return;
    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;
    let raf = 0;
    const onMove = (e: MouseEvent) => {
      tx = (e.clientX / window.innerWidth) * 2 - 1;
      ty = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const loop = () => {
      cx += (tx - cx) * 0.07;
      cy += (ty - cy) * 0.07;
      el.style.transform = `rotateY(${cx * 7}deg) rotateX(${-cy * 5}deg)`;
      raf = requestAnimationFrame(loop);
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [reduced]);

  return (
    <section className={`mkt-hero ${inView ? "is-in" : ""}`}>
      <style dangerouslySetInnerHTML={{ __html: HERO_CSS }} />
      <div className="mkt-hero__grid" />
      <div className="mkt-hero__glow" />

      <div className="mkt-hero__inner">
        <div>
          {reduced ? (
            <img
              src="/marketing/logo/claimbuddy-logo.png"
              alt="Claim Buddy"
              className="mkt-hero__logo"
            />
          ) : (
            <video
              className="mkt-hero__logo"
              src={logoVideo.url}
              autoPlay
              muted
              loop
              playsInline
              poster="/marketing/logo/claimbuddy-logo.png"
              aria-label="Claim Buddy"
            />
          )}


          <div className="mkt-eyebrow">
            {str(b, "eyebrow", "Insurance restoration · roof, exterior & interior")}
          </div>

          <h1 className="mkt-h1">
            {words.map((w, i) => (
              <span key={`${w}-${i}`}>
                <span className="mkt-word">
                  <span
                    style={{ transitionDelay: `${i * 48}ms` }}
                    className={w === accentWord ? "mkt-accent" : undefined}
                  >
                    {w}
                  </span>
                </span>{" "}
              </span>
            ))}
          </h1>

          <p className="mkt-sub">
            {str(
              b,
              "sub",
              "Type an address and the roof traces itself. Then walk it — roof, all four exterior elevations, and the interior — and hand the homeowner a carrier-ready scope before you leave the driveway.",
            )}
          </p>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a
              href={str(primary, "href", "/cb/signup")}
              className="cb-btn cb-btn-lg cb-btn-primary mkt-cta-primary"
              style={{ textDecoration: "none", whiteSpace: "nowrap" }}
            >
              <span className="cb-specular" />
              <span className="cb-btn-label">{str(primary, "label", "Book a demo")}</span>
            </a>
            <a
              href={str(secondary, "href", "/#gallery")}
              className="cb-btn cb-btn-lg cb-btn-secondary"
              style={{ textDecoration: "none", whiteSpace: "nowrap" }}
            >
              <span className="cb-specular" />
              <span className="cb-btn-label">{str(secondary, "label", "See every screen")}</span>
            </a>
          </div>

          <div className="mkt-hero-stats">
            {stats.map((st) => {
              const numeric = /^\d+(\.\d+)?$/.test(String(st.value ?? ""));
              return (
                <div className="mkt-hero-stat" key={st.label}>
                  <b>
                    {numeric && String(st.value).includes(".") ? (
                      <CountUp to={Number(st.value)} />
                    ) : (
                      st.value
                    )}
                  </b>
                  <span>{st.label}</span>
                </div>
              );
            })}
          </div>

          <div className="mkt-note">
            {str(b, "note", "Runs in the phone browser at gcn.claims. No app store, no install.")}
          </div>
        </div>

        <div className="mkt-fanwrap">
          <div className="mkt-fan" ref={fanRef}>
            <div className="mkt-fan-dot" />
            <div className="mkt-phone mkt-phone--l">
              <img src="/marketing/screens/wideshots.jpg" alt="Exterior wide shots" loading="lazy" />
            </div>
            <div className="mkt-phone mkt-phone--c">
              <img src="/marketing/screens/m3_footprint.jpg" alt="Roof footprint measurement" />
            </div>
            <div className="mkt-phone mkt-phone--r">
              <img src="/marketing/screens/rb_cover.jpg" alt="Damage report cover" loading="lazy" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const NAV = [
  { label: "Home", href: "/" },
  { label: "The app", href: "/#app" },
  { label: "Gallery", href: "/#gallery" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Resources", href: "/#resources" },
  { label: "Blog", href: "/#blog" },
];

function CbButton({
  variant,
  href,
  children,
}: {
  variant: "primary" | "secondary";
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className={`cb-btn cb-btn-md cb-btn-${variant}`}
      style={{ whiteSpace: "nowrap", textDecoration: "none" }}
    >
      <span className="cb-specular" />
      <span className="cb-btn-label">{children}</span>
    </a>
  );
}

export default function Landing({ content = EMPTY_SITE_CONTENT }: { content?: SiteContent }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 959px)");
    const apply = () => {
      setCompact(mq.matches);
      if (!mq.matches) setMenuOpen(false);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setRevealed(true), 40);
    return () => window.clearTimeout(t);
  }, []);

  const headerH = scrolled ? 58 : 66;

  return (
    <div
      data-cb
      data-cb-theme="light"
      style={{
        minHeight: "100vh",
        background: "var(--cb-bg)",
        color: "var(--cb-text)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "color-mix(in srgb, var(--cb-bg) 82%, transparent)",
          backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)",
          borderBottom: scrolled ? "1px solid var(--cb-hairline)" : "1px solid transparent",
          transition: "height .2s var(--cb-ease), border-color .2s var(--cb-ease)",
        }}
      >
        <div
          style={{
            height: headerH,
            transition: "height .2s var(--cb-ease)",
            maxWidth: 1180,
            margin: "0 auto",
            padding: "0 18px",
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          {/* No brand lockup in the header — the nav's "Home" link covers "/". */}
          {!compact && (
            <nav
              style={{
                display: "flex",
                gap: 22,
                marginRight: "auto",
                alignItems: "center",
              }}
            >

                alignItems: "center",
              }}
            >
              {NAV.map((n) => (
                <a
                  key={n.label}
                  href={n.href}
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: "var(--cb-text-dim)",
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  {n.label}
                </a>
              ))}
            </nav>
          )}

          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexShrink: 0,
            }}
          >
            {compact && (
              <button
                type="button"
                aria-label={menuOpen ? "Close menu" : "Open menu"}
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
                className="cb-btn cb-btn-md cb-btn-secondary"
                style={{ width: 44, padding: 0 }}
              >
                <span className="cb-btn-label" style={{ fontSize: 16 }}>
                  {menuOpen ? "✕" : "☰"}
                </span>
              </button>
            )}
            <CbButton variant="secondary" href="/cb/login">
              Log in
            </CbButton>
            <CbButton variant="primary" href="/cb/signup">
              Book a demo
            </CbButton>
          </div>
        </div>

        {compact && menuOpen && (
          <div
            style={{
              borderTop: "1px solid var(--cb-hairline)",
              background: "var(--cb-surface)",
              padding: "10px 18px 16px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {NAV.map((n) => (
              <a
                key={n.label}
                href={n.href}
                onClick={() => setMenuOpen(false)}
                style={{
                  padding: "12px 2px",
                  fontSize: 15,
                  fontWeight: 600,
                  color: "var(--cb-text)",
                  textDecoration: "none",
                  borderBottom: "1px solid var(--cb-hairline)",
                }}
              >
                {n.label}
              </a>
            ))}
          </div>
        )}
      </header>

      <main style={{ flex: 1 }}>
        <Hero content={content} />
        <StepsSection content={content} />
        <HomeSections content={content} />
      </main>

      <footer
        className={`cb-reveal ${revealed ? "is-in" : ""}`}
        style={{
          borderTop: "1px solid var(--cb-hairline)",
          background: "var(--cb-surface-2)",
        }}
      >
        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            padding: "40px 18px 28px",
            display: "grid",
            gap: 28,
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          }}
        >
          <div>
            <div
              style={{
                background: "#0f1216",
                border: "1px solid #232a33",
                borderRadius: 14,
                padding: "12px 16px",
                display: "inline-block",
              }}
            >
              <img
                src="/marketing/logo/claimbuddy.png"
                alt="Claim Buddy"
                loading="lazy"
                width={210}
                height={70}
                style={{ width: 210, height: "auto", display: "block" }}
              />
            </div>
            <p style={{ marginTop: 14, fontSize: 14, color: "var(--cb-text-muted)", maxWidth: 280 }}>
              Walk the roof, document the damage, generate the report and close the job — all from
              your phone.
            </p>
          </div>

          <FooterCol
            title="Product"
            links={["The app", "Gallery", "Pricing", "Book a demo"]}
          />
          <FooterCol title="Company" links={["About", "Contact", "Careers", "Blog"]} />
          <FooterCol title="Legal" links={["Privacy", "Terms", "Security"]} />
        </div>

        <div
          style={{
            borderTop: "1px solid var(--cb-hairline)",
            padding: "16px 18px",
            textAlign: "center",
            fontSize: 13,
            color: "var(--cb-text-muted)",
          }}
        >
          © 2026 Global Contractor Network
        </div>
      </footer>
    </div>
  );
}

function FooterCol({ title, links }: { title: string; links: string[] }) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.10em",
          textTransform: "uppercase",
          color: "var(--cb-text-muted)",
        }}
      >
        {title}
      </div>
      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        {links.map((l) => (
          <a
            key={l}
            href="/"
            style={{ fontSize: 14, color: "var(--cb-text-dim)", textDecoration: "none" }}
          >
            {l}
          </a>
        ))}
      </div>
    </div>
  );
}
