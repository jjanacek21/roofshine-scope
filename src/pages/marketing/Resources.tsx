import MarketingShell from "./MarketingShell";
import VideoCard, { type VideoItem } from "@/components/marketing/VideoCard";

const CSS = `
.rs-wrap{max-width:1200px;margin:0 auto;padding:44px 22px 76px}
.rs-2col{display:grid;grid-template-columns:1.02fr 0.98fr;gap:36px;align-items:center;margin-top:28px}
@media(max-width:960px){.rs-2col{grid-template-columns:1fr;gap:26px}}
.rs-sections{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:24px}
@media(max-width:560px){.rs-sections{grid-template-columns:1fr}}
.rs-sec{display:block;text-decoration:none;border:1px solid var(--cb-hairline);border-radius:16px;
  background:var(--cb-surface);padding:16px 16px 17px;box-shadow:0 12px 28px rgba(9,12,16,.07);
  transition:transform .2s var(--cb-ease),box-shadow .2s var(--cb-ease),border-color .2s var(--cb-ease)}
.rs-sec:hover{transform:translateY(-3px);border-color:var(--cb-accent);box-shadow:0 20px 40px rgba(21,128,61,.16)}
.rs-sec__n{font-family:var(--cb-mono,ui-monospace,monospace);font-size:12px;font-weight:800;color:var(--cb-accent)}
.rs-sec__t{font-size:15.5px;font-weight:800;margin-top:6px;color:var(--cb-text)}
.rs-sec__c{font-size:13px;color:var(--cb-text-muted);margin-top:5px;line-height:1.5}
.rs-bezel{border-radius:34px;padding:12px;background:linear-gradient(160deg,#20262e,#0d1014);
  box-shadow:0 34px 70px rgba(9,12,16,.34),inset 0 1px 0 rgba(255,255,255,.12)}
.rs-bezel > div{border-radius:24px;overflow:hidden;background:#0f1216;aspect-ratio:9/16;max-height:620px}
.rs-bezel img{width:100%;height:100%;object-fit:cover;display:block}
.rs-h2{font-size:clamp(22px,3vw,30px);letter-spacing:-0.02em;margin:58px 0 0}
.rs-sub{margin-top:8px;font-size:15px;color:var(--cb-text-dim);max-width:640px;line-height:1.55}
.rs-days{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:22px}
@media(max-width:1000px){.rs-days{grid-template-columns:repeat(2,1fr)}}
@media(max-width:560px){.rs-days{grid-template-columns:1fr}}
.rs-day{border:1px solid var(--cb-hairline);border-radius:18px;background:var(--cb-surface);padding:20px;
  box-shadow:0 14px 32px rgba(9,12,16,.07);position:relative;overflow:hidden}
.rs-day::after{content:"";position:absolute;right:-40px;top:-40px;width:120px;height:120px;border-radius:999px;
  background:radial-gradient(circle,rgba(21,128,61,.16),transparent 70%)}
.rs-day__d{font-family:var(--cb-mono,ui-monospace,monospace);font-size:11.5px;font-weight:800;
  letter-spacing:.1em;text-transform:uppercase;color:var(--cb-accent)}
.rs-day__t{font-size:16px;font-weight:800;margin-top:8px;letter-spacing:-0.01em}
.rs-day__c{font-size:13.5px;color:var(--cb-text-dim);margin-top:7px;line-height:1.55}
.rs-vids{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:22px}
@media(max-width:1000px){.rs-vids{grid-template-columns:repeat(2,1fr)}}
@media(max-width:640px){.rs-vids{grid-template-columns:1fr}}
`;

const SECTIONS = [
  {
    n: "01",
    t: "The Philosophy",
    c: "Why the homeowner says no, and the mindset that turns a door into a roof.",
  },
  {
    n: "02",
    t: "Trainer Cheat Sheets",
    c: "One page per objection. Print it, put it on the dash, run it word for word.",
  },
  {
    n: "03",
    t: "New Rep 7-Day Ramp",
    c: "A day-by-day plan that gets a brand new rep to their first signed contract.",
  },
  {
    n: "04",
    t: "Field Notes",
    c: "Short reads from the door — storm weeks, adjuster meetings, hard neighborhoods.",
  },
];

const DAYS = [
  ["Day 1", "Learn the product", "Roof anatomy, damage types and what a carrier actually pays for. Walk one roof with a trainer."],
  ["Day 2", "Learn the app", "Measure three houses from the truck. Run a full inspection on your own home."],
  ["Day 3", "Learn the pitch", "The door approach, the 30-second frame and the inspection ask, out loud, fifty times."],
  ["Day 4", "First 50 doors", "Trainer knocks 25, you knock 25. One goal: book two inspections."],
  ["Day 5", "Run your own inspection", "Full roof, exterior, interior. Trainer stands back and takes notes only."],
  ["Day 6", "Present and close", "Show the damage report and the estimate at the table. Ask for the signature."],
  ["Day 7", "Review and reset", "Watch your own numbers, fix the one leak in your funnel, set next week's door count."],
];

