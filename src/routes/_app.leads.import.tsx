import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import Papa from "papaparse";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { importLeads } from "@/server/leads.functions";
import { useIsCompanyAdmin, useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, FileText, AlertTriangle } from "lucide-react";

const BATCH_SIZE = 100;

export const Route = createFileRoute("/_app/leads/import")({
  component: ImportLeads,
});

type CsvRow = Record<string, string>;

interface ParsedContact {
  name: string;
  title?: string | null;
  company?: string | null;
  phones?: string[];
  emails?: string[];
}

interface ParsedLead {
  address: string;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  owner?: string | null;
  sqft?: number | null;
  year_built?: string | null;
  property_type?: string | null;
  sale_amount?: string | null;
  reported_owner?: string | null;
  contacts?: ParsedContact[];
}

function splitPipe(s: string | undefined): string[] {
  if (!s) return [];
  return s
    .split("|")
    .map((x) => x.trim())
    .filter((x) => x.length >= 3 && x.length <= 200);
}

function parseAddressFull(s: string): { address: string; city?: string; state?: string; zip?: string } {
  // "Street, City, State Zip"
  const parts = s.split(",").map((p) => p.trim());
  if (parts.length >= 3) {
    const last = parts[parts.length - 1];
    const m = last.match(/^([A-Za-z]{2})\s+(\d{5}(?:-\d{4})?)$/);
    if (m) {
      return { address: parts.slice(0, -2).join(", "), city: parts[parts.length - 2], state: m[1], zip: m[2] };
    }
    return { address: parts.slice(0, -2).join(", "), city: parts[parts.length - 2], state: last };
  }
  return { address: s };
}

function cleanStr(s: string | undefined, max: number): string | null {
  const v = (s ?? "").trim();
  if (!v) return null;
  return v.slice(0, max);
}

function normalizePhone(p: string | undefined): string | null {
  if (!p) return null;
  const digits = p.replace(/[^\d]/g, "");
  if (digits.length < 7 || digits.length > 20) return null;
  return digits;
}

function isValidEmail(e: string | undefined): string | null {
  if (!e) return null;
  const v = e.trim().toLowerCase();
  if (v.length < 5 || v.length > 200) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return null;
  return v;
}

// Group Reonomy "contacts" rows (one row per contact) into one lead per property.
function groupContactRows(rows: CsvRow[]): { leads: ParsedLead[]; skipped: number } {
  const byProp = new Map<string, { lead: ParsedLead; contacts: Map<string, ParsedContact> }>();
  let skipped = 0;

  for (const r of rows) {
    const street = (r.subject_address_line_1 || "").trim();
    if (!street) { skipped++; continue; }
    const city = (r.subject_address_city || "").trim();
    const state = (r.subject_address_state || "FL").trim();
    const zip = (r.subject_address_postal_code || "").trim();
    const key = `${street.toLowerCase()}|${city.toLowerCase()}|${state.toLowerCase()}|${zip}`;

    let bucket = byProp.get(key);
    if (!bucket) {
      bucket = {
        lead: {
          address: street.slice(0, 500),
          city: city.slice(0, 120) || null,
          state: state.slice(0, 40),
          zip: zip.slice(0, 20) || null,
          property_type: "Commercial",
          reported_owner: cleanStr(r.reported_owner_name, 200),
          owner: cleanStr(r.reported_owner_name, 200),
          contacts: [],
        },
        contacts: new Map(),
      };
      byProp.set(key, bucket);
    }

    const name = cleanStr(r.contact_name, 200);
    if (!name) continue;
    const nameKey = name.toLowerCase();
    let c = bucket.contacts.get(nameKey);
    if (!c) {
      c = {
        name,
        title: cleanStr(r.contact_title, 200),
        company: cleanStr(r.contact_company_name, 200),
        phones: [],
        emails: [],
      };
      bucket.contacts.set(nameKey, c);
    }
    const phoneSet = new Set(c.phones ?? []);
    const emailSet = new Set(c.emails ?? []);
    for (let i = 1; i <= 5; i++) {
      const p = normalizePhone(r[`contact_phone_${i}`]);
      if (p) phoneSet.add(p);
      const e = isValidEmail(r[`contact_email_${i}`]);
      if (e) emailSet.add(e);
    }
    c.phones = Array.from(phoneSet).slice(0, 20);
    c.emails = Array.from(emailSet).slice(0, 20);
  }

  const leads: ParsedLead[] = [];
  for (const { lead, contacts } of byProp.values()) {
    lead.contacts = Array.from(contacts.values()).slice(0, 20);
    leads.push(lead);
  }
  return { leads, skipped };
}

