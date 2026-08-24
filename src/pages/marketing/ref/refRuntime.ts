/**
 * Behaviour ported from gcn_landing_reference.html.
 *
 * Everything is scoped to the mounted root element and every listener is
 * returned in a disposer, so React can mount/unmount the marketing site
 * without leaking observers, rAF loops or step-player timers.
 */

import { M, TABS, STEPS, CATS, CATMAP, VIDS, RAMP, POSTS, QUEUE, SEQ, BANDS } from "./refData";
import { mountLumaLogo } from "./logoVideo";

export type MountOptions = {
  /** key -> resolved image URL (CMS first, repo fallback). */
  shots: Record<string, string>;
  /** Brand images, already resolved. */
  brand: { animated: string; still: string; mark: string; video: string; videoWebm?: string };
  initialView: string;
  /** Called whenever an in-page link changes the view, so the router can sync the URL. */
  onView?: (view: string) => void;
  /** Prototype views the real app owns: view key -> app URL. */
  redirects?: Record<string, string>;
  /** Navigate out of the prototype shell (router push). */
  onExternal?: (url: string) => void;
  /** Rewrites CMS-editable copy inside runtime-generated HTML. */
  text?: (html: string) => string;
  /** Gallery filter chips: [id, label]. Built from the categories present in the CMS. */
  cats?: string[][];
  /** media key -> category, from the CMS; overrides the built-in mapping. */
  catByKey?: Record<string, string>;
  /** Receives the view switcher so React can drive it when the route changes. */
  exposeGo?: (go: (view: string, notify?: boolean) => void) => void;
};

const HOME_PLAYER_KEYS = [
  "m1_pin",
  "m2_measuring",
  "m3_footprint",
  "m4_drawing",
  "m5_lines",
  "m6_label",
  "m7_labeled",
];

