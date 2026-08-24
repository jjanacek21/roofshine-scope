/**
 * Luma-keyed logo player.
 *
 * The brand animation ships as an MP4 with the silver logo sitting on a solid
 * black plate. `mix-blend-mode: screen` only hides that plate over dark
 * surfaces, so the black box reappears in light theme and over the plot grid.
 *
 * This draws every frame to a canvas and turns near-black pixels into real
 * transparency, so only the silver mark, the lettering and the blue/green glow
 * survive — on any background, in any theme.
 */

/** Below this luma a pixel is plate; above it the pixel is fully opaque. */
const LO = 0.045;
const HI = 0.3;
/** Processing width — full 1168px frames cost more than the result shows. */
const MAX_W = 620;

export function mountLumaLogo(
  target: HTMLImageElement,
  /** Candidate sources, tried in order — the first that decodes wins. */
  sources: string[],
  onFail: () => void,
): () => void {
  const canvas = document.createElement("canvas");
  canvas.className = target.className;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", target.alt || "Claim Buddy");

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    onFail();
    return () => {};
  }

  const work = document.createElement("canvas");
  const wctx = work.getContext("2d", { willReadFrequently: true });
  if (!wctx) {
    onFail();
    return () => {};
  }

  const list = sources.filter(Boolean);
  if (!list.length) {
    onFail();
    return () => {};
  }
  let srcIdx = 0;

  const video = document.createElement("video");
  video.src = list[0];
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.autoplay = true;
  video.crossOrigin = "anonymous";
  video.preload = "auto";

  let raf = 0;
  let disposed = false;
  let started = false;

  function sizeTo() {
    const vw = video.videoWidth || 1168;
    const vh = video.videoHeight || 784;
    const scale = Math.min(1, MAX_W / vw);
    const w = Math.max(1, Math.round(vw * scale));
    const h = Math.max(1, Math.round(vh * scale));
    work.width = w;
    work.height = h;
    canvas.width = w;
    canvas.height = h;
  }

  function frame() {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    if (video.readyState < 2 || !work.width) return;

    wctx!.drawImage(video, 0, 0, work.width, work.height);
    const img = wctx!.getImageData(0, 0, work.width, work.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      // Perceptual luma, normalised. Black plate -> 0, silver/glow -> high.
      const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      let a = (luma - LO) / (HI - LO);
      a = a <= 0 ? 0 : a >= 1 ? 1 : a;
      d[i + 3] = Math.round(a * 255);
      if (a > 0 && a < 1) {
        // Un-darken the keyed edge so the glow doesn't fringe grey.
        const inv = 1 / a;
        d[i] = Math.min(255, r * inv);
        d[i + 1] = Math.min(255, g * inv);
        d[i + 2] = Math.min(255, b * inv);
      }
    }
    ctx!.putImageData(img, 0, 0);
  }

  const onReady = () => {
    if (started || disposed) return;
    started = true;
    sizeTo();
    target.replaceWith(canvas);
    raf = requestAnimationFrame(frame);
  };

  video.addEventListener("loadeddata", onReady);
  video.addEventListener("error", () => {
    if (started) return;
    srcIdx += 1;
    if (srcIdx < list.length) {
      video.src = list[srcIdx];
      video.load();
      void video.play().catch(() => {});
      return;
    }
    onFail();
  });
  void video.play().catch(() => {
    /* Autoplay blocked — the frame loop still paints the poster frame. */
  });

  return () => {
    disposed = true;
    cancelAnimationFrame(raf);
    video.pause();
    video.removeAttribute("src");
    video.load();
    if (canvas.isConnected) canvas.replaceWith(target);
  };
}
