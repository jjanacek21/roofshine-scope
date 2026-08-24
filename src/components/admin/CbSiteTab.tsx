import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Plus,
  Trash2,
  Upload,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  X,
  ArrowUp,
  ArrowDown,
  Check,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const BUCKET = "marketing";

const MEDIA_CATEGORIES = [
  "measurement",
  "takeoff",
  "photos",
  "report",
  "estimate",
  "presentation",
  "auth",
  "carrier",
  "other",
];

/* ------------------------------------------------------------------ */
/* shared helpers                                                      */
/* ------------------------------------------------------------------ */

function useSignedUrl(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    if (!path) {
      setUrl(null);
      return;
    }
    void supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 60 * 60)
      .then(({ data }) => {
        if (live) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      live = false;
    };
  }, [path]);
  return url;
}

function Thumb({ path, className }: { path: string | null; className?: string }) {
  const url = useSignedUrl(path);
  if (!url) {
    return <div className={`bg-muted ${className ?? "h-16 w-24 rounded-md"}`} />;
  }
  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      className={`object-cover ${className ?? "h-16 w-24 rounded-md"}`}
    />
  );
}

/** Downscale to max 900px long edge, return a jpeg File. */
async function downscale(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const max = 900;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.86));
  if (!blob) return file;
  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg" });
}

function slugName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9.]+/g, "-")
    .replace(/^-|-$/g, "");
}

/* ------------------------------------------------------------------ */
/* 1. CONTENT — cb_site_blocks                                         */
/* ------------------------------------------------------------------ */

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function FieldEditor({
  path,
  value,
  onChange,
}: {
  path: string;
  value: Json;
  onChange: (next: Json) => void;
}) {
  const label = path.split(".").slice(-1)[0].replace(/_/g, " ");

  if (typeof value === "string") {
    const long = value.length > 120;
    return (
      <div className="space-y-1">
        <label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</label>
        {long ? (
          <textarea
            className="min-h-[110px] w-full rounded-lg border border-border bg-background p-2 text-sm"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        ) : (
          <Input value={value} onChange={(e) => onChange(e.target.value)} />
        )}
      </div>
    );
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return (
      <div className="space-y-1">
        <label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</label>
        <Input
          value={String(value)}
          onChange={(e) =>
            onChange(typeof value === "number" ? Number(e.target.value) : e.target.value === "true")
          }
        />
      </div>
    );
  }

  if (isStringArray(value)) {
    return (
      <div className="space-y-1">
        <label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</label>
        <div className="flex flex-wrap gap-2 rounded-lg border border-border p-2">
          {value.map((chip, i) => (
            <span
              key={`${chip}-${i}`}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-xs"
            >
              {chip}
              <button
                type="button"
                aria-label="Remove"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <ChipAdder onAdd={(v) => onChange([...value, v])} />
        </div>
      </div>
    );
  }

  if (Array.isArray(value)) {
    return (
      <div className="space-y-2 rounded-lg border border-border p-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        {value.map((item, i) => (
          <div key={i} className="rounded-md border border-border/70 p-2">
            <FieldEditor
              path={`${path}.${i}`}
              value={item as Json}
              onChange={(next) => {
                const copy = [...value];
                copy[i] = next as never;
                onChange(copy as Json);
              }}
            />
          </div>
        ))}
      </div>
    );
  }

  if (value && typeof value === "object") {
    const obj = value as Record<string, Json>;
    return (
      <div className="space-y-3 rounded-lg border border-border p-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        {Object.keys(obj).map((k) => (
          <FieldEditor
            key={k}
            path={`${path}.${k}`}
            value={obj[k]}
            onChange={(next) => onChange({ ...obj, [k]: next })}
          />
        ))}
      </div>
    );
  }

  return null;
}

function ChipAdder({ onAdd }: { onAdd: (v: string) => void }) {
  const [v, setV] = useState("");
  return (
    <span className="inline-flex items-center gap-1">
      <Input
        value={v}
        placeholder="Add…"
        className="h-8 w-36"
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && v.trim()) {
            e.preventDefault();
            onAdd(v.trim());
            setV("");
          }
        }}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => {
          if (v.trim()) {
            onAdd(v.trim());
            setV("");
          }
        }}
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </span>
  );
}

