import { useMemo, useState } from "react";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Home, Building2, Sofa } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CbSurface } from "@/components/cb/CbSurface";
import { CbCard, CbButton, CbBadge, CbLoading } from "@/components/cb/primitives";
import { CbJobStepShell } from "@/components/claim-buddy/CbJobStepShell";
import { cbQueueUpdate } from "@/lib/cbOfflineQueue";
import { cbHaptic } from "@/components/cb/motion";

export const Route = createFileRoute("/cb/job/$id/scope")({
  head: () => ({
    meta: [
      { title: "Choose inspection — Claim Buddy" },
      {
        name: "description",
        content: "Pick roof, exterior or interior scopes for this Claim Buddy inspection.",
      },
      { property: "og:title", content: "Choose inspection — Claim Buddy" },
      { property: "og:description", content: "Step three of the Claim Buddy inspection flow." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CbJobScopePage,
});

type ScopeKey = "roof" | "exterior" | "interior";

const SCOPES: { key: ScopeKey; title: string; body: string; icon: typeof Home; total: number; unit: string }[] = [
  { key: "roof", title: "Roof", body: "Slopes, penetrations, test squares", icon: Home, total: 0, unit: "slopes" },
  { key: "exterior", title: "Exterior", body: "Four elevations, gutters, screens", icon: Building2, total: 4, unit: "elevations" },
  { key: "interior", title: "Interior", body: "Off by default — turn on if there's water inside", icon: Sofa, total: 0, unit: "rooms" },
];

function CbJobScopePage() {
  const { id } = useParams({ from: "/cb/job/$id/scope" });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["cb-job-scope", id],
    queryFn: async () => {
      const [{ data: job, error }, { data: photos }] = await Promise.all([
        supabase.from("cb_jobs").select("id, scopes, status").eq("id", id).maybeSingle(),
        supabase.from("cb_photos").select("category, elevation").eq("job_id", id),
      ]);
      if (error) throw error;
      return { job, photos: photos ?? [] };
    },
  });

  const selected = useMemo<ScopeKey[]>(() => {
    const raw = (data?.job?.scopes ?? []) as unknown;
    return Array.isArray(raw) ? (raw as ScopeKey[]) : [];
  }, [data]);

  function progressFor(key: ScopeKey): string | null {
    const photos = data?.photos ?? [];
    if (key === "exterior") {
      const done = new Set(
        photos.filter((p) => p.category === "exterior" && p.elevation).map((p) => p.elevation),
      ).size;
      return done > 0 ? `${done} of 4 elevations done` : null;
    }
    const n = photos.filter((p) => p.category === key).length;
    return n > 0 ? `${n} photos captured` : null;
  }

  async function toggle(key: ScopeKey) {
    cbHaptic();
    const next = selected.includes(key) ? selected.filter((s) => s !== key) : [...selected, key];
    setSaving(true);
    const patch: Record<string, unknown> = { scopes: next };
    if (next.length > 0 && data?.job?.status !== "inspecting") patch.status = "inspecting";
    await cbQueueUpdate("cb_jobs", id, patch);
    await qc.invalidateQueries({ queryKey: ["cb-job-scope", id] });
    setSaving(false);
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
      <CbJobStepShell
        step={2}
        jobId={id}
        title="Choose inspection"
        subtitle="Pick any of them, in any order. You can come back and finish later."
      >
        <div className="grid gap-3">
          {SCOPES.map(({ key, title, body, icon: Icon }) => {
            const on = selected.includes(key);
            const progress = progressFor(key);
            return (
              <button
                key={key}
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => void toggle(key)}
                className="text-left"
              >
                <CbCard
                  elevation={on ? "floating" : "card"}
                  className={`cb-scope-card ${on ? "is-selected" : ""}`}
                  style={{ padding: 20 }}
                >
                  <div className="flex items-start gap-4">
                    <span className="cb-scope-icon" aria-hidden>
                      <Icon size={22} strokeWidth={1.6} />
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[17px] font-semibold" style={{ color: "var(--cb-text)" }}>
                          {title}
                        </span>
                        {on ? <CbBadge tone="accent">Selected</CbBadge> : null}
                      </div>
                      <p className="mt-1 text-[13px]" style={{ color: "var(--cb-text-muted)" }}>
                        {body}
                      </p>
                      {progress ? (
                        <p className="mt-2 cb-num text-[12.5px]" style={{ color: "var(--cb-accent)" }}>
                          {title} — {progress}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </CbCard>
              </button>
            );
          })}
        </div>

        <div className="mt-5 grid gap-2">
          <CbButton
            block
            disabled={selected.length === 0}
            loading={saving}
            loadingText="Saving…"
            onClick={() => navigate({ to: "/cb" })}
          >
            {selected.length === 0 ? "Pick at least one" : "Start inspecting"}
          </CbButton>
        </div>
      </CbJobStepShell>
    </CbSurface>
  );
}
