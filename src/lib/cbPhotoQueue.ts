import { useEffect, useState } from "react";
import { get, set, del, keys } from "idb-keyval";
import { supabase } from "@/integrations/supabase/client";
import { cbCompressPhoto, CB_PHOTO_BUCKET, type CbPhotoMeta } from "./cbPhotos";

/**
 * Offline-first photo upload queue.
 *
 * A rep shoots 40–80 photos per job on bad cell service, so nothing here ever
 * blocks the UI: captures land in IndexedDB immediately and drain in the
 * background, resuming automatically when the connection comes back.
 */

export interface CbQueuedPhoto {
  id: string;
  jobId: string;
  workspaceId: string;
  meta: CbPhotoMeta;
  blob: Blob;
  createdAt: number;
  attempts: number;
}

export interface CbQueueState {
  pending: number;
  uploading: string | null;
  progress: Record<string, number>;
  online: boolean;
}

const PREFIX = "cb_photo_q:";
let state: CbQueueState = { pending: 0, uploading: null, progress: {}, online: true };
const listeners = new Set<(s: CbQueueState) => void>();
let draining = false;

function emit(patch: Partial<CbQueueState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l(state));
}

async function queuedKeys(): Promise<string[]> {
  const all = await keys();
  return all.filter((k): k is string => typeof k === "string" && k.startsWith(PREFIX)).sort();
}

async function refreshCount() {
  emit({ pending: (await queuedKeys()).length });
}

export async function cbEnqueuePhoto(
  input: Omit<CbQueuedPhoto, "id" | "createdAt" | "attempts">,
): Promise<string> {
  const id = crypto.randomUUID();
  const item: CbQueuedPhoto = { ...input, id, createdAt: Date.now(), attempts: 0 };
  await set(PREFIX + id, item);
  await refreshCount();
  void cbDrainQueue();
  return id;
}

async function uploadOne(item: CbQueuedPhoto) {
  emit({ uploading: item.id, progress: { ...state.progress, [item.id]: 5 } });
  const { full, thumb } = await cbCompressPhoto(item.blob);
  emit({ progress: { ...state.progress, [item.id]: 35 } });

  const base = `${item.workspaceId}/${item.jobId}`;
  const name = item.meta.filename ?? `${item.id}.jpg`;
  const storage_path = `${base}/${name}`;
  const thumb_path = `${base}/thumbs/${name}`;

  const up = await supabase.storage
    .from(CB_PHOTO_BUCKET)
    .upload(storage_path, full, { upsert: true, contentType: "image/jpeg" });
  if (up.error) throw up.error;
  emit({ progress: { ...state.progress, [item.id]: 70 } });

  await supabase.storage
    .from(CB_PHOTO_BUCKET)
    .upload(thumb_path, thumb, { upsert: true, contentType: "image/jpeg" });

  const { error } = await supabase.from("cb_photos").insert({
    job_id: item.jobId,
    workspace_id: item.workspaceId,
    storage_path,
    thumb_path,
    category: item.meta.category,
    elevation: item.meta.elevation ?? null,
    shot_type: item.meta.shot_type ?? null,
    item_key: item.meta.item_key ?? null,
    caption: item.meta.caption ?? null,
    lat: item.meta.lat ?? null,
    lng: item.meta.lng ?? null,
    taken_at: item.meta.taken_at ?? new Date(item.createdAt).toISOString(),
  });
  if (error) throw error;

  if (item.meta.category === "cover") {
    await supabase.from("cb_jobs").update({ cover_photo_path: storage_path }).eq("id", item.jobId);
  }
  emit({ progress: { ...state.progress, [item.id]: 100 } });
}

export async function cbDrainQueue(): Promise<void> {
  if (draining) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  draining = true;
  try {
    for (;;) {
      const ks = await queuedKeys();
      if (ks.length === 0) break;
      const key = ks[0]!;
      const item = await get<CbQueuedPhoto>(key);
      if (!item) {
        await del(key);
        continue;
      }
      try {
        await uploadOne(item);
        await del(key);
      } catch {
        const attempts = item.attempts + 1;
        if (attempts >= 6) {
          await del(key);
        } else {
          await set(key, { ...item, attempts });
        }
        break; // back off; a later online event or tick retries
      } finally {
        await refreshCount();
      }
    }
  } finally {
    draining = false;
    emit({ uploading: null });
  }
}

export function useCbUploadQueue(): CbQueueState {
  const [snapshot, setSnapshot] = useState<CbQueueState>(state);
  useEffect(() => {
    listeners.add(setSnapshot);
    void refreshCount();
    void cbDrainQueue();
    const online = () => {
      emit({ online: true });
      void cbDrainQueue();
    };
    const offline = () => emit({ online: false });
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    emit({ online: navigator.onLine });
    const tick = window.setInterval(() => void cbDrainQueue(), 15000);
    return () => {
      listeners.delete(setSnapshot);
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      window.clearInterval(tick);
    };
  }, []);
  return snapshot;
}
