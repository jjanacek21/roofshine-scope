/**
 * Signature pad — finger and stylus, scaled by devicePixelRatio so the stroke
 * is crisp on retina. Pointer events cover mouse, touch and pen with one path.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { CbButton } from "@/components/cb/primitives";
import { cbHaptic } from "@/components/cb/motion";

export function CbSignaturePad({
  onChange,
  height = 190,
  label = "Sign with your finger or a stylus",
}: {
  onChange: (dataUrl: string | null) => void;
  height?: number;
  label?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const dirty = useRef(false);
  const [hasInk, setHasInk] = useState(false);
  const [done, setDone] = useState(false);

  const setup = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 2.4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#14181c";
  }, []);

  useEffect(() => {
    setup();
    const onResize = () => {
      /* Resizing clears the bitmap; ask for the signature again rather than
         silently keeping a stretched one. */
      setup();
      if (dirty.current) {
        dirty.current = false;
        setHasInk(false);
        setDone(false);
        onChange(null);
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [setup, onChange]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (done) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = point(e);
    dirty.current = true;
    setHasInk(true);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || done) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    const p = point(e);
    if (!ctx || !last.current) return;
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };

  const end = () => {
    drawing.current = false;
    last.current = null;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    dirty.current = false;
    setHasInk(false);
    setDone(false);
    onChange(null);
  };

  const finish = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasInk) return;
    cbHaptic(14);
    setDone(true);
    onChange(canvas.toDataURL("image/png"));
  };

  return (
    <div className="cb-sigpad">
      <div className="cb-sigpad-frame" style={{ height }}>
        <canvas
          ref={canvasRef}
          className="cb-sigpad-canvas"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
          onPointerLeave={end}
          aria-label={label}
          role="img"
        />
        <span className="cb-sigpad-rule" aria-hidden />
        {!hasInk ? <span className="cb-sigpad-hint">{label}</span> : null}
        {done ? <span className="cb-sigpad-done">Signature captured</span> : null}
      </div>
      <div className="cb-sigpad-actions">
        <CbButton type="button" variant="ghost" size="md" onClick={clear}>
          Clear
        </CbButton>
        <CbButton type="button" variant="secondary" size="md" onClick={finish} disabled={!hasInk || done}>
          {done ? "Done" : "Done"}
        </CbButton>
      </div>
    </div>
  );
}