const VIDEOS: VideoItem[] = [
  {
    thumbnail: "/marketing/screens/m1_pin.jpg",
    title: "Measure a roof in 60 seconds",
    duration: "1:04",
    caption: "Pin drop to labeled measurement without leaving the truck.",
  },
  {
    thumbnail: "/marketing/screens/m6_label.jpg",
    title: "Labeling edges the fast way",
    duration: "2:11",
    caption: "Sticky labeling — pick the type once, tap every edge that matches.",
  },
  {
    thumbnail: "/marketing/screens/tk_1.jpg",
    title: "Roof takeoff walkthrough",
    duration: "3:26",
    caption: "What auto-fills, what you adjust, and why the numbers tie out.",
  },
  {
    thumbnail: "/marketing/screens/ex_1.jpg",
    title: "The four-elevation exterior",
    duration: "2:48",
    caption: "Wide shots in order so nothing gets missed on the walk-around.",
  },
  {
    thumbnail: "/marketing/screens/cr_4.jpg",
    title: "Building a carrier estimate",
    duration: "4:52",
    caption: "Pricing modes, the price book, and making your edits stick.",
  },
  {
    thumbnail: "/marketing/screens/pr_1.jpg",
    title: "Closing at the kitchen table",
    duration: "5:37",
    caption: "Presentation mode, the damage report, and asking for the signature.",
  },
];

export default function ResourcesPage() {
  return (
    <MarketingShell>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <section className="rs-wrap">
        <div className="rs-2col">
          <div>
            <div
              style={{
                display: "inline-block",
                fontSize: 11.5,
                fontWeight: 800,
                letterSpacing: ".1em",
                textTransform: "uppercase",
                color: "var(--cb-accent)",
                border: "1px solid var(--cb-accent)",
                borderRadius: 999,
                padding: "6px 12px",
              }}
            >
              Free with every seat
            </div>
            <h1 style={{ fontSize: "clamp(30px,5vw,46px)", letterSpacing: "-0.03em", margin: "14px 0 0" }}>
              The Blue Collar Sales Survival Guide.
            </h1>
            <p style={{ marginTop: 12, fontSize: 17, color: "var(--cb-text-dim)", maxWidth: 560, lineHeight: 1.6 }}>
              Everything we wish somebody had handed us on day one — written for reps who work in
              boots, read on a phone, and need an answer between doors. It lives inside the app, so
              it is in your pocket on the porch, not in a binder in the office.
            </p>

            <div className="rs-sections">
              {SECTIONS.map((s) => (
                <a key={s.t} className="rs-sec" href="/cb/survival-guide">
                  <div className="rs-sec__n">{s.n}</div>
                  <div className="rs-sec__t">{s.t}</div>
                  <div className="rs-sec__c">{s.c}</div>
                </a>
              ))}
            </div>

            <div style={{ marginTop: 22, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a href="/cb/survival-guide" className="cb-btn cb-btn-lg cb-btn-primary" style={{ textDecoration: "none" }}>
                <span className="cb-specular" />
                <span className="cb-btn-label">Open the guide</span>
              </a>
              <a href="/demo" className="cb-btn cb-btn-lg cb-btn-secondary" style={{ textDecoration: "none" }}>
                <span className="cb-specular" />
                <span className="cb-btn-label">Book a demo</span>
              </a>
            </div>
          </div>

          <div className="rs-bezel">
            <div>
              <img src="/marketing/screens/progress.jpg" alt="The survival guide open on a phone" />
            </div>
          </div>
        </div>

        <h2 className="rs-h2">The New Rep 7-Day Ramp</h2>
        <p className="rs-sub">
          Seven days from hired to their first signed contract. One focus per day — no theory days,
          no shadowing for a week.
        </p>
        <div className="rs-days">
          {DAYS.map(([d, t, c]) => (
            <div key={d} className="rs-day">
              <div className="rs-day__d">{d}</div>
              <div className="rs-day__t">{t}</div>
              <div className="rs-day__c">{c}</div>
            </div>
          ))}
        </div>

        <h2 className="rs-h2">Watch it done</h2>
        <p className="rs-sub">
          Short clips from real jobs. Nothing staged, nothing sped up.
        </p>
        <div className="rs-vids">
          {VIDEOS.map((v) => (
            <VideoCard key={v.title} {...v} />
          ))}
        </div>
      </section>
    </MarketingShell>
  );
}
