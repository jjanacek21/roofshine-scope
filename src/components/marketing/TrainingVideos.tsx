import { useEffect, useState } from "react";
import {
  formatDuration,
  videoSourceOf,
  type SiteVideoItem,
  type VideoSource,
} from "@/lib/site-content.types";

const CSS = `
.tv-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:22px}
@media(max-width:1000px){.tv-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:640px){.tv-grid{grid-template-columns:1fr}}
.tv{border:1px solid var(--cb-hairline);border-radius:18px;overflow:hidden;background:var(--cb-surface);
  box-shadow:0 14px 34px rgba(9,12,16,.08);transition:transform .2s var(--cb-ease,ease),box-shadow .2s var(--cb-ease,ease)}
.tv:hover{transform:translateY(-3px);box-shadow:0 22px 46px rgba(9,12,16,.16)}
.tv__media{position:relative;width:100%;aspect-ratio:16/10;background:#0f1216;border:0;padding:0;display:block;
  overflow:hidden;cursor:pointer}
.tv__media--soon{cursor:default}
.tv__media img{width:100%;height:100%;object-fit:cover;display:block}
.tv__ph{width:100%;height:100%;display:grid;place-items:center;color:#4a5563;font-size:12px;
  font-family:var(--cb-mono,ui-monospace,monospace);letter-spacing:.1em;text-transform:uppercase}
.tv__play{position:absolute;inset:0;display:grid;place-items:center;background:rgba(8,10,13,.28)}
.tv__play i{width:62px;height:62px;border-radius:999px;background:var(--cb-accent);display:grid;place-items:center;
  box-shadow:0 14px 30px rgba(21,128,61,.45);transition:transform .18s var(--cb-ease,ease)}
.tv__media:hover .tv__play i{transform:scale(1.07)}
.tv__soon{position:absolute;left:12px;bottom:12px;background:rgba(8,10,13,.72);color:#eef2f7;font-size:11px;
  font-weight:700;letter-spacing:.07em;text-transform:uppercase;padding:5px 10px;border-radius:999px}
.tv__dur{position:absolute;right:12px;bottom:12px;background:rgba(8,10,13,.72);color:#eef2f7;
  font-family:var(--cb-mono,ui-monospace,monospace);font-size:12px;padding:4px 9px;border-radius:8px}
.tv__b{padding:14px 16px 16px}
.tv__t{font-size:15px;font-weight:800;letter-spacing:-0.01em;color:var(--cb-text)}
.tv__c{font-size:13.5px;color:var(--cb-text-muted);margin-top:5px;line-height:1.5}
.tv-lb{position:fixed;inset:0;z-index:150;display:grid;place-items:center;padding:24px;
  background:rgba(8,10,13,.82);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.tv-lb__box{width:min(96vw,1040px)}
.tv-lb__frame{position:relative;width:100%;aspect-ratio:16/9;border-radius:14px;overflow:hidden;background:#000;
  box-shadow:0 40px 90px rgba(0,0,0,.55)}
.tv-lb__frame video,.tv-lb__frame iframe{width:100%;height:100%;display:block;border:0}
.tv-lb__t{color:#eef2f7;font-size:15px;font-weight:700;text-align:center;margin-top:12px}
.tv-lb__x{position:absolute;top:16px;right:18px;width:42px;height:42px;border-radius:999px;
  border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.1);color:#fff;font-size:20px;line-height:1;cursor:pointer}
@media (prefers-reduced-motion: reduce){.tv,.tv__play i{transition:none}}
`;

function PlayIcon() {
  return (
    <span className="tv__play">
      <i>
        <svg width="20" height="22" viewBox="0 0 20 22" fill="#fff" aria-hidden>
          <path d="M0 1.6c0-1.3 1.4-2 2.5-1.3l15.6 9.4a1.5 1.5 0 0 1 0 2.6L2.5 21.7C1.4 22.4 0 21.7 0 20.4V1.6Z" />
        </svg>
      </i>
    </span>
  );
}

function VideoLightbox({
  source,
  title,
  poster,
  onClose,
}: {
  source: VideoSource;
  title: string;
  poster: string | null;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (source.kind === "none") return null;

  return (
    <div className="tv-lb" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <button type="button" className="tv-lb__x" onClick={onClose} aria-label="Close">
        ×
      </button>
      <div className="tv-lb__box" onClick={(e) => e.stopPropagation()}>
        <div className="tv-lb__frame">
          {source.kind === "file" ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video src={source.src} poster={poster ?? undefined} controls autoPlay playsInline />
          ) : (
            <iframe
              src={source.src}
              title={title}
              allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
            />
          )}
        </div>
        <div className="tv-lb__t">{title}</div>
      </div>
    </div>
  );
}

/**
 * Training video grid. Thumbnail and source stay independent: a card with a
 * thumbnail but no video_url renders "Coming soon" and is not clickable.
 */
export default function TrainingVideos({ videos }: { videos: SiteVideoItem[] }) {
  const [open, setOpen] = useState<SiteVideoItem | null>(null);
  if (!videos.length) return null;
  const openSource = open ? videoSourceOf(open.video_url) : null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="tv-grid">
        {videos.map((v) => {
          const source = videoSourceOf(v.video_url);
          const playable = source.kind !== "none";
          const dur = formatDuration(v.duration_seconds);
          const media = (
            <>
              {v.thumbnail_url ? (
                <img src={v.thumbnail_url} alt={v.title} loading="lazy" />
              ) : (
                <div className="tv__ph">No thumbnail</div>
              )}
              {playable ? <PlayIcon /> : <span className="tv__soon">Coming soon</span>}
              {dur && <span className="tv__dur">{dur}</span>}
            </>
          );
          return (
            <div className="tv" key={v.id}>
              {playable ? (
                <button
                  type="button"
                  className="tv__media"
                  onClick={() => setOpen(v)}
                  aria-label={`Play ${v.title}`}
                >
                  {media}
                </button>
              ) : (
                <div className="tv__media tv__media--soon" aria-label={`${v.title} — coming soon`}>
                  {media}
                </div>
              )}
              <div className="tv__b">
                <div className="tv__t">{v.title}</div>
                {v.description && <div className="tv__c">{v.description}</div>}
              </div>
            </div>
          );
        })}
      </div>
      {open && openSource && (
        <VideoLightbox
          source={openSource}
          title={open.title}
          poster={open.thumbnail_url}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}
