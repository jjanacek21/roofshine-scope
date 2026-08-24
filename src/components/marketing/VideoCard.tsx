import { useState } from "react";

export type VideoItem = {
  /** Poster image shown before playback — a screenshot for now. */
  thumbnail: string;
  /** Video file URL. Leave undefined until the real footage is uploaded. */
  src?: string;
  title: string;
  duration?: string;
  caption?: string;
};

const CSS = `
.vc{border:1px solid var(--cb-hairline);border-radius:18px;overflow:hidden;background:var(--cb-surface);
  box-shadow:0 14px 34px rgba(9,12,16,.08);transition:transform .2s var(--cb-ease),box-shadow .2s var(--cb-ease)}
.vc:hover{transform:translateY(-3px);box-shadow:0 22px 46px rgba(9,12,16,.16)}
.vc__media{position:relative;width:100%;aspect-ratio:16/10;background:#0f1216;border:0;padding:0;
  display:block;cursor:pointer;overflow:hidden}
.vc__media img,.vc__media video{width:100%;height:100%;object-fit:cover;display:block}
.vc__play{position:absolute;inset:0;display:grid;place-items:center;background:rgba(8,10,13,.28)}
.vc__play i{width:62px;height:62px;border-radius:999px;background:var(--cb-accent);display:grid;
  place-items:center;box-shadow:0 14px 30px rgba(21,128,61,.45);transition:transform .18s var(--cb-ease)}
.vc__media:hover .vc__play i{transform:scale(1.07)}
.vc__play svg{margin-left:3px}
.vc__soon{position:absolute;left:12px;bottom:12px;background:rgba(8,10,13,.72);color:#eef2f7;
  font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;padding:5px 10px;border-radius:999px}
.vc__dur{position:absolute;right:12px;bottom:12px;background:rgba(8,10,13,.72);color:#eef2f7;
  font-family:var(--cb-mono,ui-monospace,monospace);font-size:12px;padding:4px 9px;border-radius:8px}
.vc__b{padding:14px 16px 16px}
.vc__t{font-size:15px;font-weight:800;letter-spacing:-0.01em}
.vc__c{font-size:13.5px;color:var(--cb-text-muted);margin-top:5px;line-height:1.5}
`;

/** Thumbnail and video source are deliberately separate props so real footage can be dropped in later. */
export default function VideoCard({ thumbnail, src, title, duration, caption }: VideoItem) {
  const [playing, setPlaying] = useState(false);

  return (
    <div className="vc">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {playing && src ? (
        <div className="vc__media" style={{ cursor: "default" }}>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video src={src} poster={thumbnail} controls autoPlay playsInline />
        </div>
      ) : (
        <button
          type="button"
          className="vc__media"
          onClick={() => src && setPlaying(true)}
          aria-label={src ? `Play ${title}` : `${title} — video coming soon`}
        >
          <img src={thumbnail} alt={title} loading="lazy" />
          <span className="vc__play">
            <i>
              <svg width="20" height="22" viewBox="0 0 20 22" fill="#fff" aria-hidden>
                <path d="M0 1.6c0-1.3 1.4-2 2.5-1.3l15.6 9.4a1.5 1.5 0 0 1 0 2.6L2.5 21.7C1.4 22.4 0 21.7 0 20.4V1.6Z" />
              </svg>
            </i>
          </span>
          {!src && <span className="vc__soon">Clip coming soon</span>}
          {duration && <span className="vc__dur">{duration}</span>}
        </button>
      )}
      <div className="vc__b">
        <div className="vc__t">{title}</div>
        {caption && <div className="vc__c">{caption}</div>}
      </div>
    </div>
  );
}
