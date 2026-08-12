/**
 * Claim Buddy motion primitives.
 *
 * Rules baked in here:
 *  - IntersectionObserver only, never scroll listeners.
 *  - Only `transform` and `opacity` are animated.
 *  - `prefers-reduced-motion` disables everything and shows final state at once.
 */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from "react";

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

export function useIsPointerDevice(): boolean {
  const [pointer, setPointer] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const on = () => setPointer(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return pointer;
}

/** Fires once when the element scrolls into view. */
export function useInView<T extends HTMLElement>(rootMargin = "0px 0px -8% 0px") {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setInView(true);
            io.disconnect();
          }
        }
      },
      { rootMargin, threshold: 0.08 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);

  return { ref, inView };
}

/** Rise 18px + fade, 420ms, cubic-bezier(.16,1,.3,1). */
export function CbReveal({
  children,
  delay = 0,
  as: Tag = "div",
  className = "",
  style,
}: {
  children: ReactNode;
  delay?: number;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
}) {
  const reduced = usePrefersReducedMotion();
  const { ref, inView } = useInView<HTMLDivElement>();
  const on = reduced || inView;

  return (
    <Tag
      ref={ref}
      className={`cb-reveal ${on ? "is-in" : ""} ${className}`}
      style={{ transitionDelay: reduced ? "0ms" : `${delay}ms`, ...style }}
    >
      {children}
    </Tag>
  );
}

/** Staggers direct children 55ms apart. */
export function CbStagger({
  children,
  step = 55,
  className = "",
  style,
}: {
  children: ReactNode[];
  step?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={className} style={style}>
      {children.map((child, i) => (
        <CbReveal key={i} delay={i * step}>
          {child}
        </CbReveal>
      ))}
    </div>
  );
}

/** Headline that reveals word by word. */
export function CbHeadline({
  text,
  className = "",
  style,
  as: Tag = "h1",
  step = 55,
}: {
  text: string;
  className?: string;
  style?: CSSProperties;
  as?: ElementType;
  step?: number;
}) {
  const reduced = usePrefersReducedMotion();
  const { ref, inView } = useInView<HTMLHeadingElement>();
  const on = reduced || inView;
  const words = useMemo(() => text.split(" "), [text]);

  return (
    <Tag ref={ref} className={className} style={style}>
      {words.map((w, i) => (
        <Fragment key={`${w}-${i}`}>
          <span className="cb-word-wrap">
            <span
              className={`cb-word ${on ? "is-in" : ""}`}
              style={{ transitionDelay: reduced ? "0ms" : `${i * step}ms` }}
            >
              {w}
            </span>
          </span>
          {i < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </Tag>

  );
}

/** Counts up when scrolled into view. Tabular figures come from `.cb-num`. */
export function CbCountUp({
  value,
  duration = 900,
  decimals = 0,
  prefix = "",
  suffix = "",
  className = "",
}: {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const { ref, inView } = useInView<HTMLSpanElement>();
  const [display, setDisplay] = useState(reduced ? value : 0);

  useEffect(() => {
    if (reduced || !inView) {
      setDisplay(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(value * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduced, value, duration]);

  return (
    <span ref={ref} className={`cb-num ${className}`}>
      {prefix}
      {display.toLocaleString(undefined, {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}

/** Sticky section header: shrinks and gains a hairline once it sticks. */
export function CbStickyHeader({
  children,
  className = "",
  top = 0,
}: {
  children: ReactNode;
  className?: string;
  top?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const sentinel = useRef<HTMLDivElement | null>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting), {
      rootMargin: `-${top + 1}px 0px 0px 0px`,
      threshold: 1,
    });
    io.observe(el);
    return () => io.disconnect();
  }, [top]);

  return (
    <>
      <div ref={sentinel} aria-hidden style={{ height: 1 }} />
      <div
        ref={ref}
        className={`cb-sticky-header ${stuck ? "is-stuck" : ""} ${className}`}
        style={{ top }}
      >
        {children}
      </div>
    </>
  );
}

/** Light parallax for hero / cover imagery. Max 20px of travel. */
export function useParallax<T extends HTMLElement>(max = 20) {
  const ref = useRef<T | null>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced || typeof IntersectionObserver === "undefined") return;
    let raf = 0;
    let active = false;

    const update = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const progress = (rect.top + rect.height / 2 - vh / 2) / vh; // -1..1
      const clamped = Math.max(-1, Math.min(1, progress));
      el.style.transform = `translate3d(0, ${(clamped * max).toFixed(2)}px, 0)`;
    };
    const onFrame = () => {
      if (!active) return;
      if (!raf) raf = requestAnimationFrame(update);
    };

    const io = new IntersectionObserver(([e]) => {
      active = e.isIntersecting;
      if (active) onFrame();
    });
    io.observe(el);
    window.addEventListener("scroll", onFrame, { passive: true });
    window.addEventListener("resize", onFrame);
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onFrame);
      window.removeEventListener("resize", onFrame);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [max, reduced]);

  return ref;
}

/** Page transition wrapper: fade + 8px slide, never a hard cut. */
export function CbPageTransition({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return <div className={`cb-page ${ready ? "is-in" : ""} ${className}`}>{children}</div>;
}

/** Cursor tilt for cards. Pointer devices only, max 6deg. */
export function useTilt<T extends HTMLElement>(maxDeg = 6) {
  const ref = useRef<T | null>(null);
  const pointer = useIsPointerDevice();
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || !pointer || reduced) return;

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.transition = "transform .08s linear";
      el.style.transform = `perspective(900px) rotateX(${(-py * maxDeg).toFixed(
        2,
      )}deg) rotateY(${(px * maxDeg).toFixed(2)}deg) translateZ(0)`;
    };
    const onLeave = () => {
      el.style.transition = "transform .5s cubic-bezier(.16,1,.3,1)";
      el.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg)";
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [maxDeg, pointer, reduced]);

  return ref;
}

/** Light haptic where supported. */
export function cbHaptic(ms = 8) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* unsupported */
  }
}
