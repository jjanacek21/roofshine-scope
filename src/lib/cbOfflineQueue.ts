import { useEffect, useState } from "react";
import { get, set, del, keys } from "idb-keyval";
import { supabase } from "@/integrations/supabase/client";

/**
 * Offline queue for cb_jobs / takeoff edits.
 * Writes are optimistic — a failed network call is stored locally and replayed
 * automatically, so the rep is never blocked in a basement.
 */

const PREFIX = "cb_edit_q:";

interface QueuedEdit {
  id: string;
  table: "cb_jobs" | "cb_takeoffs" | "cb_measurements";
  rowId: string;
  patch: Record<string, unknown>;
}

const listeners = new Set<(n: number) => void>();
let pending = 0;
let draining = false;

async function editKeys(): Promise<string[]> {
  const all = await keys();
  return all.filter((k): k is string => typeof k === "string" && k.startsWith(PREFIX)).sort();
}

async function refresh() {
  pending = (await editKeys()).length;
  listeners.forEach((l) => l(pending));
}

export async function cbDrainEdits(): Promise<void> {
  if (draining || (typeof navigator !== "undefined" && !navigator.onLine)) return;
  draining = true;
  try {
    for (const key of await editKeys()) {
      const item = await get<QueuedEdit>(key);
      if (!item) {
        await del(key);
        continue;
      }
      const q = supabase.from(item.table) as unknown as {
        update: (p: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<{ error: unknown }> };
      };
      const { error } = await q.update(item.patch).eq("id", item.rowId);
      if (error) break;
      await del(key);
    }
  } finally {
    draining = false;
    await refresh();
  }
}

/** Patch a row now, or queue it locally when the network is gone. */
export async function cbQueueUpdate(
  table: QueuedEdit["table"],
  rowId: string,
  patch: Record<string, unknown>,
): Promise<{ queued: boolean }> {
  if (typeof navigator !== "undefined" && navigator.onLine) {
    const q = supabase.from(table) as unknown as {
      update: (p: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<{ error: unknown }> };
    };
    const { error } = await q.update(patch).eq("id", rowId);
    if (!error) return { queued: false };
  }
  const id = crypto.randomUUID();
  await set(PREFIX + id, { id, table, rowId, patch } satisfies QueuedEdit);
  await refresh();
  return { queued: true };
}

export function useCbPendingEdits(): number {
  const [n, setN] = useState(pending);
  useEffect(() => {
    listeners.add(setN);
    void refresh();
    void cbDrainEdits();
    const online = () => void cbDrainEdits();
    window.addEventListener("online", online);
    const tick = window.setInterval(() => void cbDrainEdits(), 15000);
    return () => {
      listeners.delete(setN);
      window.removeEventListener("online", online);
      window.clearInterval(tick);
    };
  }, []);
  return n;
}