function isContactsShape(rows: CsvRow[]): boolean {
  const s = rows[0];
  if (!s) return false;
  return "subject_address_line_1" in s && ("contact_name" in s || "contact_phone_1" in s);
}

function mapRow(r: CsvRow): ParsedLead | null {
  // Try merged Reonomy format first
  if (r.street || r.address) {
    const contacts: ParsedContact[] = [];
    for (let i = 1; i <= 3; i++) {
      const name = r[`contact_${i}_name`];
      if (name) {
        contacts.push({
          name,
          title: r[`contact_${i}_title`] || null,
          company: r[`contact_${i}_company`] || null,
          phones: splitPipe(r[`contact_${i}_phones`]),
          emails: splitPipe(r[`contact_${i}_emails`]),
        });
      }
    }
    const sqft = r.sqft ? parseInt(r.sqft.replace(/[^\d]/g, ""), 10) : null;
    const addr = (r.street || r.address || "").trim();
    if (!addr) return null;
    return {
      address: addr.slice(0, 500),
      city: (r.city || "").slice(0, 120) || null,
      state: ((r.state || "FL").trim()).slice(0, 40),
      zip: (r.zip || "").slice(0, 20) || null,
      sqft: Number.isFinite(sqft as number) ? sqft : null,
      year_built: (r.year_built || "").slice(0, 20) || null,
      property_type: (r.property_type || "Commercial").slice(0, 80),
      reported_owner: (r.reported_owner || "").slice(0, 200) || null,
      owner: (r.reported_owner || "").slice(0, 200) || null,
      contacts: contacts.filter((c) => c.name && c.name.length >= 1),
    };
  }
  // Raw Reonomy
  if (r.address_full) {
    const parsed = parseAddressFull(r.address_full);
    const sqft = r.gross_building_area
      ? parseInt(r.gross_building_area.replace(/[^\d]/g, ""), 10)
      : null;
    const contacts: ParsedContact[] = [];
    if (r.contact_name && r.contact_name.trim()) {
      const phone = (r.contact_phone_1 || "").trim();
      const email = (r.contact_email_1 || "").trim();
      contacts.push({
        name: r.contact_name.trim().slice(0, 200),
        title: (r.contact_title || "").slice(0, 200) || null,
        phones: phone.length >= 3 && phone.length <= 40 ? [phone] : [],
        emails: email.length >= 3 && email.length <= 200 ? [email] : [],
      });
    }
    if (!parsed.address || !parsed.address.trim()) return null;
    return {
      address: parsed.address.slice(0, 500),
      city: (parsed.city ?? "").slice(0, 120) || null,
      state: (parsed.state ?? "FL").slice(0, 40),
      zip: (parsed.zip ?? "").slice(0, 20) || null,
      sqft: Number.isFinite(sqft as number) ? sqft : null,
      year_built: (r.year_built || "").slice(0, 20) || null,
      property_type: (r.property_type || "Commercial").slice(0, 80),
      sale_amount: (r.sale_amount || "").slice(0, 80) || null,
      contacts,
    };
  }
  return null;
}