type BlockRow = {
  id: string;
  key: string;
  label: string;
  content: Record<string, Json>;
  sort_order: number;
  is_published: boolean;
  updated_at: string;
};

function ContentTab() {
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: blocks = [], isLoading } = useQuery({
    queryKey: ["cb-site-blocks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cb_site_blocks")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as BlockRow[];
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading blocks…
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Sections of the public site. Editing here does not change the live page yet.
        </p>
        <a
          href="/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          Preview <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {blocks.map((b) => (
        <BlockRowCard
          key={b.id}
          block={b}
          open={openId === b.id}
          onToggle={() => setOpenId(openId === b.id ? null : b.id)}
          onSaved={() => void qc.invalidateQueries({ queryKey: ["cb-site-blocks"] })}
        />
      ))}
    </div>
  );
}

function BlockRowCard({
  block,
  open,
  onToggle,
  onSaved,
}: {
  block: BlockRow;
  open: boolean;
  onToggle: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Record<string, Json>>(block.content ?? {});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    setDraft(block.content ?? {});
  }, [block.content]);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("cb_site_blocks")
      .update({ content: draft as never })
      .eq("id", block.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSavedAt(Date.now());
    onSaved();
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 p-3 text-left"
      >
        <span className="font-medium">{block.label}</span>
        <Badge variant="secondary" className="font-mono text-[11px]">{block.key}</Badge>
        {!block.is_published ? <Badge variant="outline">Hidden</Badge> : null}
        <span className="ml-auto text-xs text-muted-foreground">
          Updated {new Date(block.updated_at).toLocaleString()}
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open ? (
        <div className="space-y-3 border-t border-border p-4">
          {Object.keys(draft).map((k) => (
            <FieldEditor
              key={k}
              path={k}
              value={draft[k]}
              onChange={(next) => setDraft({ ...draft, [k]: next })}
            />
          ))}

          <div className="flex items-center gap-3 pt-1">
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                const { error } = await supabase
                  .from("cb_site_blocks")
                  .update({ is_published: !block.is_published })
                  .eq("id", block.id);
                if (error) toast.error(error.message);
                else onSaved();
              }}
            >
              {block.is_published ? "Unpublish" : "Publish"}
            </Button>
            {savedAt ? (
              <span className="inline-flex items-center gap-1 text-sm text-primary">
                <Check className="h-4 w-4" /> Saved
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2. PHOTOS — cb_site_media                                           */
/* ------------------------------------------------------------------ */

type MediaRow = {
  id: string;
  media_key: string;
  storage_path: string;
  title: string;
  caption: string | null;
  category: string;
  sort_order: number;
  is_published: boolean;
};

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_EDGE = 900;

/** media_key = filename minus extension, lowercased. Stable across re-uploads. */
function mediaKeyFromFilename(name: string) {
  return (
    name
      .replace(/\.[^.]+$/, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9._-]/g, "-")
      .replace(/^-+|-+$/g, "") || "image"
  );
}

/** Downscale to 900px on the long edge and encode WebP (JPEG where WebP is unsupported). */
async function shrinkImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  let blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/webp", 0.85));
  let ext = "webp";
  let type = "image/webp";
  if (!blob || blob.type !== "image/webp") {
    blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.86));
    ext = "jpg";
    type = "image/jpeg";
  }
  if (!blob) return file;
  return new File([blob], `${mediaKeyFromFilename(file.name)}.${ext}`, { type });
}

type ManifestEntry = { title?: string; caption?: string; category?: string };
type Manifest = Record<string, ManifestEntry>;

