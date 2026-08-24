import { useEffect, useRef, useState } from "react";

export type StepFrame = { src: string; title: string; caption: string };

const CSS = `
@keyframes sp-fill{from{width:0%}to{width:100%}}
@keyframes sp-scan{0%{transform:translateY(-120px)}100%{transform:translateY(100%)}}
.sp-stack{position:relative;width:100%;overflow:hidden;background:#0f1216}
.sp-stack img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;
  transition:opacity .5s var(--cb-ease,cubic-bezier(.22,1,.36,1))}
.sp-stack img.is-active{opacity:1}
.sp-scanband{position:absolute;left:0;right:0;top:0;height:120px;pointer-events:none;
  background:linear-gradient(180deg,rgba(21,128,61,0),rgba(34,197,94,.42),rgba(21,128,61,0));
  animation:sp-scan 1.5s linear infinite}
.sp-segs{display:flex;gap:6px;margin-top:12px}
.sp-seg{flex:1;height:4px;border-radius:3px;background:var(--cb-hairline);overflow:hidden;
  border:0;padding:0;cursor:pointer}
.sp-seg > i{display:block;height:100%;width:0;background:var(--cb-accent);border-radius:3px}
.sp-seg > i.is-full{width:100%}
.sp-seg > i.is-running{animation:sp-fill linear forwards}
`;

export default function StepPlayer({
  frames,
  aspect,
  intervalMs = 2100,
  onFrameClick,
}: {
  frames: StepFrame[];
  aspect: "phone" | "paper";
  intervalMs?: number;
  onFrameClick?: (index: number, frame: StepFrame) => void;
}) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [reduced, setReduced] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      setReduced(mq.matches);
      if (mq.matches) {
        setPlaying(false);
        setIndex(0);
      }
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    setIndex(0);
  }, [frames]);

  useEffect(() => {
    if (!playing || reduced || frames.length < 2) return;
    timer.current = window.setInterval(
      () => setIndex((i) => (i + 1) % frames.length),
      intervalMs,
    );
    return () => {
      if (timer.current) window.clearInterval(timer.current);
      timer.current = null;
    };
  }, [playing, reduced, intervalMs, frames]);

  const ratio = aspect === "phone" ? 700 / 830 : 850 / 1100;
  const radius = aspect === "phone" ? 23 : 10;
  const active = frames[index];

  return (
    <div style={{ width: "100%" }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div
        className="sp-stack"
        style={{
          aspectRatio: String(ratio),
          borderRadius: radius,
          border: aspect === "paper" ? "1px solid var(--cb-hairline)" : undefined,
          cursor: aspect === "paper" ? "zoom-in" : undefined,
        }}
        onClick={() => onFrameClick?.(index, active)}
      >
        {frames.map((f, i) => (
          <img
            key={f.src}
            src={f.src}
            alt={f.title}
            loading={i === 0 ? undefined : "lazy"}
            className={i === index ? "is-active" : ""}
          />
        ))}
        {!reduced && active?.src.includes("m2_measuring") && <div className="sp-scanband" />}
      </div>

      <div className="sp-segs">
        {frames.map((f, i) => (
          <button
            key={f.src}
            type="button"
            className="sp-seg"
            aria-label={`Go to ${f.title}`}
            onClick={() => {
              setPlaying(false);
              setIndex(i);
            }}
          >
            <i
              className={i < index ? "is-full" : i === index && playing && !reduced ? "is-running" : ""}
              style={
                i === index && playing && !reduced
                  ? { animationDuration: `${intervalMs}ms` }
                  : i === index
                    ? { width: "100%" }
                    : undefined
              }
            />
          </button>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: "1rem" }}>{active?.title}</div>
          <div style={{ fontSize: ".84rem", color: "var(--cb-text-muted)", marginTop: 2 }}>
            {active?.caption}
          </div>
        </div>
        <button
          type="button"
          aria-label={playing ? "Pause" : "Play"}
          onClick={() => setPlaying((p) => !p)}
          style={{
            width: 40,
            height: 40,
            flexShrink: 0,
            borderRadius: 12,
            border: "1px solid var(--cb-hairline)",
            background: "var(--cb-surface)",
            color: "var(--cb-text)",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          {playing ? "❚❚" : "▶"}
        </button>
      </div>
    </div>
  );
}
