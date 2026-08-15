import { useMemo } from "react";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Home, Building2, Sofa, Check, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CbSurface } from "@/components/cb/CbSurface";
import { CbCard, CbButton, CbLoading } from "@/components/cb/primitives";
import { CbProgressRail } from "@/components/cb/forms";
import { CbPendingPill } from "@/components/claim-buddy/CbJobStepShell";
import { readSheet, scoreSheet, overallCompleteness } from "@/lib/cbSheet";
import { cbQueueUpdate } from "@/lib/cbOfflineQueue";
import { cbHaptic } from "@/components/cb/motion";

export const Route = createFileRoute("/cb/job/$id/scope")({
  head: () => ({
    meta: [
      { title: "Inspection type — Claim Buddy" },
      {
        name: "description",
        content: "Pick your first pass: exterior, roof or interior, then work them in any order.",
      },
      { property: "og:title", content: "Inspection type — Claim Buddy" },
      { property: "og:description", content: "Step three of the Claim Buddy inspection flow." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CbJobScopePage,
});

type ScopeKey = "roof" | "exterior" | "interior";

const SCOPES: {
  key: ScopeKey;
  title: string;
  body: string;
  icon: typeof Home;
  to: "/cb/job/$id/roof" | "/cb/job/$id/exterior" | "/cb/job/$id/interior";
}[] = [
  {
    key: "exterior",
    title: "Exterior",
    body: "Four elevations, gutters, screens, wraps",
    icon: Building2,
    to: "/cb/job/$id/exterior",
  },
  {
    key: "roof",
    title: "Roof",
    body: "Every slope wide, test squares, hardware takeoff, instant measurement",
    icon: Home,
    to: "/cb/job/$id/roof",
  },
  {
    key: "interior",
    title: "Interior",
    body: "Only if water made it inside — rooms, ceilings, moisture",
    icon: Sofa,
    to: "/cb/job/$id/interior",
  },
];

function Ring({ pct }: { pct: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden style={{ flexShrink: 0 }}>
      <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" stroke="var(--cb-border)" />
      <circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        strokeWidth="6"
        stroke="var(--cb-accent)"
        strokeLinecap="round"
        strokeDasharray={`${(c * pct) / 100} ${c}`}
        transform="rotate(-90 32 32)"
      />
      <text
        x="32"
        y="37"
        textAnchor="middle"
        fontSize="15"
        fontWeight="700"
        fill="var(--cb-text)"
        className="cb-num"
      >
        {pct}%
      </text>
    </svg>
  );
}

function CbJobScopePage() {
  const { id } = useParams({ from: "/cb/job/$id/scope" });
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["cb-job-scope", id],
    queryFn: async () => {
      const [{ data: job, error }, { data: photos }, { data: takeoff }, { data: measurement }] =
        await Promise.all([
          supabase.from("cb_jobs").select("id, scopes, status").eq("id", id).maybeSingle(),
          supabase.from("cb_photos").select("category, elevation").eq("job_id", id),
          supabase.from("cb_takeoffs").select("data, elevations").eq("job_id", id).maybeSingle(),
          supabase.from("cb_measurements").select("squares").eq("job_id", id).maybeSingle(),
        ]);
      if (error) throw error;
      return {
        job,
        photos: photos ?? [],
        takeoff: takeoff ?? null,
        squares: Number((measurement as { squares?: number } | null)?.squares ?? 0),
      };
    },
  });

  const photos = data?.photos ?? [];
  const sheet = useMemo(
    () => readSheet((data?.takeoff?.data ?? {}) as Record<string, unknown>),
    [data],
  );
  const pct = useMemo(
    () => overallCompleteness(scoreSheet(sheet, data?.squares ?? 0)),
    [sheet, data],
  );

  function statusFor(key: ScopeKey): { done: boolean; note: string | null } {
    const shots = photos.filter((p) => p.category === key).length;
    if (key === "exterior") {
      const elevations = new Set(
        photos.filter((p) => p.category === "exterior" && p.elevation).map((p) => p.elevation),
      ).size;
      const takeoffLines = Object.keys(sheet.exterior ?? {}).length;
      return {
        done: elevations >= 4,
        note: elevations
          ? `${elevations} of 4 elevations · ${takeoffLines} takeoff ${takeoffLines === 1 ? "area" : "areas"}`
          : null,
      };
    }
    if (key === "roof") {
      const slopes = new Set(
        photos.filter((p) => p.category === "roof" && p.elevation).map((p) => p.elevation),
      ).size;
      return {
        done: slopes >= 4,
        note: shots ? `${shots} photos · ${slopes} of 4 slopes` : null,
      };
    }
    const rooms = Object.keys(sheet.interior ?? {}).length;
    return {
      done: rooms > 0 && shots > 0,
      note: rooms ? `${rooms} ${rooms === 1 ? "room" : "rooms"} · ${shots} photos` : null,
    };
  }

  async function open(key: ScopeKey, to: (typeof SCOPES)[number]["to"]) {
    cbHaptic();
    const raw = (data?.job?.scopes ?? []) as unknown;
    const current = Array.isArray(raw) ? (raw as ScopeKey[]) : [];
    if (!current.includes(key)) {
      const patch: Record<string, unknown> = { scopes: [...current, key] };
      if (data?.job?.status !== "inspecting") patch.status = "inspecting";
      void cbQueueUpdate("cb_jobs", id, patch);
    }
    navigate({ to, params: { id } });
  }

  if (isLoading) {
    return (
      <CbSurface>
        <div className="min-h-screen px-5 py-16" style={{ background: "var(--cb-bg)" }}>
          <div className="mx-auto max-w-[620px]">
            <CbLoading label="Loading the inspection…" />
          </div>
        </div>
      </CbSurface>
    );
  }

  return (
    <CbSurface>
      <div className="min-h-screen px-4 pb-32 pt-6" style={{ background: "var(--cb-bg)" }}>
        <div className="mx-auto w-full max-w-[620px]">
          <CbProgressRail
            steps={["Customer", "Cover photo", "Inspection", "Report"]}
            current={2}
          />

          <div className="mt-5 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4">
            <Ring pct={pct} />
            <div className="min-w-0">
              <h1 className="cb-display" style={{ fontSize: 24, margin: 0 }}>
                Pick your first pass
              </h1>
              <p className="mt-1 text-[13.5px]" style={{ color: "var(--cb-text-muted)" }}>
                Any order. Come back to this screen after each one.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            {SCOPES.map(({ key, title, body, icon: Icon, to }) => {
              const { done, note } = statusFor(key);
              return (
                <button key={key} type="button" onClick={() => void open(key, to)} className="text-left">
                  <CbCard
                    elevation={done ? "floating" : "card"}
                    className={`cb-scope-card ${done ? "is-selected" : ""}`}
                    style={{ padding: 20 }}
                  >
                    <div className="flex items-start gap-4">
                      <span className="cb-scope-icon" aria-hidden>
                        <Icon size={22} strokeWidth={1.6} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-[17px] font-semibold"
                            style={{ color: "var(--cb-text)" }}
                          >
                            {title}
                          </span>
                          {done ? (
                            <span className="cb-chip" style={{ color: "var(--cb-accent)" }}>
                              <Check size={13} className="mr-1 inline" />
                              DONE
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-[13px]" style={{ color: "var(--cb-text-muted)" }}>
                          {body}
                        </p>
                        {note ? (
                          <p
                            className="mt-2 cb-num text-[12.5px]"
                            style={{ color: "var(--cb-accent)" }}
                          >
                            {note}
                          </p>
                        ) : null}
                      </div>
                      <ChevronRight
                        size={20}
                        aria-hidden
                        style={{ color: "var(--cb-text-muted)", flexShrink: 0 }}
                      />
                    </div>
                  </CbCard>
                </button>
              );
            })}
          </div>

          <p className="mt-4 text-[13px]" style={{ color: "var(--cb-text-muted)" }}>
            Photo count so far: <span className="cb-num">{photos.length}</span>. Nothing is lost if
            you close the app.
          </p>

          <div aria-hidden className="cb-has-dock" />
          <div className="cb-dock">
            <div className="mx-auto flex w-full max-w-[620px] items-center gap-2">
              <CbButton
                block
                onClick={() => navigate({ to: "/cb/job/$id/review", params: { id } })}
              >
                Review takeoff
              </CbButton>
              <CbButton variant="ghost" size="md" onClick={() => navigate({ to: "/cb" })}>
                Save &amp; exit
              </CbButton>
            </div>
          </div>
        </div>
        <CbPendingPill />
      </div>
    </CbSurface>
  );
}