/** Accepts { key: {...} } or { items: [{ media_key, ... }] }. */
function parseManifest(raw: unknown): Manifest {
  const out: Manifest = {};
  const take = (key: string, v: Record<string, unknown>) => {
    out[key.toLowerCase()] = {
      title: typeof v.title === "string" ? v.title : undefined,
      caption: typeof v.caption === "string" ? v.caption : undefined,
      category: typeof v.category === "string" ? v.category : undefined,
    };
  };
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (item && typeof item === "object") {
        const v = item as Record<string, unknown>;
        const k = typeof v.media_key === "string" ? v.media_key : typeof v.file === "string" ? mediaKeyFromFilename(v.file) : null;
        if (k) take(k, v);
      }
    }
    return out;
  }
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.items)) return parseManifest(obj.items);
    for (const [k, v] of Object.entries(obj)) {
      if (v && typeof v === "object") take(mediaKeyFromFilename(k), v as Record<string, unknown>);
    }
  }
  return out;
}

type QueueState = "queued" | "resizing" | "uploading" | "replaced" | "added" | "failed" | "skipped";
type QueueItem = {
  name: string;
  media_key: string;
  state: QueueState;
  detail?: string;
  path?: string;
};

const STATE_LABEL: Record<QueueState, string> = {
  queued: "Queued",
  resizing: "Resizing",
  uploading: "Uploading",
  replaced: "Replaced",
  added: "Added",
  failed: "Failed",
  skipped: "Skipped",
};

