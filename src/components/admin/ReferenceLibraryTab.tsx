import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, Trash2, Loader2, ImageIcon } from "lucide-react";

export type ReferencePhoto = {
  id: string;
  label: string;
  category: string;
  trade: string;
  line_item_code: string | null;
  default_unit: string | null;
  notes: string | null;
  storage_path: string;
  bucket: string;
  is_active: boolean;
  created_at: string;
};

const CATEGORIES = [
  "roof_hardware",
  "roof_accessory",
  "ventilation",
  "flashing",
  "exterior_hardware",
  "gutter",
  "other",
] as const;

const TRADES = ["roofing", "exterior", "windows", "interior", "gutters", "other"] as const;

export function ReferenceLibraryTab() {
  const [rows, setRows] = useState<ReferencePhoto[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<string>("roof_hardware");
  const [trade, setTrade] = useState<string>("roofing");
  const [code, setCode] = useState("");
  const [unit, setUnit] = useState("");
  const [notes, setNotes] = useState("");
  const [filterTrade, setFilterTrade] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("ai_reference_photos")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    const list = (data as ReferencePhoto[]) ?? [];
    setRows(list);
    if (list.length) {
      const { data: signed } = await supabase.storage
        .from("ai-reference-photos")
        .createSignedUrls(list.map((r) => r.storage_path), 3600);
      const map: Record<string, string> = {};
      (signed ?? []).forEach((s, i) => {
        if (s.signedUrl) map[list[i].storage_path] = s.signedUrl;
      });
      setUrls(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return toast.error("Choose a photo first");
    if (!label.trim()) return toast.error("Label is required");
    setSaving(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${category}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("ai-reference-photos")
        .upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("ai_reference_photos").insert({
        label: label.trim(),
        category,
        trade,
        line_item_code: code.trim() || null,
        default_unit: unit.trim() || null,
        notes: notes.trim() || null,
        storage_path: path,
        created_by: auth.user?.id ?? null,
      });
      if (error) throw error;
      toast.success("Reference photo added");
      setFile(null);
      setLabel("");
      setCode("");
      setUnit("");
      setNotes("");
      const fi = document.getElementById("ref-photo-input") as HTMLInputElement | null;
      if (fi) fi.value = "";
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: ReferencePhoto) => {
    if (!confirm(`Delete "${row.label}"?`)) return;
    await supabase.storage.from("ai-reference-photos").remove([row.storage_path]);
    const { error } = await supabase.from("ai_reference_photos").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  const toggle = async (row: ReferencePhoto) => {
    const { error } = await supabase
      .from("ai_reference_photos")
      .update({ is_active: !row.is_active })
      .eq("id", row.id);
    if (error) return toast.error(error.message);
    load();
  };

  const visible = rows.filter((r) => filterTrade === "all" || r.trade === filterTrade);

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Upload className="h-4 w-4 text-primary" /> Add a labeled hardware / accessory photo
        </div>
        <p className="text-xs text-muted-foreground">
          These images are sent to the AI alongside every jobsite photo, so it learns what your parts look like and which
          code each one maps to.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Label</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Lead pipe boot, 3 inch"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Photo</label>
            <input
              id="ref-photo-input"
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Trade</label>
            <select
              value={trade}
              onChange={(e) => setTrade(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              {TRADES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Line item code</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="0224"
                className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Unit</label>
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="EA"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="md:col-span-3">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Notes for the AI</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Count one per plumbing stack. Cracked collar = replace."
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Add reference
        </button>
      </form>

      <div className="flex items-center gap-2">
        {(["all", ...TRADES] as string[]).map((t) => (
          <button
            key={t}
            onClick={() => setFilterTrade(t)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${
              filterTrade === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            {t}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">
          {visible.length} of {rows.length}
        </span>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card px-5 py-10 text-center text-sm text-muted-foreground">
          No reference photos yet.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {visible.map((r) => (
            <div key={r.id} className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="aspect-square bg-muted">
                {urls[r.storage_path] ? (
                  <img src={urls[r.storage_path]} alt={r.label} className="h-full w-full object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <ImageIcon className="h-6 w-6" />
                  </div>
                )}
              </div>
              <div className="space-y-1 p-3">
                <div className="truncate text-sm font-medium">{r.label}</div>
                <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                  <span className="rounded bg-muted px-1.5 py-0.5">{r.category.replaceAll("_", " ")}</span>
                  {r.line_item_code && (
                    <span className="rounded bg-muted px-1.5 py-0.5 font-mono">{r.line_item_code}</span>
                  )}
                  {r.default_unit && <span className="rounded bg-muted px-1.5 py-0.5">{r.default_unit}</span>}
                </div>
                {r.notes && <p className="line-clamp-2 text-[11px] text-muted-foreground">{r.notes}</p>}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => toggle(r)}
                    className={`rounded px-2 py-0.5 text-[10px] font-medium ${
                      r.is_active ? "bg-emerald-500/10 text-emerald-700" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {r.is_active ? "Active" : "Paused"}
                  </button>
                  <button onClick={() => remove(r)} className="ml-auto text-muted-foreground hover:text-red-500">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
