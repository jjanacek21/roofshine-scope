import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CbSurface } from "@/components/cb/CbSurface";
import { CbCard, CbButton, CbLoading } from "@/components/cb/primitives";
import { CbField, focusFirstError, useScrollMemory } from "@/components/cb/forms";
import { CbJobStepShell } from "@/components/claim-buddy/CbJobStepShell";
import { AddressAutocomplete } from "@/components/maps/AddressAutocomplete";
import { CB_CARRIERS } from "@/lib/cbCarriers";
import { cbQueueUpdate } from "@/lib/cbOfflineQueue";

export const Route = createFileRoute("/cb/job/$id/customer")({
  head: () => ({
    meta: [
      { title: "Customer details — Claim Buddy" },
      {
        name: "description",
        content:
          "Capture the homeowner, carrier and claim details for this roof inspection — or skip and start shooting.",
      },
      { property: "og:title", content: "Customer details — Claim Buddy" },
      { property: "og:description", content: "Step one of the Claim Buddy inspection flow." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CbJobCustomerPage,
});

interface JobRow {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  carrier: string | null;
  claim_number: string | null;
  date_of_loss: string | null;
  inspection_date: string | null;
  adjuster_name: string | null;
  adjuster_phone: string | null;
  deductible: number | null;
}

const today = () => new Date().toISOString().slice(0, 10);

function CbJobCustomerPage() {
  const { id } = useParams({ from: "/cb/job/$id/customer" });
  const navigate = useNavigate();
  const formRef = useRef<HTMLDivElement | null>(null);
  useScrollMemory(`cb_customer_${id}`);

  const { data: job, isLoading } = useQuery({
    queryKey: ["cb-job", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("cb_jobs").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as unknown as JobRow | null;
    },
  });

  const [form, setForm] = useState<Partial<JobRow>>({});
  const [carrierQuery, setCarrierQuery] = useState("");
  const [carrierOpen, setCarrierOpen] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!job) return;
    setForm({ ...job, inspection_date: job.inspection_date ?? today() });
    setCarrierQuery(job.carrier ?? "");
  }, [job]);

  const carrierMatches = useMemo(() => {
    const q = carrierQuery.trim().toLowerCase();
    if (!q) return CB_CARRIERS.slice(0, 8);
    return CB_CARRIERS.filter((c) => c.toLowerCase().includes(q)).slice(0, 8);
  }, [carrierQuery]);

  const patch = (p: Partial<JobRow>) => setForm((f) => ({ ...f, ...p }));

  async function persist(): Promise<boolean> {
    const email = (form.customer_email ?? "").trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("That email doesn't look right");
      requestAnimationFrame(() => focusFirstError(formRef.current));
      return false;
    }
    setEmailError(null);
    setSaving(true);
    const { queued } = await cbQueueUpdate("cb_jobs", id, {
      customer_name: form.customer_name || null,
      customer_phone: form.customer_phone || null,
      customer_email: email || null,
      address: form.address || null,
      city: form.city || null,
      state: form.state || null,
      zip: form.zip || null,
      lat: form.lat ?? null,
      lng: form.lng ?? null,
      carrier: carrierQuery.trim() || null,
      claim_number: form.claim_number || null,
      date_of_loss: form.date_of_loss || null,
      inspection_date: form.inspection_date || today(),
      adjuster_name: form.adjuster_name || null,
      adjuster_phone: form.adjuster_phone || null,
      deductible: form.deductible === undefined || form.deductible === null || (form.deductible as unknown as string) === "" ? null : Number(form.deductible),
    });
    setSaving(false);
    if (queued) toast.info("Saved on this device — it'll sync when you're back online.");
    return true;
  }

  if (isLoading) {
    return (
      <CbSurface>
        <div className="min-h-screen px-5 py-16" style={{ background: "var(--cb-bg)" }}>
          <div className="mx-auto max-w-[620px]">
            <CbLoading label="Opening the inspection…" />
          </div>
        </div>
      </CbSurface>
    );
  }

  return (
    <CbSurface>
      <CbJobStepShell
        step={0}
        jobId={id}
        title="Customer"
        subtitle="An address alone is enough to start. We'll nudge for the rest at Review."
      >
        <div ref={formRef} className="grid gap-4">
          <CbCard elevation="raised" style={{ padding: 20 }}>
            <span className="cb-microlabel">Homeowner</span>
            <div className="mt-3 grid gap-3">
              <CbField
                label="Homeowner name"
                value={form.customer_name ?? ""}
                onChange={(e) => patch({ customer_name: e.target.value })}
              />
              <CbField
                label="Phone"
                type="tel"
                inputMode="tel"
                value={form.customer_phone ?? ""}
                onChange={(e) => patch({ customer_phone: e.target.value })}
              />
              <CbField
                label="Email"
                type="email"
                inputMode="email"
                error={emailError}
                value={form.customer_email ?? ""}
                onChange={(e) => patch({ customer_email: e.target.value })}
              />
            </div>
          </CbCard>

          <CbCard elevation="raised" style={{ padding: 20 }}>
            <span className="cb-microlabel">Property address</span>
            <div className="mt-3">
              <AddressAutocomplete
                value={form.address ?? ""}
                placeholder="Start typing the address…"
                onSelect={(r) =>
                  patch({
                    address: r.address,
                    city: r.city,
                    state: r.state,
                    zip: r.zip,
                    lat: r.lat,
                    lng: r.lng,
                  })
                }
              />
            </div>
            <div className="mt-3 grid gap-3 grid-cols-1 sm:grid-cols-[1.4fr_.6fr_.8fr]">
              <CbField
                label="City"
                value={form.city ?? ""}
                onChange={(e) => patch({ city: e.target.value })}
              />
              <CbField
                label="State"
                value={form.state ?? ""}
                onChange={(e) => patch({ state: e.target.value.toUpperCase() })}
              />
              <CbField
                label="ZIP"
                inputMode="numeric"
                value={form.zip ?? ""}
                onChange={(e) => patch({ zip: e.target.value })}
              />
            </div>
          </CbCard>

          <CbCard elevation="raised" style={{ padding: 20 }}>
            <span className="cb-microlabel">Claim</span>
            <div className="mt-3 grid gap-3">
              <div className="relative">
                <CbField
                  label="Insurance carrier"
                  value={carrierQuery}
                  onChange={(e) => {
                    setCarrierQuery(e.target.value);
                    setCarrierOpen(true);
                  }}
                  onFocus={() => setCarrierOpen(true)}
                  onBlur={() => setTimeout(() => setCarrierOpen(false), 160)}
                  hint="Pick one or type your own"
                />
                {carrierOpen && carrierMatches.length > 0 ? (
                  <div className="cb-carrier-menu">
                    {carrierMatches.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setCarrierQuery(c);
                          setCarrierOpen(false);
                        }}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <CbField
                label="Claim number"
                value={form.claim_number ?? ""}
                onChange={(e) => patch({ claim_number: e.target.value })}
              />
              <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <CbField
                  label="Date of loss"
                  type="date"
                  value={form.date_of_loss ?? ""}
                  onChange={(e) => patch({ date_of_loss: e.target.value })}
                />
                <CbField
                  label="Inspection date"
                  type="date"
                  value={form.inspection_date ?? today()}
                  onChange={(e) => patch({ inspection_date: e.target.value })}
                />
              </div>
              <div className="grid gap-3" style={{ gridTemplateColumns: "1fr 1fr" }}>
                <CbField
                  label="Adjuster name"
                  value={form.adjuster_name ?? ""}
                  onChange={(e) => patch({ adjuster_name: e.target.value })}
                />
                <CbField
                  label="Adjuster phone"
                  type="tel"
                  inputMode="tel"
                  value={form.adjuster_phone ?? ""}
                  onChange={(e) => patch({ adjuster_phone: e.target.value })}
                />
              </div>
              <CbField
                label="Deductible"
                inputMode="decimal"
                value={form.deductible === null || form.deductible === undefined ? "" : String(form.deductible)}
                onChange={(e) =>
                  patch({ deductible: e.target.value === "" ? null : (e.target.value as unknown as number) })
                }
              />
            </div>
          </CbCard>

          <div className="grid gap-2 pt-1">
            <CbButton
              block
              variant="ghost"
              onClick={() => navigate({ to: "/cb/job/$id/cover", params: { id } })}
            >
              Skip — I'll add this later
            </CbButton>
          </div>
          <div aria-hidden className="cb-has-dock" />
          <div className="cb-dock">
            <CbButton
              block
              loading={saving}
              loadingText="Saving…"
              onClick={async () => {
                if (await persist()) navigate({ to: "/cb/job/$id/cover", params: { id } });
              }}
            >
              Continue to cover photo
            </CbButton>
          </div>
        </div>
      </CbJobStepShell>
    </CbSurface>
  );
}
