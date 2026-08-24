import { useState } from "react";
import MarketingShell from "./MarketingShell";

const CSS = `
.dm-wrap{max-width:1200px;margin:0 auto;padding:44px 22px 76px}
.dm-2col{display:grid;grid-template-columns:1fr 1fr;gap:34px;align-items:start;margin-top:28px}
@media(max-width:960px){.dm-2col{grid-template-columns:1fr;gap:26px}}
.dm-card{border:1px solid var(--cb-hairline);border-radius:22px;background:var(--cb-surface);padding:26px;
  box-shadow:0 22px 54px rgba(9,12,16,.1)}
.dm-field{display:flex;flex-direction:column;gap:7px;margin-bottom:16px}
.dm-field label{font-size:13px;font-weight:700;letter-spacing:.01em;color:var(--cb-text-dim)}
.dm-field input,.dm-field select{height:52px;border-radius:14px;border:1px solid var(--cb-hairline);
  background:var(--cb-surface-2);color:var(--cb-text);font-size:16px;padding:0 14px;width:100%;
  transition:border-color .16s var(--cb-ease),box-shadow .16s var(--cb-ease);appearance:none}
.dm-field input:focus,.dm-field select:focus{outline:none;border-color:var(--cb-accent);
  box-shadow:0 0 0 4px rgba(21,128,61,.16)}
.dm-row{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:560px){.dm-row{grid-template-columns:1fr}}
.dm-note{font-size:12.5px;color:var(--cb-text-muted);margin-top:12px;line-height:1.5;text-align:center}
.dm-ok{text-align:center;padding:22px 6px 10px}
.dm-ok__i{width:66px;height:66px;border-radius:999px;background:var(--cb-accent);color:#fff;display:grid;
  place-items:center;font-size:30px;font-weight:900;margin:0 auto;box-shadow:0 16px 34px rgba(21,128,61,.35)}
.dm-steps{display:flex;flex-direction:column;gap:14px;margin-top:18px}
.dm-step{position:relative;border:1px solid var(--cb-hairline);border-radius:18px;background:var(--cb-surface);
  padding:18px 20px;box-shadow:0 12px 28px rgba(9,12,16,.07);display:flex;gap:14px}
.dm-step__n{flex:0 0 auto;width:30px;height:30px;border-radius:10px;background:var(--cb-accent);color:#fff;
  display:grid;place-items:center;font-family:var(--cb-mono,ui-monospace,monospace);font-size:13px;font-weight:800;
  box-shadow:0 8px 18px rgba(21,128,61,.28)}
.dm-step__when{font-family:var(--cb-mono,ui-monospace,monospace);font-size:11.5px;font-weight:800;
  letter-spacing:.09em;text-transform:uppercase;color:var(--cb-accent)}
.dm-step__ch{font-size:11.5px;color:var(--cb-text-muted);margin-left:8px;letter-spacing:.06em;text-transform:uppercase}
.dm-step__t{font-size:15.5px;font-weight:800;margin-top:5px;letter-spacing:-0.01em}
.dm-step__m{font-size:14px;color:var(--cb-text-dim);margin-top:7px;line-height:1.55;
  border-left:2px solid var(--cb-hairline);padding-left:12px}
`;

const SEQUENCE = [
  {
    when: "Immediately",
    ch: "Email",
    t: "Confirmation and calendar hold",
    m: "“You're booked. Here's the time, the link, and the address we'll measure live on the call — reply with a different one if you'd rather see a roof you're already working.”",
  },
  {
    when: "5 minutes later",
    ch: "Text",
    t: "The measurement of your address",
    m: "“Ran your address through Claim Buddy — 34.2 squares, 6:12 pitch, 148 ft of ridge. Full report attached. This took 51 seconds.”",
  },
  {
    when: "1 day before",
    ch: "Email",
    t: "What to have ready",
    m: "“Bring one live claim and one address you lost. We'll run both on the call, and you'll leave with the reports either way.”",
  },
  {
    when: "1 hour before",
    ch: "Text",
    t: "Reminder with the join link",
    m: "“We're on in an hour. Join link here. If you're on a roof, take it from your phone — half our demos are.”",
  },
  {
    when: "2 hours after",
    ch: "Email",
    t: "Recap and your trial",
    m: "“Here's the recording, the two reports we built, and your 14-day trial link. No card. Seats are already set up for your reps.”",
  },
  {
    when: "3 days after",
    ch: "Text + Email",
    t: "The check-in",
    m: "“How did the first inspections go? If anything felt slow, tell me which screen and we'll fix it or walk you through it — your call.”",
  },
];

