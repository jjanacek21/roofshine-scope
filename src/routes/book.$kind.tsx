import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { submitBooking, type BookingKind } from "@/lib/booking.functions";

export const Route = createFileRoute("/book/$kind")({
  component: BookingPage,
});

/**
 * Public booking page — /book/demo and /book/seat.
 *
 * Deliberately not built out of the app's UI kit. The app shell is light and
 * this page is the next thing a visitor sees after the dark marketing site, so
 * it carries its own scoped palette. Everything is namespaced under `.gcn-book`
 * so none of it can leak into the signed-in product.
 */

const TRADES = [
  "Commercial roofing / coatings",
  "Residential roofing",
  "Insurance restoration",
  "Exteriors (siding, gutters, windows)",
  "General contracting",
  "Other",
];

const TEAM_SIZES = ["Just me", "2–5", "6–15", "16–40", "40+"];

const TIMES = [
  "7:00 AM",
  "8:00 AM",
  "9:00 AM",
  "10:00 AM",
  "11:00 AM",
  "12:00 PM",
  "1:00 PM",
  "2:00 PM",
  "3:00 PM",
  "4:00 PM",
  "5:00 PM",
  "6:00 PM",
];

const ZONES = ["ET", "CT", "MT", "PT", "AKT", "HT"];

const WANTS = [
  "Commercial estimating",
  "Roof measurements",
  "Prospecting & territory",
  "Lead & report tracking",
  "Work orders & production",
  "Price books & suppliers",
  "Contracts & e-sign",
  "Storm intelligence",
  "AI receptionist",
  "Team management",
];

const DEMO_STEPS: [string, string, string][] = [
  [
    "Immediately",
    "Confirmation and calendar hold",
    "The time, the join link, and the address we'll price live on the call. Reply with a different one any time.",
  ],
  [
    "Before the call",
    "We build your number first",
    "We run your address through the estimator ahead of time, so the call starts at the result instead of a blank form.",
  ],
  [
    "On the call",
    "Your job, not our sample data",
    "Bring one job you're quoting and one you lost. We run both, and you keep the reports either way.",
  ],
  [
    "After",
    "Recap and a working account",
    "The reports we built, plus a trial account with your own price book already loaded.",
  ],
];

const SEAT_STEPS: [string, string, string][] = [
  [
    "Immediately",
    "Your seat is held",
    "Your founding rate is locked from today and it never goes up while you stay — every module on the roadmap lands in your account as it ships.",
  ],
  [
    "Right away",
    "Onboarding call confirmed",
    "You get the date and time back in writing, along with the list of what to have ready.",
  ],
  [
    "On the call",
    "We build your account together",
    "Your price book, your documents, your templates, your reps. We set up a live job with you rather than handing you an empty screen.",
  ],
  [
    "After",
    "You're running on it",
    "You leave the call with a working account, not a login and a help centre.",
  ],
];

const BRING = [
  "Business and trade licences",
  "General liability and workers' comp COIs",
  "Your contract, contingency and change order",
  "A current price book or recent estimates",
  "Supplier price sheets",
  "Logo, letterhead and warranty language",
  "Your reps and the emails they'll log in with",
  "One job you're working right now",
];