export function mountMarketingRef(root: HTMLElement, opts: MountOptions): () => void {
  const SHOTS = opts.shots;
  const disposers: Array<() => void> = [];
  const stops: Array<() => void> = [];

  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector<T>(sel);
  const $$ = <T extends HTMLElement = HTMLElement>(sel: string) =>
    [...root.querySelectorAll<T>(sel)];
  const on = <K extends keyof HTMLElementEventMap>(
    target: EventTarget,
    type: K | string,
    fn: EventListenerOrEventListenerObject,
    o?: AddEventListenerOptions,
  ) => {
    target.addEventListener(type, fn, o);
    disposers.push(() => target.removeEventListener(type, fn, o));
  };

  const src = (k: string) => SHOTS[k] ?? "";
  const shotImg = (k: string, cls = "") =>
    `<img class="${cls}" src="${src(k)}" alt="${M[k] ? M[k].t : ""} screen" loading="lazy">`;
  const phone = (inner: string) => `<div class="dev tilt"><div class="scr">${inner}</div></div>`;
  const shotCard = (k: string) => {
    const m = M[k];
    return `<figure class="shot rv-3d" data-lb="${k}" style="margin:0">
      ${shotImg(k)}
      <figcaption class="cap"><h4>${m ? m.t : k}</h4><p>${m ? m.b : ""}</p></figcaption></figure>`;
  };

  // Declared before anything that can call observe() (pane(), gal(), go()).
  let io: IntersectionObserver | null = null;

  const reduce =
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- brand logo ---------- */
  function playLogo() {
    const el = $<HTMLImageElement>("#logoAnim");
    if (!el) return;
    const still = () => {
      el.src = opts.brand.still;
    };
    if (reduce || !opts.brand.video) {
      still();
      return;
    }
    // Luma-keyed video: the black plate becomes real transparency.
    stops.push(mountLumaLogo(el, [opts.brand.videoWebm ?? "", opts.brand.video], still));
  }
  playLogo();

  $$<HTMLImageElement>("[data-shot]").forEach((im) => {
    const url = src(im.dataset.shot ?? "");
    if (!url) {
      // No CMS row and no repo file for this key — drop the frame rather than
      // leaving a broken image in the layout.
      (im.closest(".dev, figure, .scr") ?? im).remove();
      return;
    }
    im.src = url;
  });

  /* ---------- build ---------- */
  const rewrite = opts.text ?? ((h: string) => h);
  const setHTML = (sel: string, html: string) => {
    const el = $(sel);
    if (el) el.innerHTML = rewrite(html);
  };

  setHTML(
    "#steps",
    STEPS.map(
      (s, i) => `<div class="st"><div class="n">0${i + 1}</div>
   <h3 style="margin:8px 0 7px">${s[0]}</h3>
   <p class="tiny" style="line-height:1.55">${s[1]}</p></div>`,
    ).join(""),
  );

  const has = (k: string) => Boolean(SHOTS[k]);
  const marqKeys = Object.keys(M).filter(has);
  setHTML(
    "#marqT",
    [...marqKeys, ...marqKeys].map((k) => `<div class="m" data-lb="${k}">${shotImg(k)}</div>`).join(""),
  );

  setHTML("#bands", BANDS.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join(""));

  setHTML(
    "#ramp",
    RAMP.map(
      (r, i) => `<div class="card elev-card rv-3d" style="padding:18px">
    <div class="row" style="justify-content:space-between"><span class="micro">${r[0]}</span>
      <span class="mono tiny acc">0${i + 1}</span></div>
    <h3 style="margin:10px 0 7px;font-size:1rem">${r[1]}</h3>
    <p class="tiny" style="line-height:1.55">${r[2]}</p></div>`,
    ).join(""),
  );

  setHTML(
    "#vids",
    VIDS.map(
      (v) => `<article class="vid rv-3d"><div class="vthumb">${shotImg(v[2])}
    <div class="play"><i></i></div><span class="dur">${v[1]}</span></div>
   <div style="padding:16px 18px 18px"><h3>${v[0]}</h3></div></article>`,
    ).join(""),
  );

  setHTML(
    "#posts",
    POSTS.map(
      (p) => `<article class="post rv-3d"><div class="row" style="gap:8px">
    <span class="micro">${p[2]}</span><span class="micro">·</span><span class="micro">${p[3]}</span></div>
   <h3 style="margin:11px 0 8px">${p[0]}</h3><p class="tiny" style="line-height:1.6">${p[1]}</p>
   <p class="tiny acc" style="margin-top:14px;font-weight:600">Read →</p></article>`,
    ).join(""),
  );

  setHTML(
    "#queue",
    QUEUE.map(
      (q) =>
        `<tr><td>${q[0]}</td><td><span class="chip ${q[3]}">${q[1]}</span></td><td class="mono tiny">${q[2]}</td></tr>`,
    ).join(""),
  );

  setHTML(
    "#seq",
    SEQ.map(
      (s, i) => `<div class="card elev-card rv" style="padding:17px 19px">
    <div class="row" style="justify-content:space-between;gap:10px">
      <span class="micro">${s[0]}</span><span class="mono tiny">0${i + 1}</span></div>
    <h3 style="margin:9px 0 6px;font-size:1rem">${s[1]}</h3>
    <p class="tiny" style="line-height:1.6">${s[2]}</p></div>`,
    ).join(""),
  );

  setHTML("#allShots", marqKeys.map(shotCard).join(""));

  /* ---------- product tabs ---------- */
  setHTML(
    "#tabs",
    TABS.map(
      (t, i) =>
        `<button class="tab" role="tab" data-tab="${i}" aria-selected="${i === 0}">${t.n}</button>`,
    ).join(""),
  );

  function pane(i: number) {
    const paneEl = $("#pane");
    if (!paneEl) return;
    const t = TABS[i];
    const tabShots = t.shots.filter(has);
    const tabExtra = (t.extra ?? []).filter(has);
    const lbl = $("#paneLbl");
    if (lbl) lbl.textContent = t.n.replace("&amp;", "&");
    const media = t.player
      ? t.paper
        ? `<div class="rv-3d"><div class="player" id="playTab"></div>
           <div id="playTabUI"></div></div>`
        : `<div class="dev tilt" style="max-width:340px"><div class="scr player" id="playTab"></div></div>
           <div style="max-width:340px;margin:0 auto" id="playTabUI"></div>`
      : phone(shotImg(tabShots[0] ?? ""));
    const gridKeys = t.extra ? tabExtra : tabShots.length > 1 ? tabShots.slice(1) : [];
    const extra = gridKeys.length
      ? `<div class="grid g4" style="margin-top:26px;gap:14px">${gridKeys.map(shotCard).join("")}</div>`
      : "";
    paneEl.innerHTML = `<div class="stack g16 rv"><h2 style="font-size:clamp(1.4rem,2.4vw,2rem)">${t.h}</h2>
      <p class="lead" style="font-size:1rem">${t.c}</p>
      <div class="row">${t.chips.map((c) => `<span class="chip">${c}</span>`).join("")}</div>
      <div class="row" style="margin-top:8px">
        <button class="btn btn-p" data-go="signup"><span>Book a demo</span><i class="spec"></i></button></div></div>
     <div class="stage"><div class="rv-3d">${media}</div></div>`;
    const host = paneEl.parentElement;
    if (host) {
      let ex = root.querySelector<HTMLElement>("#paneExtra");
      if (!ex) {
        ex = document.createElement("div");
        ex.id = "paneExtra";
        host.appendChild(ex);
      }
      ex.innerHTML = extra;
    }
    if (t.player) mountPlayer("playTab", "playTabUI", tabShots, !!t.paper);
    observe();
  }
  if ($("#pane")) pane(0);

  const tabsEl = $("#tabs");
  if (tabsEl) {
    on(tabsEl, "click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>("[data-tab]");
      if (!b) return;
      $$("#tabs .tab").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
      pane(+(b.dataset.tab ?? 0));
    });
  }

  /* ---------- gallery ---------- */
  const GCATS = opts.cats?.length ? opts.cats : CATS;
  const norm = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, "");
  const CATOF = (k: string) => opts.catByKey?.[norm(k)] ?? CATMAP[k] ?? "";
  setHTML(
    "#gfilter",
    GCATS.map(
      (c, i) => `<button class="tab" data-cat="${c[0]}" aria-selected="${i === 0}">${c[1]}</button>`,
    ).join(""),
  );
  function gal(cat: string) {
    const keys = marqKeys.filter((k) => cat === "all" || CATOF(k) === cat);
    setHTML("#gal", keys.map(shotCard).join(""));
    observe();
  }
  if ($("#gal")) gal("all");
  const gfilter = $("#gfilter");
  if (gfilter) {
    on(gfilter, "click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>("[data-cat]");
      if (!b) return;
      $$("#gfilter .tab").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
      gal(b.dataset.cat ?? "all");
    });
  }

  /* ---------- step player ---------- */
  function mountPlayer(frameId: string, uiId: string, keys: string[], paper?: boolean) {
    const host = root.querySelector<HTMLElement>("#" + frameId);
    const ui = root.querySelector<HTMLElement>("#" + uiId);
    if (!host || !ui || !keys.length) return;
    const DUR = paper ? 2600 : 2100;
    host.innerHTML = `<div class="frames${paper ? " paper" : ""}">${keys
      .map(
        (k, i) =>
          `<img src="${src(k)}" alt="${M[k] ? M[k].t : k}" class="${i === 0 ? "on" : ""}">`,
      )
      .join("")}
      <div class="scan"></div></div>`;
    ui.innerHTML = `<div class="pbar">${keys
      .map(
        (_, i) => `<button class="pseg" data-i="${i}" aria-label="Step ${i + 1}"><i></i></button>`,
      )
      .join("")}</div>
    <div class="pinfo"><div><h4></h4><p></p></div>
      <button class="pbtn" aria-label="Pause">&#10074;&#10074;</button></div>`;

    const frames = host.querySelector<HTMLElement>(".frames")!;
    const imgs = [...host.querySelectorAll<HTMLImageElement>("img")];
    const segs = [...ui.querySelectorAll<HTMLElement>(".pseg")];
    const h4 = ui.querySelector("h4")!;
    const pp = ui.querySelector("p")!;
    const btn = ui.querySelector<HTMLElement>(".pbtn")!;
    let i = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let playing = !reduce;

    if (paper) on(frames, "click", () => openLb(keys[i]));

    function show(n: number) {
      i = (n + keys.length) % keys.length;
      imgs.forEach((im, x) => im.classList.toggle("on", x === i));
      frames.classList.toggle("busy", keys[i] === "m2_measuring");
      const m = M[keys[i]];
      h4.innerHTML = m ? m.t : keys[i];
      pp.innerHTML = m ? m.b : "";
      segs.forEach((sg, x) => {
        sg.classList.remove("now", "done");
        if (x < i) sg.classList.add("done");
      });
      if (playing) {
        void segs[i].offsetWidth;
        segs[i].style.setProperty("--dur", DUR + "ms");
        segs[i].classList.add("now");
      } else segs[i].classList.add("done");
    }
    function tick() {
      if (timer) clearTimeout(timer);
      if (!playing) return;
      timer = setTimeout(() => {
        show(i + 1);
        tick();
      }, DUR);
    }
    function setPlay(v: boolean) {
      playing = v;
      btn.innerHTML = v ? "&#10074;&#10074;" : "&#9654;";
      btn.setAttribute("aria-label", v ? "Pause" : "Play");
      show(i);
      tick();
    }
    segs.forEach((sg) =>
      on(sg, "click", () => {
        setPlay(false);
        show(+(sg.dataset.i ?? 0));
      }),
    );
    on(btn, "click", () => setPlay(!playing));
    stops.push(() => {
      if (timer) clearTimeout(timer);
    });
    setPlay(!reduce);
  }
  mountPlayer("playHome", "playHomeUI", HOME_PLAYER_KEYS.filter(has));

  /* ---------- routing (in-page views) ---------- */
  const views = $$(".view");
  const nav = $("#nav");
  const menuBtn = $("#menuBtn");
  function go(v: string, notify = true) {
    // Views the real app owns (demo form, login) leave the prototype shell.
    const external = opts.redirects?.[v];
    if (external) {
      opts.onExternal?.(external);
      return;
    }
    views.forEach((s) => s.classList.toggle("on", s.id === "v-" + v));
    $$("#nav button").forEach((b) =>
      b.setAttribute("aria-current", b.dataset.v === v ? "page" : "false"),
    );
    nav?.classList.remove("open");
    menuBtn?.setAttribute("aria-expanded", "false");
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    if (v === "home") playLogo();
    requestAnimationFrame(observe);
    if (notify) opts.onView?.(v);
  }
  go(opts.initialView, false);
  opts.exposeGo?.(go);

  if (menuBtn && nav) {
    on(menuBtn, "click", () => {
      const o = nav.classList.toggle("open");
      menuBtn.setAttribute("aria-expanded", String(o));
    });
  }

  /* ---------- theme toggle + sticky header ---------- */
  const themer = $("#themer");
  if (themer) {
    on(themer, "click", () => {
      const r = document.documentElement;
      const now =
        r.getAttribute("data-theme") ||
        (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      r.setAttribute("data-theme", now === "dark" ? "light" : "dark");
    });
  }
  const hdr = $("#hdr");
  if (hdr) {
    on(window, "scroll", () => hdr.classList.toggle("stuck", window.scrollY > 10), {
      passive: true,
    });
    // The light follows the cursor across the nav row, so dragging over the
    // links lights each one from wherever the pointer entered it.
    on(hdr, "pointermove", (e) => {
      const pe = e as PointerEvent;
      const btn = (pe.target as HTMLElement | null)?.closest?.("nav.links button");
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      (btn as HTMLElement).style.setProperty("--mx", `${((pe.clientX - r.left) / r.width) * 100}%`);
      (btn as HTMLElement).style.setProperty("--my", `${((pe.clientY - r.top) / r.height) * 100}%`);
    });
  }

  const footLogo = $<HTMLImageElement>("#footLogo");
  if (footLogo) {
    const footStill = () => {
      footLogo.src = opts.brand.still;
    };
    if (reduce || !opts.brand.video) footStill();
    else stops.push(mountLumaLogo(footLogo, [opts.brand.videoWebm ?? "", opts.brand.video], footStill));
  }


  on(root, "click", (e) => {
    const target = e.target as HTMLElement;
    const lb = target.closest<HTMLElement>("[data-lb]");
    const nv = target.closest<HTMLElement>("[data-v]");
    const gv = target.closest<HTMLElement>("[data-go]");
    if (lb) {
      openLb(lb.dataset.lb ?? "");
      return;
    }
    if (nv) {
      e.preventDefault();
      go(nv.dataset.v ?? "home");
      return;
    }
    if (gv) {
      e.preventDefault();
      if (gv.dataset.plan) {
        const plan = $("#ckPlan");
        const unit = $("#ckUnit");
        if (plan) plan.textContent = gv.dataset.plan;
        if (unit) {
          unit.textContent = "$" + gv.dataset.amt;
          unit.dataset.amt = gv.dataset.amt ?? "0";
        }
        price();
      }
      go(gv.dataset.go ?? "home");
    }
  });

  /* ---------- reveal on scroll ---------- */
  function observe() {
    if (!io) {
      io = new IntersectionObserver(
        (es) => {
          es.forEach((en) => {
            if (en.isIntersecting) {
              const el = en.target as HTMLElement;
              const sibs = [...(el.parentElement?.children ?? [])].filter(
                (c) => c.classList.contains("rv") || c.classList.contains("rv-3d"),
              );
              const idx = Math.max(0, sibs.indexOf(el));
              el.style.transitionDelay = Math.min(idx * 70, 420) + "ms";
              el.classList.add("is-in");
              io!.unobserve(el);
            }
          });
        },
        { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
      );
    }
    $$(".rv:not(.is-in), .rv-3d:not(.is-in)").forEach((el) => io!.observe(el));
  }
  observe();
  disposers.push(() => io?.disconnect());

  /* ---------- headline word stagger ---------- */
  const heroH = $("#heroH");
  if (heroH) {
    heroH.innerHTML = (heroH.textContent ?? "")
      .trim()
      .split(" ")
      .map((w, i) => {
        const cls = /door\.?$/i.test(w) ? ' class="hl"' : "";
        return `<span class="wrapw"><span class="word" style="transition-delay:${i * 48}ms"><span${cls}>${w}</span></span></span> `;
      })
      .join("");
    const t = setTimeout(
      () => $$("#heroH .word").forEach((w) => w.classList.add("is-in")),
      120,
    );
    disposers.push(() => clearTimeout(t));
  }

  /* ---------- hero square counter ---------- */
  const sqv = $("#sqv");
  if (sqv) {
    const targetVal = 52.6;
    if (reduce) sqv.textContent = targetVal.toFixed(1);
    else {
      let t0: number | null = null;
      let raf = 0;
      const step = (ts: number) => {
        if (!t0) t0 = ts;
        const p = Math.min((ts - t0) / 2100, 1);
        const e = 1 - Math.pow(1 - p, 3);
        sqv.textContent = (targetVal * e).toFixed(1);
        if (p < 1) raf = requestAnimationFrame(step);
      };
      const kick = setTimeout(() => {
        raf = requestAnimationFrame(step);
      }, 420);
      disposers.push(() => {
        clearTimeout(kick);
        cancelAnimationFrame(raf);
      });
    }
  }

  /* ---------- 3D parallax ---------- */
  if (!reduce) {
    let raf: number | null = null;
    let tx = 0,
      ty = 0,
      cx = 0,
      cy = 0;
    const loop = () => {
      cx += (tx - cx) * 0.07;
      cy += (ty - cy) * 0.07;
      const fan = $("#fan");
      if (fan) fan.style.transform = `rotateY(${cx * 7}deg) rotateX(${-cy * 5}deg)`;
      $$(".tilt").forEach((t) => {
        t.style.transform = `perspective(900px) rotateY(${cx * 4}deg) rotateX(${-cy * 3}deg)`;
      });
      raf =
        Math.abs(tx - cx) > 0.001 || Math.abs(ty - cy) > 0.001 ? requestAnimationFrame(loop) : null;
    };
    on(
      window,
      "mousemove",
      (e) => {
        const me = e as MouseEvent;
        tx = (me.clientX / innerWidth - 0.5) * 2;
        ty = (me.clientY / innerHeight - 0.5) * 2;
        if (!raf) raf = requestAnimationFrame(loop);
      },
      { passive: true },
    );
    disposers.push(() => {
      if (raf) cancelAnimationFrame(raf);
    });
  }

  /* ---------- lightbox + toast (created here, not in the markup) ---------- */
  const lb = document.createElement("div");
  lb.className = "lb";
  lb.innerHTML = `<button class="x" aria-label="Close">×</button><img id="lbi" alt=""><div class="lbcap" id="lbc"></div>`;
  root.appendChild(lb);
  const toastEl = document.createElement("div");
  toastEl.className = "toast";
  root.appendChild(toastEl);
  disposers.push(() => {
    lb.remove();
    toastEl.remove();
  });

  function openLb(k: string) {
    const im = lb.querySelector<HTMLImageElement>("#lbi");
    const cap = lb.querySelector<HTMLElement>("#lbc");
    if (im) im.src = src(k);
    if (cap) cap.innerHTML = M[k] ? M[k].t : "";
    lb.classList.add("on");
  }
  on(lb, "click", (e) => {
    if ((e.target as HTMLElement).id !== "lbi") lb.classList.remove("on");
  });
  on(window, "keydown", (e) => {
    if ((e as KeyboardEvent).key === "Escape") lb.classList.remove("on");
  });

  let toastTimer: ReturnType<typeof setTimeout> | null = null;
  function toast(msg: string) {
    toastEl.textContent = msg;
    toastEl.classList.add("up");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("up"), 3200);
  }
  disposers.push(() => {
    if (toastTimer) clearTimeout(toastTimer);
  });

  /* ---------- checkout math ---------- */
  const seats = $<HTMLSelectElement>("#ckSeats");
  function price() {
    const unitEl = $("#ckUnit");
    if (!seats || !unitEl) return;
    const n = +seats.value;
    const unit = +(unitEl.dataset.amt ?? 0);
    const d = n >= 51 ? 0.3 : n >= 11 ? 0.25 : n >= 4 ? 0.15 : 0;
    const disc = $("#ckDisc");
    const total = $("#ckTotal");
    if (disc) disc.textContent = d ? "−" + d * 100 + "%" : "—";
    if (total) total.textContent = "$" + Math.round(unit * n * (1 - d)).toLocaleString();
  }
  if (seats) {
    seats.innerHTML = Array.from({ length: 60 }, (_, i) => i + 1)
      .map((n) => `<option value="${n}"${n === 6 ? " selected" : ""}>${n} seat${n > 1 ? "s" : ""}</option>`)
      .join("");
    on(seats, "change", price);
    price();
  }

  /* ---------- admin demo button ---------- */
  const genBtn = $("#genBtn");
  if (genBtn) {
    on(genBtn, "click", () =>
      toast("Drafted “" + ($<HTMLInputElement>("#apTopic")?.value ?? "") + "” — queued for Monday 08:00"),
    );
  }

  return () => {
    stops.forEach((s) => s());
    disposers.forEach((d) => d());
  };
}