const REPS = ["1–3", "4–10", "11–25", "26–50", "51+"];

export default function DemoPage() {
  const [sent, setSent] = useState(false);
  const [name, setName] = useState("");

  // No-op submit: intentionally not wired to email or any table yet.
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <MarketingShell>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <section className="dm-wrap">
        <h1 style={{ fontSize: "clamp(30px,5vw,46px)", letterSpacing: "-0.03em", margin: 0 }}>
          See it on your own roof.
        </h1>
        <p style={{ marginTop: 12, fontSize: 17, color: "var(--cb-text-dim)", maxWidth: 640, lineHeight: 1.55 }}>
          Give us an address you are working right now. We will measure it live on the call and you
          keep the report, whether you buy anything or not.
        </p>

        <div className="dm-2col">
          <div className="dm-card">
            {sent ? (
              <div className="dm-ok">
                <div className="dm-ok__i" aria-hidden>
                  ✓
                </div>
                <h2 style={{ fontSize: 24, letterSpacing: "-0.02em", margin: "18px 0 0" }}>
                  You're on the list{name ? `, ${name.split(" ")[0]}` : ""}.
                </h2>
                <p style={{ fontSize: 15.5, color: "var(--cb-text-dim)", marginTop: 10, lineHeight: 1.6 }}>
                  We'll reach out to lock in a time and run your address through a live measurement
                  before we even get on the call.
                </p>
                <button
                  type="button"
                  className="cb-btn cb-btn-md cb-btn-secondary"
                  style={{ marginTop: 20 }}
                  onClick={() => setSent(false)}
                >
                  <span className="cb-specular" />
                  <span className="cb-btn-label">Book another</span>
                </button>
              </div>
            ) : (
              <form onSubmit={onSubmit} noValidate>
                <h2 style={{ fontSize: 20, letterSpacing: "-0.02em", margin: "0 0 18px" }}>
                  Book your demo
                </h2>

                <div className="dm-row">
                  <div className="dm-field">
                    <label htmlFor="dm-name">Name</label>
                    <input
                      id="dm-name"
                      name="name"
                      autoComplete="name"
                      placeholder="Jordan Miles"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="dm-field">
                    <label htmlFor="dm-company">Company</label>
                    <input id="dm-company" name="company" autoComplete="organization" placeholder="Miles Exteriors" />
                  </div>
                </div>

                <div className="dm-field">
                  <label htmlFor="dm-email">Work email</label>
                  <input id="dm-email" name="email" type="email" autoComplete="email" placeholder="you@company.com" />
                </div>

                <div className="dm-row">
                  <div className="dm-field">
                    <label htmlFor="dm-mobile">Mobile</label>
                    <input id="dm-mobile" name="mobile" type="tel" autoComplete="tel" placeholder="(555) 123-4567" />
                  </div>
                  <div className="dm-field">
                    <label htmlFor="dm-reps">Number of field reps</label>
                    <select id="dm-reps" name="reps" defaultValue="1–3">
                      {REPS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="dm-field">
                  <label htmlFor="dm-address">Address to measure</label>
                  <input
                    id="dm-address"
                    name="address"
                    autoComplete="street-address"
                    placeholder="1420 Palm Bay Rd NE, Palm Bay, FL"
                  />
                </div>

                <button type="submit" className="cb-btn cb-btn-lg cb-btn-primary" style={{ width: "100%" }}>
                  <span className="cb-specular" />
                  <span className="cb-btn-label">Book my demo</span>
                </button>
                <div className="dm-note">
                  No card, no contract. We measure your address before the call either way.
                </div>
              </form>
            )}
          </div>

          <div>
            <h2 style={{ fontSize: "clamp(20px,2.6vw,26px)", letterSpacing: "-0.02em", margin: 0 }}>
              What happens after you hit the button
            </h2>
            <p style={{ marginTop: 8, fontSize: 15, color: "var(--cb-text-dim)", lineHeight: 1.55 }}>
              Six touches, all of them useful. No drip about “circling back.”
            </p>

            <div className="dm-steps">
              {SEQUENCE.map((s, i) => (
                <div key={s.when} className="dm-step">
                  <div className="dm-step__n">{i + 1}</div>
                  <div>
                    <div>
                      <span className="dm-step__when">{s.when}</span>
                      <span className="dm-step__ch">{s.ch}</span>
                    </div>
                    <div className="dm-step__t">{s.t}</div>
                    <div className="dm-step__m">{s.m}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
