import MarketingShell from "./MarketingShell";

const CSS = `
.pr-wrap{max-width:1200px;margin:0 auto;padding:44px 22px 76px}
.pr-plans{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:34px}
@media(max-width:960px){.pr-plans{grid-template-columns:1fr}}
.pr-card{position:relative;border:1px solid var(--cb-hairline);border-radius:20px;background:var(--cb-surface);
  padding:26px 22px 24px;box-shadow:0 16px 40px rgba(9,12,16,.08);display:flex;flex-direction:column}
.pr-card.is-hot{border-color:var(--cb-accent);box-shadow:0 0 0 1px var(--cb-accent),0 26px 60px rgba(21,128,61,.24)}
.pr-hot{position:absolute;top:-13px;left:22px;background:var(--cb-accent);color:#fff;font-size:11.5px;
  font-weight:800;letter-spacing:.08em;text-transform:uppercase;padding:6px 12px;border-radius:999px;
  box-shadow:0 8px 18px rgba(21,128,61,.3)}
.pr-name{font-size:17px;font-weight:800;letter-spacing:-0.01em}
.pr-blurb{font-size:13.5px;color:var(--cb-text-muted);margin-top:6px;line-height:1.5;min-height:38px}
.pr-price{display:flex;align-items:baseline;gap:6px;margin-top:16px}
.pr-amt{font-family:var(--cb-mono,ui-monospace,monospace);font-size:42px;font-weight:800;letter-spacing:-0.03em}
.pr-per{font-size:13px;color:var(--cb-text-muted)}
.pr-feats{list-style:none;margin:20px 0 24px;padding:0;display:flex;flex-direction:column;gap:11px}
.pr-feats li{display:flex;gap:10px;align-items:flex-start;font-size:14.5px;line-height:1.45}
.pr-tick{flex:0 0 auto;width:19px;height:19px;border-radius:7px;background:var(--cb-accent);color:#fff;
  display:grid;place-items:center;font-size:11px;font-weight:900;margin-top:1px;
  box-shadow:0 4px 10px rgba(21,128,61,.28)}
.pr-cta{margin-top:auto}
.pr-h2{font-size:clamp(22px,3vw,30px);letter-spacing:-0.02em;margin:56px 0 0}
.pr-tablewrap{margin-top:18px;border:1px solid var(--cb-hairline);border-radius:18px;overflow:hidden;
  background:var(--cb-surface)}
.pr-table{width:100%;border-collapse:collapse;font-size:14.5px}
.pr-table th,.pr-table td{padding:14px 18px;text-align:left;border-bottom:1px solid var(--cb-hairline)}
.pr-table tr:last-child td{border-bottom:0}
.pr-table th{font-size:11.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--cb-text-muted);
  background:var(--cb-surface-2)}
.pr-table td:last-child{font-family:var(--cb-mono,ui-monospace,monospace);font-weight:800;color:var(--cb-accent)}
.pr-trio{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:20px}
@media(max-width:860px){.pr-trio{grid-template-columns:1fr}}
.pr-mini{border:1px solid var(--cb-hairline);border-radius:18px;background:var(--cb-surface);padding:22px;
  box-shadow:0 14px 34px rgba(9,12,16,.07)}
.pr-mini h3{margin:0;font-size:16px;font-weight:800}
.pr-mini p{margin:8px 0 0;font-size:14px;line-height:1.55;color:var(--cb-text-dim)}
`;

const PLANS = [
  {
    name: "Claim Buddy Core",
    price: 99,
    hot: false,
    blurb: "Everything a rep needs to measure, document and get signed.",
    feats: [
      "Instant satellite roof measurement",
      "Roof takeoff with auto-filled quantities",
      "Exterior and interior photo inspection",
      "Damage report PDF",
      "Contract and e-signature",
      "Unlimited inspections",
    ],
  },
  {
    name: "Claim Buddy Pro",
    price: 149,
    hot: true,
    blurb: "Core, plus the estimating and canvassing a crew runs on.",
    feats: [
      "Everything in Core",
      "Carrier-style line item estimate",
      "Regional Xactimate-coded price book",
      "Door to door map mode with dispositions",
      "Storm intelligence — hail and wind history",
      "Homeowner presentation mode",
      "Owner and admin dashboards, filter by rep",
    ],
  },
  {
    name: "GCN Platform",
    price: 249,
    hot: false,
    blurb: "The full contractor back office wrapped around Claim Buddy.",
    feats: [
      "Everything in Pro",
      "Jobs, clients, invoices and production",
      "Supplementing and carrier correspondence",
      "Lead import and prospecting lists",
      "Company branding on every document",
      "Multi-company admin portal",
      "Priority support and onboarding",
    ],
  },
];

