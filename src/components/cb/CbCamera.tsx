import { useEffect, useRef, useState } from "react";
import { X, Camera, Trash2, Pencil } from "lucide-react";
import { CbButton, CbSheet } from "./primitives";
import { cbHaptic } from "./motion";
import { cbEnqueuePhoto } from "@/lib/cbPhotoQueue";
import type { CbPhotoMeta } from "@/lib/cbPhotos";

export interface CbCameraShot {
  id: string;
  blob: Blob;
  url: string;
  caption: string;
  lat: number | null;
  lng: number | null;
  takenAt: string;
}

/**
 * Burst-friendly capture surface.
 * The rep stays in the camera, shots pile into the strip along the bottom,
 * and long-pressing a thumbnail offers delete or re-caption.
 */
export function CbCamera({
  open,
  onClose,
  jobId,
  workspaceId,
  meta,
  title,
  instruction,
  captionContext,
  minShots = 1,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  jobId: string;
  workspaceId: string | null | undefined;
  meta: CbPhotoMeta;
  title: string;
  instruction: string;
  /** e.g. "Front elevation — gutter — close-up" */
  captionContext: string;
  minShots?: number;
  onSaved: (count: number) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const pressRef = useRef<number | null>(null);
  const coordsRef = useRef<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });

  const [shots, setShots] = useState<CbCameraShot[]>([]);
  const [camError, setCamError] = useState<string | null>(null);
  const [editing, setEditing] = useState<CbCameraShot | null>(null);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (!open) return;
    setShots([]);
    setCamError(null);
    navigator.geolocation?.getCurrentPosition(
      (p) => (coordsRef.current = { lat: p.coords.latitude, lng: p.coords.longitude }),
      () => undefined,
      { timeout: 5000, maximumAge: 60000 },
    );
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 2560 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
      } catch {
        setCamError("Camera unavailable — use the picker.");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open]);

  function addShot(blob: Blob) {
    cbHaptic(12);
    setFlash(true);
    window.setTimeout(() => setFlash(false), 140);
    setShots((s) => [
      ...s,
      {
        id: crypto.randomUUID(),
        blob,
        url: URL.createObjectURL(blob),
        caption: s.length === 0 ? captionContext : `${captionContext} (${s.length + 1})`,
        lat: coordsRef.current.lat,
        lng: coordsRef.current.lng,
        takenAt: new Date().toISOString(),
      },
    ]);
  }

  function capture() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext("2d")?.drawImage(v, 0, 0);
    canvas.toBlob((b) => b && addShot(b), "image/jpeg", 0.92);
  }

  function startPress(shot: CbCameraShot) {
    pressRef.current = window.setTimeout(() => {
      cbHaptic(18);
      setEditing(shot);
    }, 450);
  }
  function endPress() {
    if (pressRef.current) window.clearTimeout(pressRef.current);
    pressRef.current = null;
  }

  async function done() {
    if (!workspaceId) return;
    setSaving(true);
    for (const s of shots) {
      await cbEnqueuePhoto({
        jobId,
        workspaceId,
        blob: s.blob,
        meta: { ...meta, caption: s.caption, lat: s.lat, lng: s.lng, taken_at: s.takenAt },
      });
    }
    setSaving(false);
    onSaved(shots.length);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="cb-cam-root" role="dialog" aria-modal="true" aria-label={title}>
      <div className="cb-cam-head">
        <button type="button" className="cb-cam-x" onClick={onClose} aria-label="Close camera">
          <X size={20} />
        </button>
        <div>
          <p className="cb-cam-title">{title}</p>
          <p className="cb-cam-instruction">{instruction}</p>
        </div>
      </div>

      <div className="cb-cam-stage">
        <video ref={videoRef} playsInline muted className="cb-cam-video" />
        {flash ? <span className="cb-cam-flash" aria-hidden /> : null}
        {camError ? <p className="cb-cam-error">{camError}</p> : null}
      </div>

      {shots.length > 0 ? (
        <div className="cb-cam-strip" aria-label="Captured photos">
          {shots.map((s) => (
            <button
              key={s.id}
              type="button"
              className="cb-cam-thumb"
              onPointerDown={() => startPress(s)}
              onPointerUp={endPress}
              onPointerLeave={endPress}
              onContextMenu={(e) => {
                e.preventDefault();
                setEditing(s);
              }}
              aria-label={`${s.caption} — long-press for options`}
            >
              <img src={s.url} alt={s.caption} />
            </button>
          ))}
        </div>
      ) : null}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        hidden
        onChange={(e) => {
          Array.from(e.target.files ?? []).forEach((f) => addShot(f));
          e.target.value = "";
        }}
      />

      <div className="cb-cam-actions">
        <button
          type="button"
          className="cb-cam-shutter"
          onClick={capture}
          disabled={!!camError}
          aria-label="Take photo"
        >
          <Camera size={26} />
        </button>
        <div className="cb-cam-side">
          <CbButton size="md" variant="secondary" onClick={() => fileRef.current?.click()}>
            Library
          </CbButton>
          <CbButton
            size="md"
            loading={saving}
            loadingText="Saving…"
            disabled={shots.length < minShots}
            onClick={done}
          >
            {shots.length === 0
              ? `Need ${minShots}`
              : `Use ${shots.length} ${shots.length === 1 ? "photo" : "photos"}`}
          </CbButton>
        </div>
      </div>

      <CbSheet
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Photo"
        footer={
          <div className="grid w-full gap-2">
            <CbButton
              block
              variant="danger"
              onClick={() => {
                setShots((s) => s.filter((x) => x.id !== editing?.id));
                setEditing(null);
              }}
            >
              <Trash2 size={16} className="mr-2 inline" /> Delete photo
            </CbButton>
            <CbButton block variant="secondary" onClick={() => setEditing(null)}>
              Done
            </CbButton>
          </div>
        }
      >
        {editing ? (
          <div className="grid gap-3">
            <img src={editing.url} alt={editing.caption} className="cb-cam-editpreview" />
            <label className="cb-microlabel" htmlFor="cb-cam-caption">
              <Pencil size={12} className="mr-1 inline" /> Caption
            </label>
            <input
              id="cb-cam-caption"
              className="cb-input"
              value={editing.caption}
              onChange={(e) => {
                const caption = e.target.value;
                setEditing({ ...editing, caption });
                setShots((s) => s.map((x) => (x.id === editing.id ? { ...x, caption } : x)));
              }}
            />
          </div>
        ) : null}
      </CbSheet>
    </div>
  );
}