function BookingPage() {
  const { kind: rawKind } = Route.useParams();
  const kind: BookingKind = rawKind === "seat" ? "seat" : "demo";
  const isSeat = kind === "seat";

  const [form, setForm] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    industry: "",
    teamSize: "",
    currentTools: "",
    goals: "",
    address: "",
    question: "",
    preferredDate: "",
    preferredTime: "",
    timezone: "CT",
  });
  const [wants, setWants] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ when: string; confirmationSent: boolean } | null>(null);

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const toggle = (w: string) =>
    setWants((ws) => (ws.includes(w) ? ws.filter((x) => x !== w) : [...ws, w]));

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await submitBooking({
        data: { kind, product: "gcn", ...form, wants },
      });
      setDone({ when: res.when, confirmationSent: res.confirmationSent });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send that. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const steps = isSeat ? SEAT_STEPS : DEMO_STEPS;

  return (
    <div className="gcn-book">
      <style>{CSS}</style>
      <div className="bk-scene" aria-hidden="true">
        <span className="bk-a" />
        <span className="bk-b" />
        <span className="bk-vig" />
      </div>

      <header className="bk-nav">
        <a className="bk-brand" href="/">
          <span className="bk-mark">G</span>
          <span>
            <b>GCN App</b>
            <em>Estimating OS for contractors</em>
          </span>
        </a>
        <Link to="/login" className="bk-signin">
          Sign in
        </Link>
      </header>

      <main className="bk-wrap">
        {done ? (
          <div className="bk-done">
            <span className="bk-eyebrow">{isSeat ? "Seat reserved" : "Demo booked"}</span>
            <h1>{isSeat ? "Your founding seat is held." : "You're on the calendar."}</h1>
            <p className="bk-when">{done.when}</p>
            <p className="bk-lede">
              {done.confirmationSent
                ? `A confirmation just went to ${form.email}. `
                : `We've got your request. `}
              {isSeat
                ? "It lists everything worth having in front of you for the call — licences, COIs, your contract, a price book, and one live job."
                : "Bring one job you're quoting and one you lost, and we'll run both live."}
            </p>
            {isSeat && (
              <ul className="bk-bring">
                {BRING.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}
            <a className="bk-btn" href="/">
              Back to the site
            </a>
          </div>
        ) : (
          <>
            <div className="bk-head">
              <span className="bk-eyebrow">
                {isSeat ? "Founding seats · 18 left" : "45 minutes, on your own jobs"}
              </span>
              <h1>{isSeat ? "Claim your founding seat." : "See it on your own roof."}</h1>
              <p className="bk-lede">
                {isSeat
                  ? "Pick a time for your onboarding call. That's the call where we build your account with you — price book, documents, templates, reps, and a live job — instead of handing you an empty screen."
                  : "Give us an address you're working right now. We'll price it live on the call and you keep the report, whether you buy anything or not."}
              </p>
            </div>

            <div className="bk-grid">
              <form className="bk-card" onSubmit={submit}>
                <h2>{isSeat ? "Reserve your seat" : "Book your demo"}</h2>

                <fieldset>
                  <legend>About you</legend>
                  <div className="bk-row">
                    <Field
                      label="Name"
                      required
                      value={form.name}
                      onChange={set("name")}
                      placeholder="Jordan Miles"
                    />
                    <Field
                      label="Company"
                      value={form.company}
                      onChange={set("company")}
                      placeholder="Miles Exteriors"
                    />
                  </div>
                  <div className="bk-row">
                    <Field
                      label="Work email"
                      required
                      type="email"
                      value={form.email}
                      onChange={set("email")}
                      placeholder="you@company.com"
                    />
                    <Field
                      label="Mobile"
                      value={form.phone}
                      onChange={set("phone")}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </fieldset>

                <fieldset>
                  <legend>Your call</legend>
                  <div className="bk-row bk-row-3">
                    <label className="bk-f">
                      <span>Preferred date</span>
                      <input
                        type="date"
                        min={today}
                        value={form.preferredDate}
                        onChange={(e) => set("preferredDate")(e.target.value)}
                      />
                    </label>
                    <label className="bk-f">
                      <span>Time</span>
                      <select
                        value={form.preferredTime}
                        onChange={(e) => set("preferredTime")(e.target.value)}
                      >
                        <option value="">Any time</option>
                        {TIMES.map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </label>
                    <label className="bk-f">
                      <span>Zone</span>
                      <select
                        value={form.timezone}
                        onChange={(e) => set("timezone")(e.target.value)}
                      >
                        {ZONES.map((z) => (
                          <option key={z}>{z}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </fieldset>

                <fieldset>
                  <legend>About your business</legend>
                  <div className="bk-row">
                    <label className="bk-f">
                      <span>Trade</span>
                      <select
                        value={form.industry}
                        onChange={(e) => set("industry")(e.target.value)}
                      >
                        <option value="">Choose one…</option>
                        {TRADES.map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </label>
                    <label className="bk-f">
                      <span>Team size</span>
                      <select
                        value={form.teamSize}
                        onChange={(e) => set("teamSize")(e.target.value)}
                      >
                        <option value="">Choose one…</option>
                        {TEAM_SIZES.map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <Field
                    label="What you run today"
                    value={form.currentTools}
                    onChange={set("currentTools")}
                    placeholder="JobNimbus, Xactimate, EagleView, spreadsheets…"
                  />
                </fieldset>

                <fieldset>
                  <legend>What you want it to do</legend>
                  <div className="bk-chips">
                    {WANTS.map((w) => (
                      <button
                        type="button"
                        key={w}
                        className={wants.includes(w) ? "bk-chip on" : "bk-chip"}
                        aria-pressed={wants.includes(w)}
                        onClick={() => toggle(w)}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                  {!isSeat && (
                    <Field
                      label="Address to price on the call (optional)"
                      value={form.address}
                      onChange={set("address")}
                      placeholder="1420 Palm Bay Rd NE, Palm Bay, FL"
                    />
                  )}
                </fieldset>

                <fieldset className="bk-ask">
                  <legend>What are you trying to fix?</legend>
                  <textarea
                    rows={4}
                    value={form.goals}
                    onChange={(e) => set("goals")(e.target.value)}
                    placeholder="Estimates take too long, my reps price three different ways, nobody follows up on the reports we send…"
                  />
                  <p className="bk-note">This is the field we read first.</p>
                </fieldset>

                <button className="bk-btn bk-submit" type="submit" disabled={busy}>
                  {busy ? "Sending…" : isSeat ? "Reserve my seat" : "Book my demo"}
                </button>
                <p className="bk-fine">
                  No card, no contract.{" "}
                  {isSeat
                    ? "Your founding rate is locked the moment the seat is held."
                    : "We price your address before the call either way."}
                </p>
              </form>

              <aside className="bk-side">
                <h2>{isSeat ? "What happens next" : "What happens after you hit the button"}</h2>
                <ol className="bk-steps">
                  {steps.map(([when, title, body], i) => (
                    <li key={title}>
                      <span className="bk-n">{i + 1}</span>
                      <div>
                        <span className="bk-when-lbl">{when}</span>
                        <b>{title}</b>
                        <p>{body}</p>
                      </div>
                    </li>
                  ))}
                </ol>

                {isSeat && (
                  <div className="bk-bring-card">
                    <span className="bk-when-lbl">Have these ready</span>
                    <ul className="bk-bring">
                      {BRING.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                    <p className="bk-note">
                      None of it is a blocker. Come with what you have and we'll work around the
                      rest.
                    </p>
                  </div>
                )}
              </aside>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="bk-f">
      <span>
        {label}
        {required ? <i aria-hidden="true"> *</i> : null}
      </span>
      <input
        type={type}
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

const CSS = `
.gcn-book{--ink:#f4f8ff;--ink-2:#c3d0e8;--ink-3:#8fa2c2;--ink-4:#6c7d9c;
  --line:rgba(126,166,255,.22);--line-soft:rgba(126,166,255,.11);
  --panel:#0d121d;--panel-2:#131a29;--cyan:#38e8ff;--grass:#3ce08a;
  --grad:linear-gradient(135deg,#3ce08a,#17c27a 52%,#23d8c8);
  --mono:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,monospace;
  position:relative;min-height:100vh;background:#05070e;color:var(--ink);
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;isolation:isolate}
.gcn-book *{box-sizing:border-box}
.bk-scene{position:fixed;inset:0;z-index:-1;overflow:hidden;pointer-events:none;background:#05070e}
.bk-a,.bk-b{position:absolute;border-radius:50%;filter:blur(90px);opacity:.5}
.bk-a{width:46vmax;height:46vmax;top:-18vmax;left:-14vmax;background:radial-gradient(circle,#1e6bff 0%,transparent 70%)}
.bk-b{width:40vmax;height:40vmax;bottom:-16vmax;right:-12vmax;background:radial-gradient(circle,#12c56b 0%,transparent 70%)}
.bk-vig{position:absolute;inset:0;background:radial-gradient(ellipse 80% 70% at 50% 34%,transparent 38%,rgba(3,5,10,.88) 100%)}

.bk-nav{display:flex;align-items:center;gap:16px;max-width:1160px;margin:0 auto;padding:18px 22px}
.bk-brand{display:flex;align-items:center;gap:12px;text-decoration:none;color:inherit}
.bk-mark{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;font-weight:800;
  background:linear-gradient(150deg,#22304f,#131b2e);border:1px solid rgba(140,180,255,.34);color:#7fd4ff}
.bk-brand b{display:block;font-size:.98rem;letter-spacing:-.02em}
.bk-brand em{display:block;font-style:normal;font-family:var(--mono);font-size:.6rem;letter-spacing:.15em;text-transform:uppercase;color:var(--ink-4)}
.bk-signin{margin-left:auto;font-family:var(--mono);font-size:.73rem;letter-spacing:.09em;text-transform:uppercase;color:var(--ink-2);text-decoration:none;white-space:nowrap}
.bk-signin:hover{color:var(--cyan)}

.bk-wrap{max-width:1160px;margin:0 auto;padding:14px 22px 80px}
.bk-eyebrow{font-family:var(--mono);font-size:.69rem;letter-spacing:.17em;text-transform:uppercase;color:var(--cyan)}
.bk-head{max-width:70ch;margin-bottom:34px}
.gcn-book h1{font-size:clamp(2rem,4.4vw,3.1rem);font-weight:800;letter-spacing:-.03em;line-height:1.05;margin:12px 0 0}
.bk-lede{font-size:1.03rem;line-height:1.62;color:var(--ink-2);margin:14px 0 0;max-width:62ch}

.bk-grid{display:grid;gap:22px;align-items:start}
@media(min-width:960px){.bk-grid{grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr)}}

.bk-card{border-radius:16px;border:1px solid var(--line);padding:24px;display:flex;flex-direction:column;gap:20px;
  background:linear-gradient(180deg,var(--panel-2),var(--panel) 60%,#0b0f18);
  box-shadow:0 1px 0 rgba(255,255,255,.06) inset,0 30px 70px -34px rgba(0,0,0,.9)}
.gcn-book h2{font-size:1.15rem;font-weight:700;letter-spacing:-.02em;margin:0}
.gcn-book fieldset{border:0;padding:0;margin:0;display:flex;flex-direction:column;gap:12px}
.gcn-book legend{font-family:var(--mono);font-size:.65rem;letter-spacing:.15em;text-transform:uppercase;color:var(--grass);padding:0;margin-bottom:2px}
.bk-row{display:grid;gap:12px}
@media(min-width:520px){.bk-row{grid-template-columns:1fr 1fr}.bk-row-3{grid-template-columns:1.2fr 1fr .7fr}}
.bk-f{display:flex;flex-direction:column;gap:6px}
.bk-f>span{font-size:.82rem;font-weight:600;color:var(--ink-2)}
.bk-f>span i{color:var(--grass);font-style:normal}
.gcn-book input,.gcn-book select,.gcn-book textarea{
  width:100%;background:rgba(5,7,14,.7);border:1px solid var(--line);border-radius:11px;color:var(--ink);
  font:inherit;font-size:.94rem;padding:11px 13px;outline:none}
.gcn-book textarea{resize:vertical;line-height:1.5}
.gcn-book input:focus,.gcn-book select:focus,.gcn-book textarea:focus{border-color:rgba(56,232,255,.55);box-shadow:0 0 0 3px rgba(56,232,255,.12)}
.gcn-book input::placeholder,.gcn-book textarea::placeholder{color:var(--ink-4)}
.gcn-book select option{background:#0d121d;color:var(--ink)}

.bk-chips{display:flex;flex-wrap:wrap;gap:8px}
.bk-chip{font-family:var(--mono);font-size:.72rem;padding:8px 13px;border-radius:999px;cursor:pointer;
  border:1px solid var(--line-soft);background:transparent;color:var(--ink-3);transition:all .18s}
.bk-chip:hover{color:var(--ink-2);border-color:var(--line)}
.bk-chip.on{color:var(--grass);border-color:rgba(60,224,138,.5);background:rgba(60,224,138,.12)}

.bk-ask{border:1px solid rgba(60,224,138,.24);background:rgba(60,224,138,.05);border-radius:13px;padding:16px}
.bk-note{font-size:.8rem;color:var(--ink-4);margin:0}
.bk-fine{font-size:.8rem;color:var(--ink-4);text-align:center;margin:0}

.bk-btn{display:inline-flex;align-items:center;justify-content:center;gap:9px;white-space:nowrap;
  border:0;border-radius:13px;padding:14px 24px;cursor:pointer;text-decoration:none;
  font-size:.95rem;font-weight:700;color:#04120a;background:var(--grad);
  box-shadow:0 12px 26px -12px rgba(35,216,200,.85),inset 0 1px 0 rgba(255,255,255,.4);
  transition:filter .18s,transform .16s}
.bk-btn:hover{filter:brightness(1.06)}
.bk-btn:active{transform:translateY(1px)}
.bk-btn:disabled{opacity:.45;cursor:not-allowed;filter:none}
.bk-submit{width:100%}

.bk-side{display:flex;flex-direction:column;gap:16px;padding-top:4px}
.bk-steps{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
.bk-steps li{display:flex;gap:13px;padding:15px 17px;border-radius:13px;border:1px solid var(--line-soft);background:rgba(19,26,41,.5)}
.bk-n{flex:0 0 auto;width:26px;height:26px;border-radius:8px;display:grid;place-items:center;
  font-family:var(--mono);font-size:.74rem;font-weight:600;color:#04120a;background:var(--grad)}
.bk-when-lbl{display:block;font-family:var(--mono);font-size:.63rem;letter-spacing:.14em;text-transform:uppercase;color:var(--cyan);margin-bottom:3px}
.bk-steps b{display:block;font-size:.93rem;margin-bottom:3px}
.bk-steps p{margin:0;font-size:.86rem;line-height:1.5;color:var(--ink-3)}
.bk-bring-card{border-radius:13px;border:1px solid rgba(255,176,32,.3);background:rgba(255,176,32,.07);padding:16px 18px}
.bk-bring-card .bk-when-lbl{color:#ffb020}
.bk-bring{list-style:none;margin:10px 0 0;padding:0;display:flex;flex-direction:column;gap:7px}
.bk-bring li{font-size:.86rem;color:var(--ink-2);display:flex;gap:9px}
.bk-bring li::before{content:"→";color:#ffb020;font-family:var(--mono);font-size:.8rem}
.bk-bring-card .bk-note{margin-top:12px}

.bk-done{max-width:60ch;margin:40px auto 0;text-align:center;display:flex;flex-direction:column;align-items:center;gap:14px}
.bk-when{font-family:var(--mono);font-size:1.02rem;color:var(--grass);padding:12px 20px;border-radius:12px;
  border:1px solid rgba(60,224,138,.34);background:rgba(60,224,138,.1)}
.bk-done .bk-bring{text-align:left;margin-top:4px}

@media(prefers-reduced-motion:reduce){.gcn-book *{transition:none!important}}
`;
