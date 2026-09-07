/**
 * Claim Buddy standalone landing behaviour (gcn.claims only).
 *
 * Deliberately ONE module with ONE set of bindings — an earlier version of this
 * page shipped two script blocks that both declared `tk`, and the resulting
 * SyntaxError killed every script on the page (including the reveal observer,
 * which left everything below the header invisible). Keep it that way.
 *
 * Everything is scoped to the mounted root and returned in a single disposer.
 */

import { CB_LANDING_LOGO } from "./refMarkup";

export function mountCbHome(root: HTMLElement): () => void {
  const disposers: Array<() => void> = [];
  const reduce =
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = typeof matchMedia === "function" && matchMedia("(pointer:fine)").matches;

  const on = (t: EventTarget, type: string, fn: EventListener, o?: AddEventListenerOptions) => {
    t.addEventListener(type, fn, o);
    disposers.push(() => t.removeEventListener(type, fn, o));
  };

  root.classList.add("cb-standalone");
  disposers.push(() => root.classList.remove("cb-standalone"));

  /* ---------- header logo that bleeds into the hero ---------- */
  const navIn = root.querySelector<HTMLElement>("header.nav .nav-in");
  if (navIn && !navIn.querySelector(".cbh-navlogo")) {
    const logo = document.createElement("img");
    logo.className = "cbh-navlogo";
    logo.src = CB_LANDING_LOGO;
    logo.alt = "Claim Buddy";
    navIn.appendChild(logo);
    disposers.push(() => logo.remove());
  }

  /* ---------- sticky shrink + scroll progress + grid parallax ---------- */
  const bar = document.createElement("div");
  bar.className = "cbh-prog";
  root.appendChild(bar);
  disposers.push(() => bar.remove());

  const grid = root.querySelector<HTMLElement>("#cbhGrid");
  let sTick = 0;
  const onScroll = () => {
    if (sTick) return;
    sTick = requestAnimationFrame(() => {
      sTick = 0;
      const y = window.scrollY || 0;
      document.body.classList.toggle("shrunk", y > 90);
      const max = Math.max(document.documentElement.scrollHeight - innerHeight, 1);
      bar.style.width = `${Math.min(y / max, 1) * 100}%`;
      if (grid && !reduce) grid.style.transform = `translate3d(0,${y * 0.18}px,0)`;
    });
  };
  on(window, "scroll", onScroll, { passive: true });
  onScroll();
  disposers.push(() => {
    if (sTick) cancelAnimationFrame(sTick);
    document.body.classList.remove("shrunk");
  });

  /* ---------- reveal + count-ups ---------- */
  const counted = new WeakSet<Element>();
  const runCount = (el: HTMLElement) => {
    if (counted.has(el)) return;
    counted.add(el);
    const to = parseFloat(el.dataset.to ?? "0");
    const dec = parseInt(el.dataset.dec ?? "0", 10);
    const sep = el.dataset.sep === "1";
    const fmt = (n: number) => {
      const s = n.toFixed(dec);
      return sep ? Number(s).toLocaleString("en-US", { maximumFractionDigits: dec }) : s;
    };
    if (reduce) {
      el.textContent = fmt(to);
      return;
    }
    let t0: number | null = null;
    let raf = 0;
    const step = (ts: number) => {
      if (t0 === null) t0 = ts;
      const p = Math.min((ts - t0) / 1600, 1);
      el.textContent = fmt(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    disposers.push(() => cancelAnimationFrame(raf));
  };

  const targets = [...root.querySelectorAll<HTMLElement>(".cbh-rv")];
  const counts = [...root.querySelectorAll<HTMLElement>(".cbh-count")];

  if (reduce || typeof IntersectionObserver === "undefined") {
    targets.forEach((t) => t.classList.add("in"));
    counts.forEach(runCount);
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const el = e.target as HTMLElement;
          el.classList.add("in");
          el.querySelectorAll<HTMLElement>(".cbh-count").forEach(runCount);
          if (el.classList.contains("cbh-count")) runCount(el);
          io.unobserve(el);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.06 },
    );
    targets.forEach((t) => io.observe(t));
    counts.forEach((c) => io.observe(c));
    disposers.push(() => io.disconnect());
  }

  /* ---------- iOS-safe autoplay for the price book clip ---------- */
  const vids = [...root.querySelectorAll<HTMLVideoElement>(".cbh-video")];
  const kick = () => {
    vids.forEach((v) => {
      v.muted = true;
      v.playsInline = true;
      void v.play().catch(() => {});
    });
  };
  kick();
  on(window, "load", kick);
  on(document, "pointerdown", kick, { once: true });
  on(document, "touchstart", kick, { once: true });

  /* ---------- card tilt + sheen ---------- */
  if (fine && !reduce) {
    root.querySelectorAll<HTMLElement>(".tilt3d").forEach((card) => {
      const move = (ev: Event) => {
        const e = ev as PointerEvent;
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        card.style.setProperty("--ry", `${(px - 0.5) * 8}deg`);
        card.style.setProperty("--rx", `${(0.5 - py) * 8}deg`);
        card.style.setProperty("--gx", `${px * 100}%`);
        card.style.setProperty("--gy", `${py * 100}%`);
      };
      const enter = () => card.classList.add("lit");
      const leave = () => {
        card.classList.remove("lit");
        card.style.setProperty("--rx", "0deg");
        card.style.setProperty("--ry", "0deg");
      };
      on(card, "pointermove", move, { passive: true });
      on(card, "pointerenter", enter);
      on(card, "pointerleave", leave);
    });
  }

  /* ---------- custom cursor ---------- */
  if (fine && !reduce) {
    const dot = document.createElement("div");
    dot.className = "cbh-dot";
    const ring = document.createElement("div");
    ring.className = "cbh-ring";
    root.append(dot, ring);
    let mx = -100;
    let my = -100;
    let rx = -100;
    let ry = -100;
    let raf = 0;
    const loop = () => {
      rx += (mx - rx) * 0.16;
      ry += (my - ry) * 0.16;
      ring.style.transform = `translate(${rx}px,${ry}px) translate(-50%,-50%)`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    on(
      window,
      "pointermove",
      (ev) => {
        const e = ev as PointerEvent;
        mx = e.clientX;
        my = e.clientY;
        dot.style.transform = `translate(${mx}px,${my}px) translate(-50%,-50%)`;
        const t = e.target as Element | null;
        ring.classList.toggle("hot", !!t?.closest?.("a, button, .fbox"));
      },
      { passive: true },
    );
    disposers.push(() => {
      cancelAnimationFrame(raf);
      dot.remove();
      ring.remove();
    });
  }

  return () => disposers.forEach((d) => d());
}