const BANDS = [
  ["1–3 seats", "Solo rep or a small crew", "0%"],
  ["4–10 seats", "A growing sales team", "15%"],
  ["11–50 seats", "Multi-crew contractor", "25%"],
  ["51+ seats", "Regional or multi-market", "25% + custom terms"],
];

const TRUST = [
  {
    t: "Cancel any time",
    p: "Month to month. No annual lock-in, no cancellation fee, no phone call to talk you out of it — turn seats off in your admin portal.",
  },
  {
    t: "Your data leaves with you",
    p: "Every inspection, photo, measurement and report exports on request. It is your file on your job — we just hold it.",
  },
  {
    t: "14 days free",
    p: "Run a full storm week on us. No card up front, and nothing bills until you have put real inspections through it.",
  },
];

export default function PricingPage() {
  return (
    <MarketingShell>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <section className="pr-wrap">
        <h1 style={{ fontSize: "clamp(30px,5vw,46px)", letterSpacing: "-0.03em", margin: 0 }}>
          Priced per seat, not per claim.
        </h1>
        <p style={{ marginTop: 12, fontSize: 17, color: "var(--cb-text-dim)", maxWidth: 640, lineHeight: 1.55 }}>
          One price per rep, per month. Unlimited inspections, unlimited measurements, unlimited
          reports — the harder your team works, the cheaper it gets.
        </p>

        <div className="pr-plans">
          {PLANS.map((pl) => (
            <div key={pl.name} className={`pr-card ${pl.hot ? "is-hot" : ""}`}>
              {pl.hot && <div className="pr-hot">Most chosen</div>}
              <div className="pr-name">{pl.name}</div>
              <div className="pr-blurb">{pl.blurb}</div>
              <div className="pr-price">
                <span className="pr-amt">${pl.price}</span>
                <span className="pr-per">per seat / month</span>
              </div>
              <ul className="pr-feats">
                {pl.feats.map((f) => (
                  <li key={f}>
                    <span className="pr-tick" aria-hidden>
                      ✓
                    </span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="pr-cta">
                <a
                  href="/demo"
                  className={`cb-btn cb-btn-lg ${pl.hot ? "cb-btn-primary" : "cb-btn-secondary"}`}
                  style={{ width: "100%", textDecoration: "none" }}
                >
                  <span className="cb-specular" />
                  <span className="cb-btn-label">Start 14 days free</span>
                </a>
              </div>
            </div>
          ))}
        </div>

        <h2 className="pr-h2">Seat bands</h2>
        <p style={{ marginTop: 8, fontSize: 15, color: "var(--cb-text-dim)" }}>
          The discount applies automatically to every seat once you cross the band.
        </p>
        <div className="pr-tablewrap">
          <table className="pr-table">
            <thead>
              <tr>
                <th>Seats</th>
                <th>Who it fits</th>
                <th>Discount</th>
              </tr>
            </thead>
            <tbody>
              {BANDS.map(([a, b, c]) => (
                <tr key={a}>
                  <td style={{ fontWeight: 700 }}>{a}</td>
                  <td style={{ color: "var(--cb-text-dim)" }}>{b}</td>
                  <td>{c}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="pr-trio">
          {TRUST.map((x) => (
            <div key={x.t} className="pr-mini">
              <h3>{x.t}</h3>
              <p>{x.p}</p>
            </div>
          ))}
        </div>
      </section>
    </MarketingShell>
  );
}
