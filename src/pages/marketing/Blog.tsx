import MarketingShell from "./MarketingShell";

const CSS = `
.bl-wrap{max-width:1200px;margin:0 auto;padding:44px 22px 76px}
.bl-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:30px}
@media(max-width:1000px){.bl-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:640px){.bl-grid{grid-template-columns:1fr}}
.bl-card{display:flex;flex-direction:column;text-decoration:none;color:inherit;
  border:1px solid var(--cb-hairline);border-radius:18px;background:var(--cb-surface);padding:22px;
  box-shadow:0 14px 32px rgba(9,12,16,.07);
  transition:transform .2s var(--cb-ease),box-shadow .2s var(--cb-ease),border-color .2s var(--cb-ease)}
.bl-card:hover{transform:translateY(-3px);border-color:var(--cb-accent);box-shadow:0 22px 46px rgba(21,128,61,.16)}
.bl-meta{display:flex;align-items:center;gap:10px;font-family:var(--cb-mono,ui-monospace,monospace);
  font-size:12px;color:var(--cb-text-muted)}
.bl-dot{width:4px;height:4px;border-radius:999px;background:var(--cb-accent)}
.bl-t{font-size:18px;font-weight:800;letter-spacing:-0.02em;margin-top:12px;line-height:1.3}
.bl-s{font-size:14px;color:var(--cb-text-dim);margin-top:9px;line-height:1.55}
.bl-more{margin-top:16px;font-size:13.5px;font-weight:700;color:var(--cb-accent)}
`;

const POSTS = [
  {
    date: "2026-08-11",
    read: "6 min read",
    title: "What a desk adjuster is actually looking for in your photos",
    summary:
      "Six photos get a claim approved. The other sixty are noise — here is the set that does the work.",
  },
  {
    date: "2026-07-29",
    read: "4 min read",
    title: "Stop measuring roofs with a wheel and a ladder",
    summary:
      "Satellite measurement is inside a half percent on a normal cut-up hip. We ran 40 roofs both ways.",
  },
  {
    date: "2026-07-14",
    read: "8 min read",
    title: "The supplement that pays for your whole month",
    summary:
      "Drip edge, ice and water, ridge vent and steep charge — the four lines carriers leave off by default.",
  },
  {
    date: "2026-06-30",
    read: "5 min read",
    title: "Canvassing a storm the day the swath drops",
    summary:
      "How to read a hail polygon, pick the streets worth knocking, and route a crew before the competition wakes up.",
  },
  {
    date: "2026-06-17",
    read: "7 min read",
    title: "Why your new reps quit in week two",
    summary:
      "It is almost never the doors. It is the seven days before them — and what nobody taught them to say.",
  },
  {
    date: "2026-06-02",
    read: "5 min read",
    title: "Signing at the table instead of 'let me think about it'",
    summary:
      "Present the damage, present the money, present the paper. In that order, on one device, before you stand up.",
  },
];

export default function BlogPage() {
  return (
    <MarketingShell>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <section className="bl-wrap">
        <h1 style={{ fontSize: "clamp(30px,5vw,46px)", letterSpacing: "-0.03em", margin: 0 }}>
          Notes from the field.
        </h1>
        <p style={{ marginTop: 12, fontSize: 17, color: "var(--cb-text-dim)", maxWidth: 640, lineHeight: 1.55 }}>
          Written by people who still knock doors and still climb roofs. Short, specific, and useful
          before your next appointment.
        </p>

        <div className="bl-grid">
          {POSTS.map((p) => (
            <a key={p.title} className="bl-card" href="/resources">
              <div className="bl-meta">
                <span>{p.date}</span>
                <span className="bl-dot" aria-hidden />
                <span>{p.read}</span>
              </div>
              <div className="bl-t">{p.title}</div>
              <div className="bl-s">{p.summary}</div>
              <div className="bl-more">Read →</div>
            </a>
          ))}
        </div>
      </section>
    </MarketingShell>
  );
}