const SAMPLE: ParsedLead[] = [
  { address: "1500 NW 167th St", city: "Miami Gardens", state: "FL", zip: "33169", owner: "Sunrise Logistics LLC", sqft: 42000, year_built: "1998", property_type: "Warehouse", roof_type: "Modified Bitumen" } as ParsedLead,
  { address: "8200 NW 36th St", city: "Doral", state: "FL", zip: "33166", owner: "Atlas Industrial Group", sqft: 65000, year_built: "2002", property_type: "Manufacturing" } as ParsedLead,
  { address: "2400 N Federal Hwy", city: "Boca Raton", state: "FL", zip: "33431", owner: "Federal Plaza LLC", sqft: 28000, year_built: "1985", property_type: "Strip Center" } as ParsedLead,
  { address: "1100 Park Central Blvd S", city: "Pompano Beach", state: "FL", zip: "33064", owner: "Park Central Properties", sqft: 51000, year_built: "1992", property_type: "Office" } as ParsedLead,
  { address: "5950 NW 99th Ave", city: "Doral", state: "FL", zip: "33178", owner: "Coastal Storage Inc", sqft: 38000, year_built: "2008", property_type: "Self-Storage" } as ParsedLead,
  { address: "3001 SW 8th St", city: "Miami", state: "FL", zip: "33135", owner: "Calle Ocho Holdings", sqft: 22000, year_built: "1976", property_type: "Retail" } as ParsedLead,
  { address: "750 NW 33rd St", city: "Pompano Beach", state: "FL", zip: "33064", owner: "Tri-County Cold Storage", sqft: 87000, year_built: "1995", property_type: "Cold Storage" } as ParsedLead,
  { address: "12100 SW 117th Ct", city: "Miami", state: "FL", zip: "33186", owner: "South Dade Medical LLC", sqft: 19000, year_built: "2001", property_type: "Medical" } as ParsedLead,
  { address: "9400 W Atlantic Blvd", city: "Coral Springs", state: "FL", zip: "33071", owner: "Atlantic Hospitality Group", sqft: 64000, year_built: "1989", property_type: "Hotel" } as ParsedLead,
  { address: "201 SE 2nd Ave", city: "Fort Lauderdale", state: "FL", zip: "33301", owner: "Las Olas Office Tower", sqft: 95000, year_built: "1978", property_type: "Office" } as ParsedLead,
  { address: "4500 NW 27th Ave", city: "Miami", state: "FL", zip: "33142", owner: "Liberty Industrial Park", sqft: 73000, year_built: "1983", property_type: "Warehouse" } as ParsedLead,
  { address: "1800 W Hillsboro Blvd", city: "Deerfield Beach", state: "FL", zip: "33442", owner: "Hillsboro Crossing LLC", sqft: 31000, year_built: "1994", property_type: "Strip Center" } as ParsedLead,
  { address: "6201 N Federal Hwy", city: "Fort Lauderdale", state: "FL", zip: "33308", owner: "Galt Ocean Properties", sqft: 26000, year_built: "1981", property_type: "Office" } as ParsedLead,
  { address: "3400 SW 30th Ave", city: "Hollywood", state: "FL", zip: "33312", owner: "Hollywood Self Storage", sqft: 44000, year_built: "2005", property_type: "Self-Storage" } as ParsedLead,
  { address: "10800 Biscayne Blvd", city: "Miami", state: "FL", zip: "33161", owner: "Biscayne Medical Center", sqft: 58000, year_built: "1990", property_type: "Medical" } as ParsedLead,
];

