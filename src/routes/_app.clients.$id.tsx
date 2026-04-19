import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";
import { ArrowLeft, Mail, Phone, Plus } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AddressAutocomplete, type AddressResult } from "@/components/maps/AddressAutocomplete";
import { StatusBadge } from "@/components/brand/StatusBadge";

export const Route = createFileRoute("/_app/clients/$id")({
  component: ClientDetailPage,
});

function ClientDetailPage() {
  const { id } = useParams({ from: "/_app/clients/$id" });
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"properties" | "jobs">("properties");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: client } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("*").eq("id", id).single();
      return data;
    },
  });

  const { data: properties = [] } = useQuery({
    queryKey: ["client-properties", id],
    queryFn: async () => {
      const { data } = await supabase.from("properties").select("*").eq("client_id", id);
      return data ?? [];
    },
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ["client-jobs", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("jobs")
        .select("id, name, job_number, status, primary_trade, total_estimate, created_at")
        .eq("client_id", id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const propertyJobCount = (propId: string) => jobs.filter((j) => /* property_id loaded later */ propId && false).length;

  const [form, setForm] = useState<{
    address: string; city: string | null; state: string | null; zip: string | null;
    lat: number | null; lng: number | null;
    property_type: string; year_built: string; roof_type: string; notes: string;
  }>({
    address: "", city: null, state: null, zip: null, lat: null, lng: null,
    property_type: "residential", year_built: "", roof_type: "", notes: "",
  });

  function handleAddress(r: AddressResult) {
    setForm((f) => ({ ...f, ...r }));
  }

  const addProperty = useMutation({
    mutationFn: async () => {
      if (!profile?.company_id) throw new Error("No company");
      if (!form.address) throw new Error("Address required");
      const { error } = await supabase.from("properties").insert({
        company_id: profile.company_id,
        client_id: id,
        address: form.address,
        city: form.city,
        state: form.state,
        zip: form.zip,
        lat: form.lat,
        lng: form.lng,
        property_type: form.property_type,
        year_built: form.year_built ? Number(form.year_built) : null,
        roof_type: form.roof_type || null,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Property added");
      setDrawerOpen(false);
      setForm({ address: "", city: null, state: null, zip: null, lat: null, lng: null, property_type: "residential", year_built: "", roof_type: "", notes: "" });
      qc.invalidateQueries({ queryKey: ["client-properties", id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (!client) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/clients" className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Clients
        </Link>
        <h1 className="text-3xl font-bold text-foreground">{client.name}</h1>
        <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
          {client.email && (
            <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{client.email}</span>
          )}
          {client.phone && (
            <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{client.phone}</span>
          )}
        </div>
      </div>

      <div className="flex gap-1 border-b" style={{ borderColor: "var(--border)" }}>
        {(["properties", "jobs"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`border-b-2 px-3 py-2 text-sm capitalize ${
              tab === t ? "border-[var(--brand)] text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "properties" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => setDrawerOpen(true)} className="btn-brand inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm font-semibold">
              <Plus className="h-4 w-4" /> Add Property
            </button>
          </div>
          <div className="rounded-xl border" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
            {properties.length === 0 ? (
              <p className="p-12 text-center text-sm text-muted-foreground">No properties yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-6 py-3 font-semibold">Address</th>
                    <th className="px-6 py-3 font-semibold">Type</th>
                    <th className="px-6 py-3 font-semibold">Year Built</th>
                    <th className="px-6 py-3 text-right font-semibold">Jobs</th>
                    <th className="px-6 py-3 text-right font-semibold">Roof</th>
                  </tr>
                </thead>
                <tbody>
                  {properties.map((p) => (
                    <tr key={p.id} className="border-t" style={{ borderColor: "var(--border)" }}>
                      <td className="px-6 py-3 font-medium text-foreground">{p.address}{p.city ? `, ${p.city}` : ""}{p.state ? `, ${p.state}` : ""}{p.zip ? ` ${p.zip}` : ""}</td>
                      <td className="px-6 py-3 capitalize text-muted-foreground">{p.property_type ?? "—"}</td>
                      <td className="px-6 py-3 font-mono-num text-muted-foreground">{p.year_built ?? "—"}</td>
                      <td className="px-6 py-3 text-right font-mono-num text-muted-foreground">{propertyJobCount(p.id)}</td>
                      <td className="px-6 py-3 text-right">
                        <button
                          onClick={() => setRoofProp({ id: p.id, lat: p.lat ? Number(p.lat) : null, lng: p.lng ? Number(p.lng) : null })}
                          className="text-xs font-semibold text-[var(--brand)] hover:underline"
                        >
                          Measure →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === "jobs" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Link
              to="/jobs/new"
              search={{ client_id: id }}
              className="btn-chrome inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm font-semibold"
            >
              <Plus className="h-4 w-4" /> New Job for this client
            </Link>
          </div>
          <div className="rounded-xl border" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
            {jobs.length === 0 ? (
              <p className="p-12 text-center text-sm text-muted-foreground">No jobs yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-6 py-3 font-semibold">Job #</th>
                    <th className="px-6 py-3 font-semibold">Name</th>
                    <th className="px-6 py-3 font-semibold">Status</th>
                    <th className="px-6 py-3 text-right font-semibold">Estimate</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((j) => (
                    <tr key={j.id} className="border-t hover:bg-[var(--surface-hover)]" style={{ borderColor: "var(--border)" }}>
                      <td className="px-6 py-3 font-mono-num text-foreground">{j.job_number ?? "—"}</td>
                      <td className="px-6 py-3 text-foreground">{j.name}</td>
                      <td className="px-6 py-3"><StatusBadge status={j.status} /></td>
                      <td className="px-6 py-3 text-right font-mono-num text-foreground">${Number(j.total_estimate).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg">
          <SheetHeader><SheetTitle>Add Property</SheetTitle></SheetHeader>
          <div className="mt-6 space-y-4">
            <div>
              <Label>Address</Label>
              <AddressAutocomplete onSelect={handleAddress} />
              {form.address && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {form.address}{form.city ? `, ${form.city}` : ""}{form.state ? `, ${form.state}` : ""}{form.zip ? ` ${form.zip}` : ""}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <select
                  value={form.property_type}
                  onChange={(e) => setForm({ ...form, property_type: e.target.value })}
                  className="h-10 w-full rounded-md border bg-[var(--bg-elevated)] px-3 text-sm text-foreground"
                  style={{ borderColor: "var(--border)" }}
                >
                  <option value="residential">Residential</option>
                  <option value="commercial">Commercial</option>
                  <option value="multifamily">Multifamily</option>
                  <option value="industrial">Industrial</option>
                </select>
              </div>
              <div>
                <Label>Year Built</Label>
                <Input value={form.year_built} onChange={(e) => setForm({ ...form, year_built: e.target.value })} placeholder="2015" />
              </div>
            </div>
            <div>
              <Label>Roof Type (optional)</Label>
              <select
                value={form.roof_type}
                onChange={(e) => setForm({ ...form, roof_type: e.target.value })}
                className="h-10 w-full rounded-md border bg-[var(--bg-elevated)] px-3 text-sm text-foreground"
                style={{ borderColor: "var(--border)" }}
              >
                <option value="">—</option>
                <option value="shingle">Shingle</option>
                <option value="tile">Tile</option>
                <option value="metal">Metal</option>
                <option value="flat">Flat / TPO</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
            </div>
            <button
              onClick={() => addProperty.mutate()}
              disabled={!form.address || addProperty.isPending}
              className="btn-brand h-10 w-full rounded-md text-sm font-semibold disabled:opacity-40"
            >
              {addProperty.isPending ? "Saving…" : "Save Property"}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
