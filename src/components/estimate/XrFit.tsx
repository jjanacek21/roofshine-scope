import { useEffect, useRef, useState, type ReactNode, forwardRef } from "react";

const PAGE_W = 816;

/**
 * Shows a fixed-width (letter) document scaled down to fit narrow screens.
 * The inner node stays unscaled at 816px so a PDF captured from it matches
 * the desktop download exactly.
 */
export const XrFit = forwardRef<HTMLDivElement, { children: ReactNode }>(function XrFit(
  { children },
  innerRef,
) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    const el = outer.current;
    if (!el) return;
    const measure = () => {
      const w = el.clientWidth;
      const s = w > 0 ? Math.min(1, w / PAGE_W) : 1;
      setScale(s);
      const h = inner.current?.scrollHeight ?? 0;
      setHeight(h * s);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (inner.current) ro.observe(inner.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={outer} style={{ width: "100%", overflow: "hidden" }}>
      <div style={{ height, width: PAGE_W * scale }}>
        <div style={{ width: PAGE_W, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          {/* Untransformed node — the PDF is captured from here at full size. */}
          <div
            ref={(node) => {
              inner.current = node;
              if (typeof innerRef === "function") innerRef(node);
              else if (innerRef) (innerRef as { current: HTMLDivElement | null }).current = node;
            }}
            style={{ width: PAGE_W }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
});
