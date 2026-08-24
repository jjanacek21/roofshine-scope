/**
 * Claim Buddy map mode — the side panel that opens when a rep taps a house.
 * Disposition → resident details → insurance + storm → AI mailer → start inspection.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { X, MapPin, Loader2, Mail, PlayCircle, CloudLightning } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { stormSupabase } from "@/integrations/storm/client";
import { useMapboxToken } from "@/hooks/useMapboxToken";
import { useAuth } from "@/hooks/useAuth";
import { useCbSession } from "@/components/auth/CbSessionProvider";
import { useCbCompany } from "@/components/auth/CbCompanyProvider";
import { CbButton } from "@/components/cb/primitives";
import { CbField } from "@/components/cb/forms";
import { DISPOSITIONS } from "@/components/door-to-door/DispositionQuickBar";
import { StormMailerModal } from "@/components/storm/StormMailerModal";
import { generateLatLngHash, type PropertyData, type PropertyDisposition } from "@/hooks/usePropertyDispositions";

export interface CbMapPoint {
  lat: number;
  lng: number;
  address?: string;
  existingData?: PropertyData;
}

type StormReport = {
  max_hail_in: number | null;
  max_wind_mph: number | null;
  hail_dates: { date: string; size_in: number | null }[];
  wind_dates: { date: string; wind_mph: number | null }[];
};

function fmtDate(d?: string | null) {
  if (!d) return "";
  const dt = new Date(`${d}`.length <= 10 ? `${d}T12:00:00Z` : d);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function CbMapPropertyPanel({
  point,
  onClose,
  onSaved,
}: {
  point: CbMapPoint;
  onClose: () => void;
  onSaved: () => void;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { workspace } = useCbSession();
  const { company } = useCbCompany();
  const { data: token } = useMapboxToken();

  const existing = point.existingData;
  const [disposition, setDisposition] = useState<PropertyDisposition>(
    existing?.disposition ?? "not_contacted",
  );
  const [name, setName] = useState(existing?.customerName ?? "");
  const [phone, setPhone] = useState(existing?.customerPhone ?? "");
  const [email, setEmail] = useState(existing?.customerEmail ?? "");
  const [carrier, setCarrier] = useState("");
  const [claimNumber, setClaimNumber] = useState("");
  const [deductible, setDeductible] = useState("");
  const [stormDate, setStormDate] = useState(existing?.stormDate ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [mailerOpen, setMailerOpen] = useState(false);
  const [propertyId, setPropertyId] = useState<string | null>(null);

  /* Extra insurance fields live on the row but aren't in the map hook's shape. */
  const { data: row } = useQuery({
    queryKey: ["cb-map-disposition", user?.id, point.lat, point.lng],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("property_dispositions")
        .select("*")
        .eq("user_id", user!.id)
        .eq("lat_lng_hash", generateLatLngHash(point.lat, point.lng))
        .maybeSingle();
      return (data ?? null) as Record<string, any> | null;
    },
  });

  useEffect(() => {
    if (!row) return;
    setCarrier(row.carrier ?? "");
    setClaimNumber(row.claim_number ?? "");
    setDeductible(row.deductible != null ? String(row.deductible) : "");
    if (row.storm_date) setStormDate(row.storm_date);
    if (row.customer_name) setName(row.customer_name);
    if (row.customer_phone) setPhone(row.customer_phone);
    if (row.customer_email) setEmail(row.customer_email);
    if (row.notes) setNotes(row.notes);
    if (row.disposition) setDisposition(row.disposition as PropertyDisposition);
  }, [row]);

  /* Reverse-geocode so the panel and the inspection get a real street address. */
  const { data: geo } = useQuery({
    queryKey: ["cb-map-geocode", point.lat.toFixed(6), point.lng.toFixed(6), !!token],
    enabled: !!token,
    staleTime: 24 * 60 * 60 * 1000,
    queryFn: async () => {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${point.lng},${point.lat}.json?types=address&limit=1&access_token=${token}`,
      );
      if (!res.ok) return null;
      const json = await res.json();
      const feat = json?.features?.[0];
      if (!feat) return null;
      const ctx: any[] = feat.context ?? [];
      const pick = (p: string) => ctx.find((c) => String(c.id ?? "").startsWith(p))?.text ?? null;
      return {
        full: String(feat.place_name ?? "").replace(/, United States$/, ""),
        street: [feat.address, feat.text].filter(Boolean).join(" "),
        city: pick("place") as string | null,
        state: pick("region") as string | null,
        zip: pick("postcode") as string | null,
      };
    },
  });

  const addressLabel = geo?.full || point.address || existing?.address || `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;

  const { data: storm, isFetching: stormLoading } = useQuery({
    queryKey: ["cb-map-storm", point.lat.toFixed(5), point.lng.toFixed(5)],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await stormSupabase.rpc("storm_report_at_point" as any, {
        p_lat: point.lat,
        p_lng: point.lng,
      });
      if (error) throw error;
      return (data ?? null) as StormReport | null;
    },
  });

  const topHail = useMemo(() => storm?.hail_dates ?? [], [storm]);
  const topWind = useMemo(() => storm?.wind_dates ?? [], [storm]);

  async function persist(nextDisposition?: PropertyDisposition) {
    if (!user?.id) return null;
    const d = nextDisposition ?? disposition;
    const { data, error } = await supabase
      .from("property_dispositions")
      .upsert(
        {
          user_id: user.id,
          lat: point.lat,
          lng: point.lng,
          lat_lng_hash: generateLatLngHash(point.lat, point.lng),
          address: addressLabel,
          disposition: d,
          customer_name: name || null,
          customer_phone: phone || null,
          customer_email: email || null,
          notes: notes || null,
          carrier: carrier || null,
          claim_number: claimNumber || null,
          deductible: deductible === "" ? null : Number(deductible),
          storm_date: stormDate || null,
          insurance_claim: !!(carrier || claimNumber),
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: "user_id,lat_lng_hash" },
      )
      .select()
      .single();
    if (error) {
      toast.error(error.message || "Couldn't save this house");
      return null;
    }
    onSaved();
    return data;
  }

  async function pickDisposition(d: PropertyDisposition) {
    setDisposition(d);
    await persist(d);
  }

  async function saveDetails() {
    setSaving(true);
    const saved = await persist();
    setSaving(false);
    if (saved) toast.success("Saved");
  }

  async function openMailer() {
    if (!propertyId) {
      const { ensureStormProperty } = await import("@/lib/storm-mailer.functions");
      const res: any = await ensureStormProperty({
        data: {
          lat: point.lat,
          lng: point.lng,
          address: geo?.street || addressLabel,
          city: geo?.city ?? undefined,
          state: geo?.state ?? undefined,
          zip: geo?.zip ?? undefined,
        },
      });
      if (res?.ok) setPropertyId(res.property.id);
    }
    setMailerOpen(true);
  }

  async function startInspection() {
    if (!workspace || !company || !user) {
      toast.error("No Claim Buddy workspace on this account");
      return;
    }
    setStarting(true);
    const saved: any = await persist(disposition === "not_contacted" ? "inspected" : disposition);

    if (saved?.cb_job_id) {
      setStarting(false);
      navigate({ to: "/cb/job/$id/cover", params: { id: saved.cb_job_id } });
      return;
    }

    const { data, error } = await supabase
      .from("cb_jobs")
      .insert({
        workspace_id: workspace.id,
        company_id: company.id,
        created_by: user.id,
        status: "draft",
        customer_name: name || null,
        customer_phone: phone || null,
        customer_email: email || null,
        address: geo?.street || addressLabel,
        city: geo?.city ?? null,
        state: geo?.state ?? null,
        zip: geo?.zip ?? null,
        lat: point.lat,
        lng: point.lng,
        carrier: carrier || null,
        claim_number: claimNumber || null,
        deductible: deductible === "" ? null : Number(deductible),
        date_of_loss: stormDate || null,
        inspection_date: new Date().toISOString().slice(0, 10),
      } as any)
      .select("id")
      .single();

    if (error || !data) {
      setStarting(false);
      toast.error(error?.message ?? "Could not start the inspection");
      return;
    }

    await supabase
      .from("property_dispositions")
      .update({ cb_job_id: data.id, disposition: "inspected" } as any)
      .eq("user_id", user.id)
      .eq("lat_lng_hash", generateLatLngHash(point.lat, point.lng));

    setStarting(false);
    onSaved();
    navigate({ to: "/cb/job/$id/cover", params: { id: data.id } });
  }

  return (
    <>
      <aside
        className="pointer-events-auto flex h-full w-full flex-col overflow-hidden md:w-[420px]"
        style={{ background: "var(--cb-bg, #f6f7f8)", borderLeft: "1px solid var(--cb-hairline, rgba(0,0,0,.12))" }}
      >
        <header
          className="flex items-start gap-3 px-4 py-3"
          style={{ borderBottom: "1px solid var(--cb-hairline, rgba(0,0,0,.12))" }}
        >
          <MapPin className="mt-1 h-4 w-4 shrink-0" style={{ color: "var(--cb-accent)" }} />
          <div className="min-w-0 flex-1">
            <p className="cb-microlabel">Property</p>
            <p className="text-[15px] font-semibold leading-snug">{addressLabel}</p>
          </div>
          <button aria-label="Close" onClick={onClose} className="rounded-full p-1">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-4" style={{ WebkitOverflowScrolling: "touch" }}>
          {/* 1 — Disposition */}
          <p className="cb-microlabel">Disposition</p>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {DISPOSITIONS.map((d) => {
              const Icon = d.icon;
              const active = disposition === d.value;
              return (
                <button
                  key={d.value}
                  onClick={() => void pickDisposition(d.value)}
                  className="flex flex-col items-center gap-1 rounded-[12px] px-1 py-2 text-[11px] font-semibold"
                  style={{
                    border: `1px solid ${active ? d.hexColor : "var(--cb-hairline, rgba(0,0,0,.12))"}`,
                    background: active ? `${d.hexColor}1f` : "var(--cb-surface, #fff)",
                    color: active ? d.hexColor : "inherit",
                  }}
                >
                  <Icon className="h-4 w-4" />
                  <span className="leading-tight">{d.shortLabel}</span>
                </button>
              );
            })}
          </div>

          {/* 2 — Resident details */}
          <p className="cb-microlabel mt-6">Resident details</p>
          <div className="mt-2 space-y-3">
            <CbField label="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <CbField label="Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <CbField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>

          {/* 3 — Insurance + storm */}
          <p className="cb-microlabel mt-6">Insurance</p>
          <div className="mt-2 space-y-3">
            <CbField label="Carrier" value={carrier} onChange={(e) => setCarrier(e.target.value)} />
            <CbField label="Claim number" value={claimNumber} onChange={(e) => setClaimNumber(e.target.value)} />
            <CbField
              label="Deductible"
              type="number"
              inputMode="decimal"
              value={deductible}
              onChange={(e) => setDeductible(e.target.value)}
            />
            <CbField label="Date of loss" type="date" value={stormDate} onChange={(e) => setStormDate(e.target.value)} />
          </div>

          <div
            className="mt-4 rounded-[14px] p-3"
            style={{ background: "var(--cb-surface, #fff)", border: "1px solid var(--cb-hairline, rgba(0,0,0,.12))" }}
          >
            <div className="flex items-center gap-2">
              <CloudLightning className="h-4 w-4" style={{ color: "var(--cb-accent)" }} />
              <p className="cb-microlabel">Recent storm activity</p>
              {stormLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-3 text-[13px]">
              <div>
                <p style={{ color: "var(--cb-text-muted)" }}>Max hail</p>
                <p className="text-[16px] font-semibold">
                  {storm?.max_hail_in != null ? `${storm.max_hail_in.toFixed(2)}"` : "—"}
                </p>
                <div className="mt-1 max-h-40 space-y-[2px] overflow-auto">
                  {topHail.length === 0 && !stormLoading ? (
                    <p style={{ color: "var(--cb-text-muted)" }}>No hail reported for this address.</p>
                  ) : (
                    topHail.map((h) => (
                      <p key={`${h.date}-${h.size_in}`} style={{ color: "var(--cb-text-muted)" }}>
                        {fmtDate(h.date)} {h.size_in != null ? `· ${h.size_in}"` : ""}
                      </p>
                    ))
                  )}
                </div>
              </div>
              <div>
                <p style={{ color: "var(--cb-text-muted)" }}>Peak wind</p>
                <p className="text-[16px] font-semibold">
                  {storm?.max_wind_mph != null ? `${Math.round(storm.max_wind_mph)} mph` : "—"}
                </p>
                <div className="mt-1 max-h-40 space-y-[2px] overflow-auto">
                  {topWind.length === 0 && !stormLoading ? (
                    <p style={{ color: "var(--cb-text-muted)" }}>No 60+ mph winds reported for this address.</p>
                  ) : (
                    topWind.map((w) => (
                      <p key={`${w.date}-${w.wind_mph}`} style={{ color: "var(--cb-text-muted)" }}>
                        {fmtDate(w.date)} {w.wind_mph != null ? `· ${Math.round(w.wind_mph)} mph` : ""}
                      </p>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <CbButton block variant="secondary" onClick={() => void saveDetails()} loading={saving} loadingText="Saving…">
              Save details
            </CbButton>
          </div>

          {/* 4 — AI mailer */}
          <div className="mt-3">
            <CbButton block variant="secondary" onClick={() => void openMailer()}>
              <span className="inline-flex items-center gap-2">
                <Mail className="h-4 w-4" /> Create AI mailer
              </span>
            </CbButton>
          </div>

          {/* 5 — Start inspection */}
          <div className="mt-3 pb-6">
            <CbButton block onClick={() => void startInspection()} loading={starting} loadingText="Opening inspection…">
              <span className="inline-flex items-center gap-2">
                <PlayCircle className="h-4 w-4" /> Start inspection
              </span>
            </CbButton>
          </div>
        </div>
      </aside>

      <StormMailerModal
        open={mailerOpen}
        onClose={() => setMailerOpen(false)}
        address={addressLabel}
        lat={point.lat}
        lng={point.lng}
        propertyId={propertyId}
        roofType={existing?.roofType ?? null}
        math={null}
        stormReport={storm ?? null}
      />
    </>
  );
}