function ImportLeads() {
  const isAdmin = useIsCompanyAdmin();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const importFn = useServerFn(importLeads);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [filename, setFilename] = useState("");
  const [drag, setDrag] = useState(false);

  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const importMut = useMutation({
    mutationFn: async (leads: ParsedLead[]) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        throw new Error("Please sign in again before importing leads.");
      }
      const headers = { Authorization: `Bearer ${token}` };

      let inserted = 0;
      let created = 0;
      let merged = 0;
      let skippedDuplicates = 0;
      let contactsInserted = 0;
      let phonesInserted = 0;
      let emailsInserted = 0;
      const errors: string[] = [];

      setProgress({ done: 0, total: leads.length });

      for (let i = 0; i < leads.length; i += BATCH_SIZE) {
        const batch = leads.slice(i, i + BATCH_SIZE);
        try {
          const res = await importFn({ data: { leads: batch }, headers });
          inserted += res.inserted ?? 0;
          created += res.created ?? res.inserted ?? 0;
          merged += res.merged ?? 0;
          skippedDuplicates += res.skippedDuplicates ?? 0;
          contactsInserted += res.contactsInserted ?? 0;
          phonesInserted += res.phonesInserted ?? 0;
          emailsInserted += res.emailsInserted ?? 0;
          if (res.errors?.length) errors.push(...res.errors);
        } catch (err) {
          if (err instanceof Response) {
            const text = await err.text().catch(() => "");
            errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${text || `Server error ${err.status}`}`);
          } else {
            errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${err instanceof Error ? err.message : "Unknown error"}`);
          }
        }
        setProgress({ done: Math.min(i + BATCH_SIZE, leads.length), total: leads.length });
      }

      return { inserted, created, merged, skippedDuplicates, contactsInserted, phonesInserted, emailsInserted, errors, attempted: leads.length };
    },
    onSuccess: (res) => {
      setProgress(null);
      const errCount = res.errors.length;
      const enrichedBits: string[] = [];
      if (res.contactsInserted) enrichedBits.push(`+${res.contactsInserted} contacts`);
      if (res.phonesInserted) enrichedBits.push(`+${res.phonesInserted} phones`);
      if (res.emailsInserted) enrichedBits.push(`+${res.emailsInserted} emails`);
      const enrichedSuffix = enrichedBits.length ? ` (${enrichedBits.join(", ")})` : "";

      if (res.created > 0 || res.merged > 0) {
        toast.success(
          `Created ${res.created} · Merged ${res.merged} · Skipped ${res.skippedDuplicates} duplicate${res.skippedDuplicates === 1 ? "" : "s"}${enrichedSuffix}${errCount ? ` (${errCount} errors)` : ""}`,
        );
      } else if (errCount === 0) {
        toast.message(`No changes — all ${res.attempted} addresses already existed with the same contact info.`);
      } else {
        toast.error(res.errors[0] ?? "No leads imported");
      }
      if (errCount > 0) console.warn("Import errors:", res.errors);
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (e) => {
      setProgress(null);
      toast.error(e instanceof Error ? e.message : "Import failed");
    },
  });

  if (!profile) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (!isAdmin) {
    return (
      <div className="rounded-xl border p-8 text-center" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}>
        <AlertTriangle className="mx-auto h-8 w-8 text-[var(--warning)]" />
        <h2 className="mt-3 text-lg font-semibold text-foreground">Admin access required</h2>
        <p className="mt-1 text-sm text-muted-foreground">Only company owners and admins can import leads. Contact your admin to import on your behalf.</p>
      </div>
    );
  }

  function handleFile(file: File) {
    setFilename(file.name);
    Papa.parse<CsvRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => setRows(res.data as CsvRow[]),
      error: (err) => toast.error(err.message),
    });
  }

  const parsedPreview = (() => {
    if (rows.length === 0) return null;
    if (isContactsShape(rows)) {
      const { leads, skipped } = groupContactRows(rows);
      const contactCount = leads.reduce((n, l) => n + (l.contacts?.length ?? 0), 0);
      return { leads, skipped, contactCount, shape: "contacts" as const };
    }
    const leads = rows.map(mapRow).filter((r): r is ParsedLead => !!r);
    return { leads, skipped: rows.length - leads.length, contactCount: 0, shape: "row" as const };
  })();

  function doImport() {
    if (!parsedPreview || parsedPreview.leads.length === 0) {
      toast.error("No valid rows found");
      return;
    }
    if (parsedPreview.skipped > 0) {
      toast.message(`Skipping ${parsedPreview.skipped} row${parsedPreview.skipped === 1 ? "" : "s"} with no street address`);
    }
    importMut.mutate(parsedPreview.leads);
  }

  function loadSample() {
    importMut.mutate(SAMPLE);
  }

  const previewCols = rows[0] ? Object.keys(rows[0]).slice(0, 6) : [];

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault(); setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
        className="rounded-xl border-2 border-dashed p-10 text-center transition-colors"
        style={{ borderColor: drag ? "var(--brand)" : "var(--border)", backgroundColor: "var(--bg-card)" }}
      >
        <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
        <h3 className="mt-3 text-base font-semibold text-foreground">Drop a CSV here</h3>
        <p className="mt-1 text-xs text-muted-foreground">Reonomy merged or raw format · max 2000 rows</p>
        <label className="mt-4 inline-block cursor-pointer">
          <input type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          <span className="btn-brand inline-block rounded-md px-4 py-2 text-sm font-semibold">Browse files</span>
        </label>
        <button onClick={loadSample} disabled={importMut.isPending} className="ml-3 text-xs text-[var(--text-dim)] underline hover:text-foreground">
          or load 15 sample South Florida properties
        </button>
      </div>

      {rows.length > 0 && (
        <div className="rounded-xl border" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}>
          <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-foreground">{filename}</span>
              <span className="text-muted-foreground">
                · {rows.length} rows
                {parsedPreview && parsedPreview.shape === "contacts" && (
                  <> → {parsedPreview.leads.length} properties · {parsedPreview.contactCount} contacts</>
                )}
                {parsedPreview && parsedPreview.skipped > 0 && (
                  <> · {parsedPreview.skipped} skipped</>
                )}
              </span>
            </div>
            <button onClick={doImport} disabled={importMut.isPending || !parsedPreview?.leads.length} className="btn-brand h-8 rounded-md px-4 text-xs font-semibold disabled:opacity-40">
              {importMut.isPending
                ? progress
                  ? `Importing ${progress.done}/${progress.total}…`
                  : "Importing…"
                : `Import ${parsedPreview?.leads.length ?? 0} ${parsedPreview?.shape === "contacts" ? "Properties" : "Leads"}`}
            </button>

          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                  {previewCols.map((c) => <th key={c} className="px-3 py-2 font-semibold">{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((r, i) => (
                  <tr key={i} className="border-t" style={{ borderColor: "var(--border)" }}>
                    {previewCols.map((c) => <td key={c} className="px-3 py-2 text-muted-foreground">{r[c] ?? ""}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
