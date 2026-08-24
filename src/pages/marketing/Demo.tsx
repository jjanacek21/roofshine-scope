import { useState } from "react";
import MarketingShell from "./MarketingShell";
import { useServerFn } from "@tanstack/react-start";
import { cbSubmitDemoRequest } from "@/lib/cb-team.functions";

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
.dm-field textarea{min-height:110px;border-radius:14px;border:1px solid var(--cb-hairline);
  background:var(--cb-surface-2);color:var(--cb-text);font-size:16px;padding:12px 14px;width:100%;
  font-family:inherit;line-height:1.5;resize:vertical}
.dm-field textarea:focus{outline:none;border-color:var(--cb-accent);box-shadow:0 0 0 4px rgba(21,128,61,.16)}
.dm-group{border:1px solid var(--cb-hairline);border-radius:18px;background:var(--cb-surface-2);
  padding:18px 16px 4px;margin-bottom:18px}
.dm-group__t{font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;
  color:var(--cb-accent);margin:0 0 14px}
.dm-chips{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px}
.dm-chip{border:1px solid var(--cb-hairline);background:var(--cb-surface);color:var(--cb-text-dim);
  border-radius:999px;padding:9px 14px;font-size:13.5px;font-weight:600;cursor:pointer;
  transition:all .14s var(--cb-ease)}
.dm-chip[aria-pressed="true"]{background:var(--cb-accent);border-color:var(--cb-accent);color:#fff;
  box-shadow:0 8px 18px rgba(21,128,61,.26)}
.dm-ask{border:1px solid var(--cb-accent);border-radius:18px;padding:18px 16px 6px;margin-bottom:18px;
  background:rgba(21,128,61,.05)}
.dm-err{font-size:12.5px;color:#b91c1c;font-weight:600}
.dm-hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none}
.dm-sum{text-align:left;border:1px solid var(--cb-hairline);border-radius:16px;background:var(--cb-surface-2);
  padding:16px;margin-top:18px;font-size:14px;line-height:1.6;color:var(--cb-text-dim)}
.dm-sum b{color:var(--cb-text)}
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

const TEAM_SIZES = ["1-3", "4-10", "11-25", "26-50", "51+"];
const INDUSTRIES = [
  "Roofing",
  "Roofing + exterior",
  "General restoration",
  "Storm/insurance restoration",
  "Solar",
  "Public adjusting",
  "Other",
];
const FEATURES = [
  "Instant measurement",
  "Roof takeoff",
  "Exterior takeoff",
  "Interior takeoff",
  "Photo documentation",
  "Damage report",
  "Line-item estimating",
  "Supplements",
  "Contracts & e-sign",
  "Canvassing",
  "Storm maps",
  "Team management",
];

type Errors = Partial<Record<"name" | "email" | "industry" | "team_size" | "primary_goal" | "form", string>>;

