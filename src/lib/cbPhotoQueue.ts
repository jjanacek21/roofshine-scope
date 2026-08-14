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
  status?: "queued" | "failed";
}

export interface CbQueueState {
  pending: number;
  pendingByJob: Record<string, number>;
  failed: number;
  failedByJob: Record<string, number>;
  uploading: string | null;
  progress: Record<string, number>;
  online: boolean;
}

const PREFIX = "cb_photo_q:";
let state: CbQueueState = {
  pending: 0,
  pendingByJob: {},
  failed: 0,
  failedByJob: {},
  uploading: null,
  progress: {},
  online: true,
};
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
  const items = await Promise.all((await queuedKeys()).map((key) => get<CbQueuedPhoto>(key)));
  const pendingByJob: Record<string, number> = {};
  const failedByJob: Record<string, number> = {};
  let pending = 0;
  let failed = 0;
  for (const item of items) {
    if (!item) continue;
    if (item.status === "failed") {
      failed += 1;
      failedByJob[item.jobId] = (failedByJob[item.jobId] ?? 0) + 1;
    } else {
      pending += 1;
      pendingByJob[item.jobId] = (pendingByJob[item.jobId] ?? 0) + 1;
    }
  }
  emit({ pending, pendingByJob, failed, failedByJob });
}

export async function cbEnqueuePhoto(
  input: Omit<CbQueuedPhoto, "id" | "createdAt" | "attempts">,
): Promise<string> {
  const id = crypto.randomUUID();
  const item: CbQueuedPhoto = { ...input, id, createdAt: Date.now(), attempts: 0, status: "queued" };
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
    const { error: coverError } = await supabase
      .from("cb_jobs")
      .update({ cover_photo_path: storage_path })
      .eq("id", item.jobId);
    if (coverError) throw coverError;
  }
  emit({ progress: { ...state.progress, [item.id]: 100 } });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("cb-photo-uploaded", { detail: { jobId: item.jobId } }));
  }
}

export async function cbDrainQueue(): Promise<void> {
  if (draining) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  draining = true;
  try {
    for (;;) {
      const ks = await queuedKeys();
      if (ks.length === 0) break;
      let key: string | null = null;
      let item: CbQueuedPhoto | undefined;
      for (const candidate of ks) {
        const queued = await get<CbQueuedPhoto>(candidate);
        if (queued && queued.status !== "failed") {
          key = candidate;
          item = queued;
          break;
        }
      }
      if (!key || !item) break;
      try {
        await uploadOne(item);
        await del(key);
      } catch (error) {
        const attempts = item.attempts + 1;
        if (attempts >= 6) {
          await set(key, { ...item, attempts, status: "failed" });
          console.error("[Claim Buddy] Photo upload needs retry:", error);
        } else {
          await set(key, { ...item, attempts, status: "queued" });
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

export async function cbRetryFailedPhotos(jobId: string): Promise<void> {
  for (const key of await queuedKeys()) {
    const item = await get<CbQueuedPhoto>(key);
    if (item?.jobId === jobId && item.status === "failed") {
      await set(key, { ...item, attempts: 0, status: "queued" });
    }
  }
  await refreshCount();
  void cbDrainQueue();
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
