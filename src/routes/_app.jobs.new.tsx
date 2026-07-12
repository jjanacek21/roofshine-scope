import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TRADES, type Trade } from "@/lib/trades";
import { AddressAutocomplete, type AddressResult } from "@/components/maps/AddressAutocomplete";
import { autoMeasureJobProperty } from "@/lib/auto-measure.functions";
import { deriveOrderFormInputs } from "@/lib/assistant.functions";

const searchSchema = z.object({ client_id: z.string().optional() });

export const Route = createFileRoute("/_app/jobs/new")({
  validateSearch: searchSchema,
  component: NewJobPage,
});

interface ClientRow { id: string; name: string; email: string | null; }
interface PropertyRow { id: string; address: string; zip: string | null; }

function NewJobPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/_app/jobs/new" });
  const { data: profile } = useProfile();
  const companyId = profile?.company_id;

  const [step, setStep] = useState<1 | 2 | 3 | 4>(search.client_id ? 2 : 1);
  const [clientId, setClientId] = useState<string | null>(search.client_id ?? null);
  const [newClient, setNewClient] = useState({ name: "", email: "", phone: "" });
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [newProperty, setNewProperty] = useState<{
    address: string; city: string | null; state: string | null; zip: string | null;
    lat: number | null; lng: number | null;
    property_type: string; year_built: string; roof_type: string;
  }>({ address: "", city: null, state: null, zip: null, lat: null, lng: null, property_type: "residential", year_built: "", roof_type: "" });

  const [details, setDetails] = useState({
    job_number: "", name: "", primary_trade: "" as Trade | "", job_type: "retail",
    claim_number: "", insurance_carrier: "", notes: "",
  });
  const [submitting, setSubmitting] = useState(false);

  // Auto-generate job number on entering step 3
  useEffect(() => {
    if (step !== 3 || details.job_number || !companyId) return;
    (async () => {
      const ym = new Date().toISOString().slice(0, 7).replace("-", "");
      const { count } = await supabase
        .from("jobs")
        .select("*", { count: "exact", head: true })
        .eq("company_id", companyId)
        .like("job_number", `JOB-${ym}-%`);
      const seq = String((count ?? 0) + 1).padStart(4, "0");
      setDetails((d) => ({ ...d, job_number: `JOB-${ym}-${seq}` }));
    })();
  }, [step, companyId, details.job_number]);

  const { data: clients = [] } = useQuery({
    queryKey: ["job-wizard-clients"],
    queryFn: async (): Promise<ClientRow[]> => {
      const { data } = await supabase.from("clients").select("id, name, email").order("name");
      return data ?? [];
    },
  });

  const { data: properties = [] } = useQuery({
    queryKey: ["job-wizard-properties", clientId],
    enabled: !!clientId,
    queryFn: async (): Promise<PropertyRow[]> => {
      const { data } = await supabase
        .from("properties")
        .select("id, address, zip")
        .eq("client_id", clientId!);
      return data ?? [];
    },
  });

  // Lookup price book by zip when on review step
  const propertyZip = propertyId ? properties.find((p) => p.id === propertyId)?.zip : newProperty.zip;
  const { data: matchedPriceBook } = useQuery({
    queryKey: ["pb-by-zip", companyId, propertyZip],
    enabled: step === 4 && !!companyId && !!propertyZip,
    queryFn: async () => {
      const { data } = await supabase
        .from("price_books")
        .select("id, name, jurisdiction, effective_month")
        .eq("company_id", companyId!)
        .eq("is_active", true)
        .contains("zip_codes", [propertyZip!])
        .order("effective_month", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const canStep1 = clientId !== null || newClient.name.trim().length > 0;
  const canStep2 = propertyId !== null || newProperty.address.length > 0;
  const canStep3 = details.name && details.primary_trade;

  async function handleCreate() {
    if (!companyId) return;
    setSubmitting(true);
    try {
      // Resolve client
      let resolvedClientId = clientId;
      if (!resolvedClientId) {
        const { data, error } = await supabase
          .from("clients")
          .insert({
            company_id: companyId,
            name: newClient.name.trim(),
            email: newClient.email || null,
            phone: newClient.phone || null,
          })
          .select("id")
          .single();
        if (error || !data) throw error ?? new Error("Failed to create client");
        resolvedClientId = data.id;
      }

      // Resolve property
      let resolvedPropertyId = propertyId;
      if (!resolvedPropertyId) {
        const { data, error } = await supabase
          .from("properties")
          .insert({
            company_id: companyId,
            client_id: resolvedClientId,
            address: newProperty.address,
            city: newProperty.city,
            state: newProperty.state,
            zip: newProperty.zip,
            lat: newProperty.lat,
            lng: newProperty.lng,
            property_type: newProperty.property_type,
            year_built: newProperty.year_built ? Number(newProperty.year_built) : null,
            roof_type: newProperty.roof_type || null,
          })
          .select("id, address")
          .single();
        if (error || !data) throw error ?? new Error("Failed to create property");
        resolvedPropertyId = data.id;
      }

      const propertyAddr = propertyId
        ? properties.find((p) => p.id === propertyId)?.address
        : newProperty.address;

      const { data: job, error: jobErr } = await supabase
        .from("jobs")
        .insert({
          company_id: companyId,
          client_id: resolvedClientId,
          property_id: resolvedPropertyId,
          property_address: propertyAddr,
          job_number: details.job_number,
          name: details.name,
          primary_trade: details.primary_trade as Trade,
          job_type: details.job_type,
          claim_number: details.claim_number || null,
          insurance_carrier: details.insurance_carrier || null,
          notes: details.notes || null,
          price_book_id: matchedPriceBook?.id ?? null,
          status: "lead",
        })
        .select("id")
        .single();
      if (jobErr || !job) throw jobErr ?? new Error("Failed to create job");

      toast.success("Job created");
      navigate({ to: "/jobs/$id", params: { id: job.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create job");
    } finally {
      setSubmitting(false);
    }
  }

  const isInsurance = details.job_type === "insurance";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <button onClick={() => navigate({ to: "/jobs" })} className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Jobs
        </button>
        <h1 className="text-3xl font-bold text-foreground">New Job</h1>
      </div>

      <div className="flex items-center gap-2">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="flex flex-1 items-center gap-2">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
              style={{
                backgroundColor: step >= n ? "var(--brand)" : "var(--bg-card)",
                color: step >= n ? "white" : "var(--text-muted)",
                border: "1px solid var(--border)",
              }}
            >
              {step > n ? <Check className="h-3.5 w-3.5" /> : n}
            </div>
            <span className="text-xs font-medium" style={{ color: step >= n ? "var(--text)" : "var(--text-muted)" }}>
              {n === 1 ? "Client" : n === 2 ? "Property" : n === 3 ? "Details" : "Review"}
            </span>
            {n < 4 && <div className="h-px flex-1" style={{ backgroundColor: "var(--border)" }} />}
          </div>
        ))}
      </div>

      <div className="rounded-xl border p-6" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <Label>Existing Client</Label>
              <select
                value={clientId ?? ""}
                onChange={(e) => { setClientId(e.target.value || null); if (e.target.value) setNewClient({ name: "", email: "", phone: "" }); }}
                className="h-10 w-full rounded-md border bg-[var(--bg-elevated)] px-3 text-sm text-foreground"
                style={{ borderColor: "var(--border)" }}
              >
                <option value="">— Select existing or create new below —</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.email ? ` (${c.email})` : ""}</option>)}
              </select>
            </div>
            {!clientId && (
              <div className="space-y-3 rounded-md border p-4" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}>
                <p className="text-xs font-semibold uppercase text-muted-foreground">New Client</p>
                <div><Label>Name</Label><Input value={newClient.name} onChange={(e) => setNewClient({ ...newClient, name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Email</Label><Input value={newClient.email} onChange={(e) => setNewClient({ ...newClient, email: e.target.value })} /></div>
                  <div><Label>Phone</Label><Input value={newClient.phone} onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })} /></div>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            {properties.length > 0 && (
              <div>
                <Label>Existing Properties</Label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {properties.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setPropertyId(p.id)}
                      className={`rounded-md border p-3 text-left text-sm ${propertyId === p.id ? "border-[var(--brand)]" : ""}`}
                      style={{ borderColor: propertyId === p.id ? "var(--brand)" : "var(--border)", backgroundColor: "var(--bg-card)" }}
                    >
                      <p className="font-medium text-foreground">{p.address}</p>
                      {p.zip && <p className="font-mono-num text-xs text-muted-foreground">{p.zip}</p>}
                    </button>
                  ))}
                </div>
                <button onClick={() => setPropertyId(null)} className="mt-2 text-xs text-muted-foreground hover:text-foreground">
                  + Add new property instead
                </button>
              </div>
            )}
            {propertyId === null && (
              <div className="space-y-3">
                <div>
                  <Label>Address</Label>
                  <AddressAutocomplete onSelect={(r: AddressResult) => setNewProperty((p) => ({ ...p, ...r }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Type</Label>
                    <select
                      value={newProperty.property_type}
                      onChange={(e) => setNewProperty({ ...newProperty, property_type: e.target.value })}
                      className="h-10 w-full rounded-md border bg-[var(--bg-elevated)] px-3 text-sm text-foreground"
                      style={{ borderColor: "var(--border)" }}
                    >
                      <option value="residential">Residential</option>
                      <option value="commercial">Commercial</option>
                      <option value="multifamily">Multifamily</option>
                      <option value="industrial">Industrial</option>
                    </select>
                  </div>
                  <div><Label>Year Built</Label><Input value={newProperty.year_built} onChange={(e) => setNewProperty({ ...newProperty, year_built: e.target.value })} /></div>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Job Number</Label><Input value={details.job_number} onChange={(e) => setDetails({ ...details, job_number: e.target.value })} className="font-mono-num" /></div>
              <div><Label>Job Name</Label><Input value={details.name} onChange={(e) => setDetails({ ...details, name: e.target.value })} placeholder="Smith Residence Roof" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Primary Trade</Label>
                <select
                  value={details.primary_trade}
                  onChange={(e) => setDetails({ ...details, primary_trade: e.target.value as Trade })}
                  className="h-10 w-full rounded-md border bg-[var(--bg-elevated)] px-3 text-sm text-foreground"
                  style={{ borderColor: "var(--border)" }}
                >
                  <option value="">Select…</option>
                  {TRADES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <Label>Job Type</Label>
                <select
                  value={details.job_type}
                  onChange={(e) => setDetails({ ...details, job_type: e.target.value })}
                  className="h-10 w-full rounded-md border bg-[var(--bg-elevated)] px-3 text-sm text-foreground"
                  style={{ borderColor: "var(--border)" }}
                >
                  {["retail", "insurance", "coating", "repair", "recertification", "remodel", "restoration", "new_construction"].map((t) => (
                    <option key={t} value={t}>{t.replace("_", " ")}</option>
                  ))}
                </select>
              </div>
            </div>
            {isInsurance && (
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Claim Number</Label><Input value={details.claim_number} onChange={(e) => setDetails({ ...details, claim_number: e.target.value })} /></div>
                <div><Label>Insurance Carrier</Label><Input value={details.insurance_carrier} onChange={(e) => setDetails({ ...details, insurance_carrier: e.target.value })} /></div>
              </div>
            )}
            <div><Label>Notes</Label><Textarea value={details.notes} onChange={(e) => setDetails({ ...details, notes: e.target.value })} rows={3} /></div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4 text-sm">
            <Row label="Job #" value={details.job_number} />
            <Row label="Name" value={details.name} />
            <Row label="Trade" value={details.primary_trade} />
            <Row label="Type" value={details.job_type} />
            <Row label="Property" value={propertyId ? properties.find((p) => p.id === propertyId)?.address ?? "" : newProperty.address} />
            <Row label="Zip" value={propertyZip ?? "—"} />
            <div className="rounded-md border p-3" style={{ borderColor: matchedPriceBook ? "var(--success)" : "var(--warning)", backgroundColor: "var(--bg-card)" }}>
              {matchedPriceBook ? (
                <p className="text-xs"><span className="font-semibold text-[var(--success)]">Price book matched:</span> {matchedPriceBook.name}</p>
              ) : (
                <p className="text-xs text-[var(--warning)]">No active price book found for zip {propertyZip ?? "—"}. Job will be created without one.</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3 | 4) : s))}
          disabled={step === 1}
          className="inline-flex h-9 items-center gap-1 rounded-md border px-4 text-sm font-medium text-foreground disabled:opacity-40"
          style={{ borderColor: "var(--border)" }}
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
        {step < 4 ? (
          <button
            onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3 | 4)}
            disabled={(step === 1 && !canStep1) || (step === 2 && !canStep2) || (step === 3 && !canStep3)}
            className="btn-brand inline-flex h-9 items-center gap-1 rounded-md px-4 text-sm font-semibold disabled:opacity-40"
          >
            Next <ArrowRight className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            onClick={handleCreate}
            disabled={submitting}
            className="btn-chrome inline-flex h-9 items-center gap-1 rounded-md px-4 text-sm font-semibold disabled:opacity-40"
          >
            {submitting ? "Creating…" : "Create Job"}
          </button>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b py-2 last:border-0" style={{ borderColor: "var(--border)" }}>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value || "—"}</span>
    </div>
  );
}