export default function DemoPage() {
  const submit = useServerFn(cbSubmitDemoRequest);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [industry, setIndustry] = useState("");
  const [teamSize, setTeamSize] = useState("");
  const [tools, setTools] = useState("");
  const [goal, setGoal] = useState("");
  const [features, setFeatures] = useState<string[]>([]);
  const [questions, setQuestions] = useState("");
  const [address, setAddress] = useState("");
  const [website, setWebsite] = useState(""); // honeypot

  function toggleFeature(f: string) {
    setFeatures((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f].slice(0, 12)));
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Errors = {};
    if (!name.trim()) next.name = "Tell us your name.";
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = "Enter a valid work email.";
    if (!industry) next.industry = "Pick the closest fit.";
    if (!teamSize) next.team_size = "Pick a team size.";
    if (!goal.trim()) next.primary_goal = "One line is enough — what are you trying to fix?";
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      await submit({
        data: {
          name: name.trim(),
          email: email.trim(),
          company: company.trim() || undefined,
          phone: phone.trim() || undefined,
          kind: "demo" as const,
          industry,
          team_size: teamSize,
          current_tools: tools.trim() || undefined,
          primary_goal: goal.trim(),
          features_wanted: features,
          questions: questions.trim() || undefined,
          message: address.trim() ? `Address to measure: ${address.trim()}` : undefined,
          website: website || undefined,
        },
      });
      setSent(true);
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "Something went wrong. Try again." });
    } finally {
      setBusy(false);
    }
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
                  We'll call within one business day to lock in a time, and we'll have your address
                  measured before we get on the call.
                </p>
                <div className="dm-sum">
                  <div><b>Name</b> — {name}{company ? ` · ${company}` : ""}</div>
                  <div><b>Email</b> — {email}{phone ? ` · ${phone}` : ""}</div>
                  <div><b>Industry</b> — {industry} · <b>Team</b> {teamSize}</div>
                  {tools ? <div><b>Today they use</b> — {tools}</div> : null}
                  <div><b>Goal</b> — {goal}</div>
                  {features.length ? <div><b>Features</b> — {features.join(", ")}</div> : null}
                  {questions ? <div><b>Your questions</b> — {questions}</div> : null}
                </div>
                <p style={{ fontSize: 13.5, color: "var(--cb-text-muted)", marginTop: 14, lineHeight: 1.55 }}>
                  Need a different time? Reply to the confirmation email and we'll move it.
                </p>
                <button
                  type="button"
                  className="cb-btn cb-btn-md cb-btn-secondary"
                  style={{ marginTop: 18 }}
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

                <div className="dm-group">
                  <p className="dm-group__t">About you</p>
                  <div className="dm-row">
                    <div className="dm-field">
                      <label htmlFor="dm-name">Name</label>
                      <input
                        id="dm-name"
                        autoComplete="name"
                        placeholder="Jordan Miles"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                      {errors.name ? <span className="dm-err">{errors.name}</span> : null}
                    </div>
                    <div className="dm-field">
                      <label htmlFor="dm-company">Company</label>
                      <input
                        id="dm-company"
                        autoComplete="organization"
                        placeholder="Miles Exteriors"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="dm-row">
                    <div className="dm-field">
                      <label htmlFor="dm-email">Work email</label>
                      <input
                        id="dm-email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                      {errors.email ? <span className="dm-err">{errors.email}</span> : null}
                    </div>
                    <div className="dm-field">
                      <label htmlFor="dm-mobile">Mobile</label>
                      <input
                        id="dm-mobile"
                        type="tel"
                        autoComplete="tel"
                        placeholder="(555) 123-4567"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="dm-group">
                  <p className="dm-group__t">About your business</p>
                  <div className="dm-row">
                    <div className="dm-field">
                      <label htmlFor="dm-industry">Industry</label>
                      <select id="dm-industry" value={industry} onChange={(e) => setIndustry(e.target.value)}>
                        <option value="">Choose one…</option>
                        {INDUSTRIES.map((i) => (
                          <option key={i} value={i}>{i}</option>
                        ))}
                      </select>
                      {errors.industry ? <span className="dm-err">{errors.industry}</span> : null}
                    </div>
                    <div className="dm-field">
                      <label htmlFor="dm-team">Team size</label>
                      <select id="dm-team" value={teamSize} onChange={(e) => setTeamSize(e.target.value)}>
                        <option value="">Choose one…</option>
                        {TEAM_SIZES.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                      {errors.team_size ? <span className="dm-err">{errors.team_size}</span> : null}
                    </div>
                  </div>
                  <div className="dm-field">
                    <label htmlFor="dm-tools">Current tools</label>
                    <input
                      id="dm-tools"
                      placeholder="AccuLynx, Xactimate, spreadsheets…"
                      value={tools}
                      onChange={(e) => setTools(e.target.value)}
                    />
                  </div>
                </div>

                <div className="dm-group">
                  <p className="dm-group__t">What you're trying to fix</p>
                  <div className="dm-field">
                    <label htmlFor="dm-goal">What do you want to run your business on this for?</label>
                    <textarea
                      id="dm-goal"
                      placeholder="Measurements take too long, my reps write scopes three different ways, supplements die in email…"
                      value={goal}
                      onChange={(e) => setGoal(e.target.value)}
                    />
                    {errors.primary_goal ? <span className="dm-err">{errors.primary_goal}</span> : null}
                  </div>
                  <div className="dm-field">
                    <label>What do you want it to do? (pick any)</label>
                    <div className="dm-chips">
                      {FEATURES.map((f) => (
                        <button
                          key={f}
                          type="button"
                          className="dm-chip"
                          aria-pressed={features.includes(f)}
                          onClick={() => toggleFeature(f)}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="dm-field">
                    <label htmlFor="dm-address">Address to measure (optional)</label>
                    <input
                      id="dm-address"
                      autoComplete="street-address"
                      placeholder="1420 Palm Bay Rd NE, Palm Bay, FL"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  </div>
                </div>

                <div className="dm-ask">
                  <div className="dm-field">
                    <label htmlFor="dm-questions" style={{ fontSize: 15, color: "var(--cb-text)" }}>
                      Anything you want to ask, or ask us to build?
                    </label>
                    <textarea
                      id="dm-questions"
                      placeholder="Tell us what's missing from the software you use today. This is the field we read first."
                      value={questions}
                      onChange={(e) => setQuestions(e.target.value)}
                    />
                  </div>
                </div>

                <input
                  className="dm-hp"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  placeholder="Website"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />

                {errors.form ? <p className="dm-err" style={{ marginBottom: 10 }}>{errors.form}</p> : null}

                <button
                  type="submit"
                  className="cb-btn cb-btn-lg cb-btn-primary"
                  style={{ width: "100%" }}
                  disabled={busy}
                >
                  <span className="cb-specular" />
                  <span className="cb-btn-label">{busy ? "Sending…" : "Book my demo"}</span>
                </button>
                <div className="dm-note">
                  No card, no contract. We measure your address before the call either way.
                </div>
              </form>
            )}
          </div>

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
