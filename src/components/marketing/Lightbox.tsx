import { useEffect } from "react";

const CSS = `
.mkt-lb2{position:fixed;inset:0;z-index:140;display:grid;place-items:center;padding:24px;
  background:rgba(8,10,13,.78);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
  animation:cb-fade .18s ease both}
.mkt-lb2__box{display:flex;flex-direction:column;align-items:center;gap:12px;max-width:min(94vw,1000px)}
.mkt-lb2__box img{max-width:100%;max-height:86vh;border-radius:14px;background:#fff;
  box-shadow:0 40px 90px rgba(0,0,0,.5)}
.mkt-lb2__t{color:#eef2f7;font-size:15px;font-weight:600;text-align:center}
.mkt-lb2__x{position:absolute;top:16px;right:18px;width:42px;height:42px;border-radius:999px;
  border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.1);color:#fff;font-size:20px;
  line-height:1;cursor:pointer}
`;

export default function Lightbox({
  src,
  title,
  onClose,
}: {
  src: string;
  title?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="mkt-lb2" role="dialog" aria-modal="true" onClick={onClose}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <button type="button" className="mkt-lb2__x" onClick={onClose} aria-label="Close">
        ×
      </button>
      <div className="mkt-lb2__box" onClick={(e) => e.stopPropagation()}>
        <img src={src} alt={title ?? ""} />
        {title && <div className="mkt-lb2__t">{title}</div>}
      </div>
    </div>
  );
}