function PhotosTab() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [dragRow, setDragRow] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploadCategory, setUploadCategory] = useState("other");

  const { data: media = [], isLoading } = useQuery({
    queryKey: ["cb-site-media"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cb_site_media")
        .select("*")
        .order("category")
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as MediaRow[];
    },
  });

  const refresh = () => void qc.invalidateQueries({ queryKey: ["cb-site-media"] });

  function setItem(i: number, patchItem: Partial<QueueItem>) {
    setQueue((q) => q.map((it, idx) => (idx === i ? { ...it, ...patchItem } : it)));
  }

  async function ingest(fileList: File[]) {
    if (!fileList.length) return;
    setBusy(true);

    // Optional manifest.json dropped alongside the images.
    let manifest: Manifest = {};
    const manifestFile = fileList.find((f) => f.name.toLowerCase() === "manifest.json");
    if (manifestFile) {
      try {
        manifest = parseManifest(JSON.parse(await manifestFile.text()));
        toast.success(`Manifest read — ${Object.keys(manifest).length} entries`);
      } catch (e) {
        toast.error(`manifest.json: ${(e as Error).message}`);
      }
    }

    const images = fileList.filter((f) => f !== manifestFile);
    setQueue(
      images.map((f) => ({
        name: f.name,
        media_key: mediaKeyFromFilename(f.name),
        state: "queued" as QueueState,
      })),
    );

    // Fresh snapshot so replace-in-place is decided against current rows.
    const { data: existingRows } = await supabase.from("cb_site_media").select("*");
    const byKey = new Map<string, MediaRow>();
    for (const r of (existingRows ?? []) as unknown as MediaRow[]) byKey.set(r.media_key, r);
    const nextSort = new Map<string, number>();
    for (const r of (existingRows ?? []) as unknown as MediaRow[]) {
      nextSort.set(r.category, Math.max(nextSort.get(r.category) ?? 0, r.sort_order));
    }

    let added = 0;
    let replaced = 0;
    let failed = 0;

    for (let i = 0; i < images.length; i++) {
      const file = images[i];
      const key = mediaKeyFromFilename(file.name);

      if (!file.type.startsWith("image/")) {
        setItem(i, { state: "skipped", detail: "not an image" });
        continue;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        setItem(i, { state: "skipped", detail: "over 5 MB" });
        continue;
      }

      try {
        setItem(i, { state: "resizing" });
        const small = await shrinkImage(file);

        setItem(i, { state: "uploading" });
        const path = `media/${key}-${Date.now()}.${small.name.split(".").pop()}`;
        const up = await supabase.storage
          .from(BUCKET)
          .upload(path, small, { contentType: small.type, upsert: false });
        if (up.error) throw new Error(up.error.message);

        const meta = manifest[key] ?? {};
        const existing = byKey.get(key);

        if (existing) {
          // Same key, same row, new file.
          const { error } = await supabase
            .from("cb_site_media")
            .update({
              storage_path: path,
              ...(meta.title ? { title: meta.title } : {}),
              ...(meta.caption !== undefined ? { caption: meta.caption } : {}),
              ...(meta.category ? { category: meta.category } : {}),
            } as never)
            .eq("id", existing.id);
          if (error) throw new Error(error.message);
          if (existing.storage_path && existing.storage_path !== path) {
            await supabase.storage.from(BUCKET).remove([existing.storage_path]);
          }
          byKey.set(key, { ...existing, storage_path: path });
          replaced += 1;
          setItem(i, { state: "replaced", path });
        } else {
          const category = meta.category ?? uploadCategory;
          const sort = (nextSort.get(category) ?? 0) + 1;
          nextSort.set(category, sort);
          const { data: inserted, error } = await supabase
            .from("cb_site_media")
            .insert({
              media_key: key,
              storage_path: path,
              title: meta.title ?? file.name.replace(/\.[^.]+$/, ""),
              caption: meta.caption ?? null,
              category,
              sort_order: sort,
            } as never)
            .select("*")
            .single();
          if (error) throw new Error(error.message);
          byKey.set(key, inserted as unknown as MediaRow);
          added += 1;
          setItem(i, { state: "added", path });
        }
      } catch (e) {
        failed += 1;
        setItem(i, { state: "failed", detail: (e as Error).message });
      }
    }

    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
    toast[failed ? "warning" : "success"](
      `${added} added · ${replaced} replaced${failed ? ` · ${failed} failed` : ""}`,
    );
    refresh();
  }

  async function replaceOne(row: MediaRow, file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Not an image");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error("Over 5 MB");
      return;
    }
    setBusy(true);
    try {
      const small = await shrinkImage(file);
      const path = `media/${row.media_key}-${Date.now()}.${small.name.split(".").pop()}`;
      const up = await supabase.storage
        .from(BUCKET)
        .upload(path, small, { contentType: small.type, upsert: false });
      if (up.error) throw new Error(up.error.message);
      const { error } = await supabase
        .from("cb_site_media")
        .update({ storage_path: path } as never)
        .eq("id", row.id);
      if (error) throw new Error(error.message);
      if (row.storage_path && row.storage_path !== path) {
        await supabase.storage.from(BUCKET).remove([row.storage_path]);
      }
      toast.success(`Replaced ${row.media_key}`);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, values: Record<string, unknown>) {
    const { error } = await supabase.from("cb_site_media").update(values as never).eq("id", id);
    if (error) toast.error(error.message);
    else refresh();
  }

  async function remove(row: MediaRow) {
    if (!window.confirm(`Delete "${row.title}"? The file is removed from storage too.`)) return;
    const del = await supabase.storage.from(BUCKET).remove([row.storage_path]);
    if (del.error) {
      toast.error(del.error.message);
      return;
    }
    const { error } = await supabase.from("cb_site_media").delete().eq("id", row.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Deleted");
      refresh();
    }
  }

  /** Drag one card onto another inside the same category to reorder. */
  async function dropOn(target: MediaRow) {
    const sourceId = dragRow;
    setDragRow(null);
    if (!sourceId || sourceId === target.id) return;
    const group = media
      .filter((m) => m.category === target.category)
      .sort((a, b) => a.sort_order - b.sort_order);
    const from = group.findIndex((m) => m.id === sourceId);
    const to = group.findIndex((m) => m.id === target.id);
    if (from < 0 || to < 0) return;
    const reordered = [...group];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    for (let i = 0; i < reordered.length; i++) {
      if (reordered[i].sort_order !== i + 1) {
        await supabase
          .from("cb_site_media")
          .update({ sort_order: i + 1 } as never)
          .eq("id", reordered[i].id);
      }
    }
    refresh();
  }

  const grouped = useMemo(() => {
    const map = new Map<string, MediaRow[]>();
    for (const m of media) {
      const list = map.get(m.category) ?? [];
      list.push(m);
      map.set(m.category, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.sort_order - b.sort_order);
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [media]);

  return (
    <div className="space-y-5">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void ingest(Array.from(e.dataTransfer.files ?? []));
        }}
        className={`rounded-xl border-2 border-dashed p-5 transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-border bg-card"
        }`}
      >
        <div className="flex flex-wrap items-center gap-3">
          <Upload className="h-5 w-5 text-muted-foreground" />
          <div className="min-w-[220px] flex-1">
            <p className="text-sm font-medium">Drop images here — as many as you like</p>
            <p className="text-xs text-muted-foreground">
              Images only, max 5 MB each. Resized to 900px on the long edge and converted to WebP
              before upload. The filename becomes the media key, so re-uploading the same filename
              replaces that image in place. Drop a manifest.json alongside to set titles, captions
              and categories.
            </p>
          </div>
          <Select value={uploadCategory} onValueChange={setUploadCategory}>
            <SelectTrigger className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MEDIA_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c} className="capitalize">
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/json"
            multiple
            className="hidden"
            onChange={(e) => void ingest(Array.from(e.target.files ?? []))}
          />
          <Button onClick={() => fileRef.current?.click()} disabled={busy}>
            {busy ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Choose files
          </Button>
        </div>

        {queue.length ? (
          <div className="mt-4 max-h-64 space-y-1 overflow-auto rounded-lg border border-border bg-background p-2">
            {queue.map((q, i) => (
              <div key={`${q.name}-${i}`} className="flex items-center gap-2 text-xs">
                <span className="w-24 shrink-0 font-mono text-[11px] text-muted-foreground">
                  {STATE_LABEL[q.state]}
                </span>
                <span className="truncate font-mono">{q.media_key}</span>
                <span className="ml-auto truncate pl-2 text-muted-foreground">
                  {q.detail ?? q.path ?? ""}
                </span>
              </div>
            ))}
            <div className="flex justify-end pt-1">
              <Button size="sm" variant="ghost" onClick={() => setQueue([])}>
                Clear list
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading photos…
        </div>
      ) : !media.length ? (
        <p className="text-sm text-muted-foreground">No photos yet.</p>
      ) : (
        grouped.map(([cat, rows]) => (
          <div key={cat} className="space-y-2">
            <h3 className="text-sm font-semibold capitalize">
              {cat} <span className="text-muted-foreground">({rows.length})</span>
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((row) => (
                <div
                  key={row.id}
                  draggable
                  onDragStart={() => setDragRow(row.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    void dropOn(row);
                  }}
                  className={`rounded-xl border bg-card p-3 ${
                    dragRow === row.id ? "border-primary" : "border-border"
                  }`}
                >
                  <div className="flex gap-3">
                    <Thumb path={row.storage_path} className="h-20 w-28 rounded-md" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <Badge variant="secondary" className="font-mono text-[10px]">
                        {row.media_key}
                      </Badge>
                      <Input
                        defaultValue={row.title}
                        onBlur={(e) =>
                          e.target.value !== row.title && void patch(row.id, { title: e.target.value })
                        }
                      />
                      <Input
                        defaultValue={row.caption ?? ""}
                        placeholder="Caption"
                        onBlur={(e) =>
                          e.target.value !== (row.caption ?? "") &&
                          void patch(row.id, { caption: e.target.value || null })
                        }
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Select value={row.category} onValueChange={(v) => void patch(row.id, { category: v })}>
                      <SelectTrigger className="h-8 w-[150px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MEDIA_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c} className="capitalize">
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <ReplaceButton row={row} onFile={(f) => void replaceOne(row, f)} />
                    <Button
                      size="sm"
                      variant={row.is_published ? "secondary" : "outline"}
                      onClick={() => void patch(row.id, { is_published: !row.is_published })}
                    >
                      {row.is_published ? "Published" : "Hidden"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void remove(row)} aria-label="Delete">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function ReplaceButton({ row, onFile }: { row: MediaRow; onFile: (file: File) => void }) {
  const ref = useRef<HTMLInputElement | null>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
      <Button
        size="sm"
        variant="outline"
        onClick={() => ref.current?.click()}
        aria-label={`Replace image for ${row.media_key}`}
      >
        <RefreshCw className="mr-1 h-3.5 w-3.5" /> Replace
      </Button>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 3. FAQ — cb_site_faq                                                */
/* ------------------------------------------------------------------ */

type FaqRow = {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  sort_order: number;
  is_published: boolean;
};

function FaqTab() {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["cb-site-faq"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cb_site_faq").select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as FaqRow[];
    },
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["cb-site-faq"] });

  async function patch(id: string, values: Record<string, unknown>) {
    const { error } = await supabase.from("cb_site_faq").update(values as never).eq("id", id);
    if (error) toast.error(error.message);
    else refresh();
  }

  async function add() {
    const max = Math.max(0, ...rows.map((r) => r.sort_order));
    const { error } = await supabase
      .from("cb_site_faq")
      .insert({ question: "New question", answer: "", sort_order: max + 1 } as never);
    if (error) toast.error(error.message);
    else refresh();
  }

  async function move(row: FaqRow, dir: -1 | 1) {
    const sorted = [...rows].sort((a, b) => a.sort_order - b.sort_order);
    const i = sorted.findIndex((r) => r.id === row.id);
    const j = i + dir;
    if (j < 0 || j >= sorted.length) return;
    await patch(row.id, { sort_order: sorted[j].sort_order });
    await patch(sorted[j].id, { sort_order: row.sort_order });
  }

  async function remove(row: FaqRow) {
    if (!window.confirm("Delete this question?")) return;
    const { error } = await supabase.from("cb_site_faq").delete().eq("id", row.id);
    if (error) toast.error(error.message);
    else refresh();
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading FAQ…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Button onClick={() => void add()}>
        <Plus className="mr-2 h-4 w-4" /> Add question
      </Button>
      {!rows.length ? <p className="text-sm text-muted-foreground">No entries yet.</p> : null}
      {rows.map((row) => (
        <div key={row.id} className="space-y-2 rounded-xl border border-border bg-card p-3">
          <Input
            defaultValue={row.question}
            onBlur={(e) =>
              e.target.value !== row.question && void patch(row.id, { question: e.target.value })
            }
          />
          <textarea
            className="min-h-[80px] w-full rounded-lg border border-border bg-background p-2 text-sm"
            defaultValue={row.answer}
            onBlur={(e) =>
              e.target.value !== row.answer && void patch(row.id, { answer: e.target.value })
            }
          />
          <div className="flex flex-wrap items-center gap-2">
            <Input
              className="h-8 w-[160px]"
              placeholder="Category"
              defaultValue={row.category ?? ""}
              onBlur={(e) =>
                e.target.value !== (row.category ?? "") &&
                void patch(row.id, { category: e.target.value || null })
              }
            />
            <Button size="sm" variant="outline" onClick={() => void move(row, -1)} aria-label="Move up">
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => void move(row, 1)} aria-label="Move down">
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant={row.is_published ? "secondary" : "outline"}
              onClick={() => void patch(row.id, { is_published: !row.is_published })}
            >
              {row.is_published ? "Published" : "Hidden"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void remove(row)} aria-label="Delete">
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 4. VIDEOS — cb_site_videos                                          */
/* ------------------------------------------------------------------ */

type VideoRow = {
  id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  thumbnail_path: string | null;
  duration_seconds: number | null;
  section: string;
  sort_order: number;
  is_published: boolean;
};

function VideosTab() {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["cb-site-videos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cb_site_videos").select("*").order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as VideoRow[];
    },
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["cb-site-videos"] });

  async function patch(id: string, values: Record<string, unknown>) {
    const { error } = await supabase.from("cb_site_videos").update(values as never).eq("id", id);
    if (error) toast.error(error.message);
    else refresh();
  }

  async function add() {
    const max = Math.max(0, ...rows.map((r) => r.sort_order));
    const { error } = await supabase
      .from("cb_site_videos")
      .insert({ title: "New video", sort_order: max + 1 } as never);
    if (error) toast.error(error.message);
    else refresh();
  }

  async function move(row: VideoRow, dir: -1 | 1) {
    const sorted = [...rows].sort((a, b) => a.sort_order - b.sort_order);
    const i = sorted.findIndex((r) => r.id === row.id);
    const j = i + dir;
    if (j < 0 || j >= sorted.length) return;
    await patch(row.id, { sort_order: sorted[j].sort_order });
    await patch(sorted[j].id, { sort_order: row.sort_order });
  }

  async function remove(row: VideoRow) {
    if (!window.confirm("Delete this video?")) return;
    if (row.thumbnail_path) await supabase.storage.from(BUCKET).remove([row.thumbnail_path]);
    const { error } = await supabase.from("cb_site_videos").delete().eq("id", row.id);
    if (error) toast.error(error.message);
    else refresh();
  }

  async function uploadThumb(row: VideoRow, file: File) {
    if (!file.type.startsWith("image/")) return toast.error("Not an image");
    if (file.size > 2 * 1024 * 1024) return toast.error("Over 2 MB");
    const small = await downscale(file);
    const path = `videos/${Date.now()}-${slugName(small.name)}`;
    const up = await supabase.storage.from(BUCKET).upload(path, small, { contentType: small.type });
    if (up.error) return toast.error(up.error.message);
    if (row.thumbnail_path) await supabase.storage.from(BUCKET).remove([row.thumbnail_path]);
    await patch(row.id, { thumbnail_path: path });
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading videos…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Button onClick={() => void add()}>
        <Plus className="mr-2 h-4 w-4" /> Add video
      </Button>
      {!rows.length ? <p className="text-sm text-muted-foreground">No videos yet.</p> : null}
      {rows.map((row) => (
        <div key={row.id} className="rounded-xl border border-border bg-card p-3">
          <div className="flex flex-wrap gap-3">
            <Thumb path={row.thumbnail_path} className="h-20 w-32 rounded-md" />
            <div className="min-w-[260px] flex-1 space-y-2">
              <Input
                defaultValue={row.title}
                onBlur={(e) =>
                  e.target.value !== row.title && void patch(row.id, { title: e.target.value })
                }
              />
              <textarea
                className="min-h-[64px] w-full rounded-lg border border-border bg-background p-2 text-sm"
                placeholder="Description"
                defaultValue={row.description ?? ""}
                onBlur={(e) =>
                  e.target.value !== (row.description ?? "") &&
                  void patch(row.id, { description: e.target.value || null })
                }
              />
              <Input
                placeholder="Video URL"
                defaultValue={row.video_url ?? ""}
                onBlur={(e) =>
                  e.target.value !== (row.video_url ?? "") &&
                  void patch(row.id, { video_url: e.target.value || null })
                }
              />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Input
              className="h-8 w-[140px]"
              placeholder="Section"
              defaultValue={row.section}
              onBlur={(e) =>
                e.target.value !== row.section && void patch(row.id, { section: e.target.value })
              }
            />
            <Input
              className="h-8 w-[130px]"
              type="number"
              placeholder="Seconds"
              defaultValue={row.duration_seconds ?? ""}
              onBlur={(e) =>
                void patch(row.id, {
                  duration_seconds: e.target.value ? Number(e.target.value) : null,
                })
              }
            />
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm">
              <Upload className="h-3.5 w-3.5" /> Thumbnail
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadThumb(row, f);
                  e.target.value = "";
                }}
              />
            </label>
            <Button size="sm" variant="outline" onClick={() => void move(row, -1)} aria-label="Move up">
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => void move(row, 1)} aria-label="Move down">
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant={row.is_published ? "secondary" : "outline"}
              onClick={() => void patch(row.id, { is_published: !row.is_published })}
            >
              {row.is_published ? "Published" : "Hidden"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void remove(row)} aria-label="Delete">
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function CbSiteTab() {
  return (
    <Tabs defaultValue="content">
      <TabsList className="flex-wrap">
        <TabsTrigger value="content">Content</TabsTrigger>
        <TabsTrigger value="photos">Photos</TabsTrigger>
        <TabsTrigger value="faq">FAQ</TabsTrigger>
        <TabsTrigger value="videos">Videos</TabsTrigger>
      </TabsList>
      <TabsContent value="content" className="mt-4">
        <ContentTab />
      </TabsContent>
      <TabsContent value="photos" className="mt-4">
        <PhotosTab />
      </TabsContent>
      <TabsContent value="faq" className="mt-4">
        <FaqTab />
      </TabsContent>
      <TabsContent value="videos" className="mt-4">
        <VideosTab />
      </TabsContent>
    </Tabs>
  );
}

export default CbSiteTab;
