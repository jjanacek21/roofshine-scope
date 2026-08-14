import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/components/cb/motion";

/**
 * Renders one verbatim slide from the locked presentation deck.
 *
 * The markup ships with the app (never user input), so injecting it directly is
 * safe. This component only adds behaviour: `.rv` elements reveal on view and
 * `[data-count]` numbers count up when their slide comes into view.
 */
export function CbHtmlSlide({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const reveals = Array.from(root.querySelectorAll<HTMLElement>(".rv"));
    const counters = Array.from(root.querySelectorAll<HTMLElement>("[data-count]"));

    if (reduced) {
      reveals.forEach((el) => el.classList.add("in"));
      counters.forEach((el) => {
        el.textContent = formatCount(Number(el.dataset.count ?? 0), el.dataset.suffix ?? "");
      });
      return;
    }

    const timers: number[] = [];

    function runCount(el: HTMLElement) {
      if (el.dataset.counted === "1") return;
      el.dataset.counted = "1";
      const target = Number(el.dataset.count ?? 0);
      const suffix = el.dataset.suffix ?? "";
      const decimals = target % 1 === 0 ? 0 : 1;
      const start = performance.now();
      const dur = 900;
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = formatCount(target * eased, suffix, decimals);
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target as HTMLElement;
          el.classList.add("in");
          el.querySelectorAll<HTMLElement>("[data-count]").forEach(runCount);
          if (el.dataset.count != null) runCount(el);
          io.unobserve(el);
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );

    [...reveals, ...counters].forEach((el) => io.observe(el));

    /* A slide that opens already fully on screen must never sit invisible. */
    timers.push(
      window.setTimeout(() => {
        reveals.forEach((el) => el.classList.add("in"));
        counters.forEach(runCount);
      }, 900),
    );

    return () => {
      io.disconnect();
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [html, reduced]);

  return <div ref={ref} className="cb-deck" dangerouslySetInnerHTML={{ __html: html }} />;
}

function formatCount(value: number, suffix: string, decimals = 0) {
  return `${value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}${suffix}`;
}
