import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useRef, useState, type FormEvent, type PointerEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { confirmInvitedEmail } from "@/lib/company-invite.functions";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { invite?: string } => ({
    invite: typeof search.invite === "string" ? search.invite : undefined,
  }),
  component: LoginPage,
});

/**
 * The sign-in screen.
 *
 * Deliberately a committed dark surface rather than theme tokens. The previous
 * version faded a light card into near-black, so half the copy sat on a
 * background the wrong side of its own colour — the heading was black on white
 * and the footer was dark on dark. Every colour below is picked for one fixed
 * dark ground, which is what makes all of it legible.
 *
 * The depth is real geometry, not a picture of it: the card sits in a
 * perspective container and tilts toward the pointer. Touch devices get the
 * resting state, and `prefers-reduced-motion` turns the whole scene static.
 */
function LoginPage() {
  const navigate = useNavigate();
  const { invite } = useSearch({ from: "/login" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  function tilt(e: PointerEvent<HTMLDivElement>) {
    // Mouse only: a finger already covers the card it would be tilting.
    if (e.pointerType !== "mouse" || !cardRef.current) return;
    const r = cardRef.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    cardRef.current.style.setProperty("--rx", `${(-py * 7).toFixed(2)}deg`);
    cardRef.current.style.setProperty("--ry", `${(px * 9).toFixed(2)}deg`);
    cardRef.current.style.setProperty("--gx", `${((px + 0.5) * 100).toFixed(1)}%`);
    cardRef.current.style.setProperty("--gy", `${((py + 0.5) * 100).toFixed(1)}%`);
  }

  function resetTilt() {
    const el = cardRef.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
    el.style.setProperty("--gx", "50%");
    el.style.setProperty("--gy", "0%");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    /* An invited user who signed up before accepting is left unconfirmed and
       cannot get in at all. A pending invite to that address is proof it is
       theirs, so confirm it and let them through rather than sending them back
       to an email they may never find. */
    if (error && /email not confirmed/i.test(error.message)) {
      let rescued = false;
      try {
        const { confirmed } = await confirmInvitedEmail({ data: { email } });
        if (confirmed) {
          const retry = await supabase.auth.signInWithPassword({ email, password });
          rescued = !retry.error;
        }
      } catch {
        // fall through to the plain message below
      }
      if (!rescued) {
        setLoading(false);
        toast.error("Your email isn't confirmed yet. Open your invite link to finish setting up.");
        return;
      }
    } else if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }

    setLoading(false);
    toast.success("Welcome back");
    if (invite) {
      navigate({ to: "/onboarding", search: { invite } });
    } else {
      navigate({ to: "/" });
    }
  }

  return (
    <div className="gcn-auth">
      <style>{AUTH_CSS}</style>

      {/* Scene: drifting light, a blueprint grid, and a slow horizon sweep. */}
      <div className="gcn-auth__scene" aria-hidden="true">
        <span className="gcn-auth__aurora gcn-auth__aurora--a" />
        <span className="gcn-auth__aurora gcn-auth__aurora--b" />
        <span className="gcn-auth__aurora gcn-auth__aurora--c" />
        <span className="gcn-auth__grid" />
        <span className="gcn-auth__scan" />
        <span className="gcn-auth__vignette" />
      </div>

      <div className="gcn-auth__stage" onPointerMove={tilt} onPointerLeave={resetTilt}>
        <div className="gcn-auth__card" ref={cardRef}>
          <span className="gcn-auth__sheen" aria-hidden="true" />

          <div className="gcn-auth__brand">
            <span className="gcn-auth__mark" aria-hidden="true">
              <span className="gcn-auth__mark-face">G</span>
            </span>
            <span className="gcn-auth__wordmark">
              <strong>GCN App</strong>
              <em>Estimating OS for contractors</em>
            </span>
          </div>

          <h1 className="gcn-auth__title">Welcome back</h1>
          <p className="gcn-auth__sub">
            {invite ? "Sign in to accept your invite" : "Sign in to your workspace to continue"}
          </p>

          {invite && (
            <div className="gcn-auth__notice">
              You have a pending invite. After signing in, we'll take you straight to accept it.
            </div>
          )}

          <form onSubmit={onSubmit} className="gcn-auth__form">
            <div className="gcn-auth__field">
              <label className="gcn-auth__label" htmlFor="gcn-email">
                Email
              </label>
              <input
                id="gcn-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="gcn-auth__input"
                placeholder="you@company.com"
              />
            </div>

            <div className="gcn-auth__field">
              <div className="gcn-auth__labelrow">
                <label className="gcn-auth__label" htmlFor="gcn-password">
                  Password
                </label>
                <Link to="/forgot-password" className="gcn-auth__link">
                  Forgot password?
                </Link>
              </div>
              <input
                id="gcn-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="gcn-auth__input"
                placeholder="••••••••"
              />
            </div>

            <button type="submit" disabled={loading} className="gcn-auth__submit">
              <span>{loading ? "Signing in…" : "Sign in"}</span>
            </button>
          </form>

          <p className="gcn-auth__foot">
            Don't have an account?{" "}
            <Link
              to="/signup"
              search={invite ? { invite } : undefined}
              className="gcn-auth__link gcn-auth__link--strong"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Scoped to `.gcn-auth` so none of it can leak into the themed app shell.
 * Contrast targets: body copy #c3d0e8 and labels #9fb2d2 both clear 7:1 on the
 * #0d121d card, and the heading is near-white — nothing here is a low-contrast
 * flourish.
 */
const AUTH_CSS = `
.gcn-auth {
  --ink: #f4f8ff;
  --ink-soft: #c3d0e8;
  --ink-dim: #9fb2d2;
  --edge: rgba(126,166,255,.22);
  --cyan: #38e8ff;
  --grass: #2fbf5f;
  position: relative;
  min-height: 100vh;
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: 40px 20px;
  background: #05070e;
  overflow: hidden;
  isolation: isolate;
}

.gcn-auth__scene { position: absolute; inset: 0; z-index: 0; pointer-events: none; }

.gcn-auth__aurora {
  position: absolute;
  border-radius: 50%;
  filter: blur(90px);
  opacity: .55;
  will-change: transform;
}
.gcn-auth__aurora--a {
  width: 46vmax; height: 46vmax; top: -16vmax; left: -12vmax;
  background: radial-gradient(circle, #1e6bff 0%, transparent 70%);
  animation: gcn-drift-a 22s ease-in-out infinite alternate;
}
.gcn-auth__aurora--b {
  width: 38vmax; height: 38vmax; bottom: -14vmax; right: -10vmax;
  background: radial-gradient(circle, #12c56b 0%, transparent 70%);
  animation: gcn-drift-b 27s ease-in-out infinite alternate;
}
.gcn-auth__aurora--c {
  width: 30vmax; height: 30vmax; top: 34%; right: 18%;
  background: radial-gradient(circle, #00d5ff 0%, transparent 70%);
  opacity: .32;
  animation: gcn-drift-c 19s ease-in-out infinite alternate;
}

/* A drafting grid, because this is an estimating tool. */
.gcn-auth__grid {
  position: absolute; inset: -50%;
  background-image:
    linear-gradient(rgba(120,170,255,.10) 1px, transparent 1px),
    linear-gradient(90deg, rgba(120,170,255,.10) 1px, transparent 1px);
  background-size: 46px 46px;
  transform: perspective(560px) rotateX(62deg);
  transform-origin: 50% 100%;
  mask-image: radial-gradient(ellipse 60% 55% at 50% 62%, #000 15%, transparent 72%);
  animation: gcn-grid 18s linear infinite;
}

.gcn-auth__scan {
  position: absolute; inset-inline: 0; height: 34vh; top: -34vh;
  background: linear-gradient(180deg, transparent, rgba(56,232,255,.07), transparent);
  animation: gcn-scan 11s linear infinite;
}

.gcn-auth__vignette {
  position: absolute; inset: 0;
  background: radial-gradient(ellipse 78% 66% at 50% 42%, transparent 40%, rgba(3,5,10,.86) 100%);
}

.gcn-auth__stage { position: relative; z-index: 1; perspective: 1200px; width: 100%; max-width: 430px; }

.gcn-auth__card {
  --rx: 0deg; --ry: 0deg; --gx: 50%; --gy: 0%;
  position: relative;
  padding: 38px 34px 32px;
  border-radius: 22px;
  border: 1px solid var(--edge);
  background:
    radial-gradient(420px 220px at var(--gx) var(--gy), rgba(90,150,255,.16), transparent 70%),
    linear-gradient(180deg, #131a29 0%, #0d121d 58%, #0b0f18 100%);
  box-shadow:
    0 1px 0 rgba(255,255,255,.07) inset,
    0 30px 70px -24px rgba(0,0,0,.9),
    0 0 0 1px rgba(0,0,0,.5);
  transform: rotateX(var(--rx)) rotateY(var(--ry));
  transform-style: preserve-3d;
  transition: transform .35s cubic-bezier(.22,1,.36,1), box-shadow .35s ease;
  animation: gcn-enter .7s cubic-bezier(.22,1,.36,1) both;
}
.gcn-auth__stage:hover .gcn-auth__card { box-shadow: 0 1px 0 rgba(255,255,255,.09) inset, 0 40px 90px -26px rgba(0,0,0,.95), 0 0 42px -14px rgba(56,232,255,.4); }

/* Slow travelling highlight along the top edge. */
.gcn-auth__sheen {
  position: absolute; inset: -1px; border-radius: inherit; pointer-events: none;
  padding: 1px;
  background: conic-gradient(from var(--a, 0deg), transparent 0 62%, rgba(56,232,255,.75) 78%, rgba(47,191,95,.6) 88%, transparent 100%);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  animation: gcn-sheen 6s linear infinite;
}

.gcn-auth__brand { display: flex; align-items: center; gap: 13px; margin-bottom: 30px; transform: translateZ(28px); }

.gcn-auth__mark {
  position: relative; display: grid; place-items: center;
  width: 46px; height: 46px; border-radius: 14px;
  background: linear-gradient(150deg, #22304f, #131b2e);
  border: 1px solid rgba(140,180,255,.34);
  box-shadow: 0 8px 20px -8px rgba(0,0,0,.95), 0 0 22px -8px rgba(56,232,255,.65), inset 0 1px 0 rgba(255,255,255,.16);
  animation: gcn-float 5.5s ease-in-out infinite;
}
.gcn-auth__mark-face {
  font-weight: 800; font-size: 20px; letter-spacing: -.5px;
  background: linear-gradient(140deg, #eaf3ff, #7fd4ff 55%, #3ce08a);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}

.gcn-auth__wordmark { display: flex; flex-direction: column; line-height: 1.15; }
.gcn-auth__wordmark strong { color: var(--ink); font-size: 18px; font-weight: 700; letter-spacing: -.3px; }
.gcn-auth__wordmark em {
  color: var(--ink-dim); font-style: normal; font-size: 10px; font-weight: 600;
  letter-spacing: 1.6px; text-transform: uppercase; margin-top: 3px;
}

.gcn-auth__title {
  color: var(--ink); font-size: 27px; font-weight: 700; letter-spacing: -.7px;
  transform: translateZ(20px);
}
.gcn-auth__sub { color: var(--ink-soft); font-size: 13.5px; margin-top: 7px; transform: translateZ(14px); }

.gcn-auth__notice {
  margin-top: 18px; padding: 11px 13px; border-radius: 11px; font-size: 12.5px;
  color: var(--ink-soft);
  background: rgba(56,232,255,.09);
  border: 1px solid rgba(56,232,255,.26);
}

.gcn-auth__form { margin-top: 26px; display: flex; flex-direction: column; gap: 16px; transform: translateZ(12px); }
.gcn-auth__field { display: flex; flex-direction: column; gap: 7px; }
.gcn-auth__labelrow { display: flex; align-items: center; justify-content: space-between; }
.gcn-auth__label { color: var(--ink-dim); font-size: 11.5px; font-weight: 700; letter-spacing: .4px; text-transform: uppercase; }

.gcn-auth__input {
  width: 100%; height: 46px; padding: 0 14px;
  border-radius: 12px;
  color: var(--ink); font-size: 14.5px;
  background: rgba(6,10,18,.78);
  border: 1px solid rgba(126,166,255,.24);
  outline: none;
  transition: border-color .18s ease, box-shadow .18s ease, background .18s ease;
}
.gcn-auth__input::placeholder { color: #6d7f9e; }
.gcn-auth__input:hover { border-color: rgba(126,166,255,.38); }
.gcn-auth__input:focus {
  border-color: var(--cyan);
  background: rgba(8,14,24,.95);
  box-shadow: 0 0 0 3px rgba(56,232,255,.18), 0 0 22px -8px rgba(56,232,255,.75);
}
/* Chrome paints its own near-white autofill background; keep our surface. */
.gcn-auth__input:-webkit-autofill,
.gcn-auth__input:-webkit-autofill:focus {
  -webkit-text-fill-color: var(--ink);
  -webkit-box-shadow: 0 0 0 1000px #0a111d inset;
  caret-color: var(--ink);
}

.gcn-auth__link { color: var(--cyan); font-size: 12px; font-weight: 700; text-decoration: none; }
.gcn-auth__link:hover { text-decoration: underline; }
.gcn-auth__link--strong { font-size: 13.5px; }

.gcn-auth__submit {
  position: relative; overflow: hidden;
  margin-top: 6px; height: 48px; width: 100%;
  border: none; border-radius: 13px; cursor: pointer;
  color: #04120a; font-size: 14.5px; font-weight: 800; letter-spacing: .2px;
  background: linear-gradient(135deg, #3ce08a, #17c27a 52%, #23d8c8);
  box-shadow: 0 12px 26px -12px rgba(35,216,200,.85), inset 0 1px 0 rgba(255,255,255,.4);
  transition: transform .16s ease, box-shadow .22s ease, filter .2s ease;
}
.gcn-auth__submit span { position: relative; z-index: 1; }
.gcn-auth__submit::after {
  content: ""; position: absolute; inset: 0;
  background: linear-gradient(105deg, transparent 30%, rgba(255,255,255,.55) 50%, transparent 70%);
  transform: translateX(-120%);
  animation: gcn-shine 3.6s ease-in-out infinite;
}
.gcn-auth__submit:hover { transform: translateY(-2px); box-shadow: 0 18px 34px -14px rgba(35,216,200,.95), inset 0 1px 0 rgba(255,255,255,.5); }
.gcn-auth__submit:active { transform: translateY(1px) scale(.995); }
.gcn-auth__submit:disabled { filter: grayscale(.35) brightness(.85); cursor: not-allowed; transform: none; }

.gcn-auth__foot { margin-top: 26px; text-align: center; color: var(--ink-soft); font-size: 13.5px; }

@keyframes gcn-enter {
  from { opacity: 0; transform: translateY(22px) rotateX(9deg) scale(.97); }
  to   { opacity: 1; transform: translateY(0) rotateX(0) scale(1); }
}
@keyframes gcn-drift-a { to { transform: translate3d(9vmax, 6vmax, 0) scale(1.14); } }
@keyframes gcn-drift-b { to { transform: translate3d(-8vmax, -5vmax, 0) scale(1.18); } }
@keyframes gcn-drift-c { to { transform: translate3d(-6vmax, 7vmax, 0) scale(.86); } }
@keyframes gcn-grid { to { background-position: 0 46px, 46px 0; } }
@keyframes gcn-scan { to { transform: translateY(160vh); } }
@keyframes gcn-float { 50% { transform: translateY(-5px); } }
@keyframes gcn-shine { 0%, 62% { transform: translateX(-120%); } 100% { transform: translateX(120%); } }
@property --a { syntax: '<angle>'; initial-value: 0deg; inherits: false; }
@keyframes gcn-sheen { to { --a: 360deg; } }

@media (max-width: 420px) {
  .gcn-auth__card { padding: 30px 22px 26px; border-radius: 18px; }
  .gcn-auth__title { font-size: 24px; }
}

@media (prefers-reduced-motion: reduce) {
  .gcn-auth__aurora,
  .gcn-auth__grid,
  .gcn-auth__scan,
  .gcn-auth__mark,
  .gcn-auth__card,
  .gcn-auth__sheen,
  .gcn-auth__submit::after { animation: none; }
  .gcn-auth__card { transition: none; transform: none; }
}
`;
