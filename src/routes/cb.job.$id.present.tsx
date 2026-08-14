import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Home, MapPin, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CbSurface } from "@/components/cb/CbSurface";
import { CbCard, CbButton, CbChip, CbLoading } from "@/components/cb/primitives";
import { CbCountUp, CbHeadline, CbReveal, usePrefersReducedMotion } from "@/components/cb/motion";
import { useCbLogoUrl } from "@/lib/cbLogo";
import { CB_ELEVATION_LABEL, type CbElevation, type CbElevationState } from "@/lib/cbTakeoff";
import { buildCbDeck, type CbPropertyDeckData, type CbSection, type CbSlide } from "@/lib/cbDeck";
import type { CbCompany } from "@/components/auth/CbCompanyProvider";

export const Route = createFileRoute("/cb/job/$id/present")({
  head: () => ({
    meta: [
      { title: "Presentation — Claim Buddy" },
      {
        name: "description",
        content:
          "The sit-down presentation: who we are, how the claim works, what we found on this roof and what happens next.",
      },
      { property: "og:title", content: "Presentation — Claim Buddy" },
      { property: "og:description", content: "Walk the homeowner through the claim, start to finish." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CbPresentPage,
});

const money = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function longDate(v: string | null | undefined) {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

/* ------------------------------- data ------------------------------- */

function usePresentData(jobId: string) {
  return useQuery({
    queryKey: ["cb-present", jobId],
    queryFn: async () => {
      const { data: job, error } = await supabase.from("cb_jobs").select("*").eq("id", jobId).maybeSingle();
      if (error) throw error;
      if (!job) return null;

      const [companyRes, measureRes, reportRes, photosRes, takeoffRes] = await Promise.all([
        supabase.from("cb_companies").select("*").eq("id", job.company_id).maybeSingle(),
        supabase.from("cb_measurements").select("*").eq("job_id", jobId).maybeSingle(),
        supabase
          .from("cb_reports")
          .select("line_items, narrative, version")
          .eq("job_id", jobId)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from("cb_photos").select("id", { count: "exact", head: true }).eq("job_id", jobId),
        supabase.from("cb_takeoffs").select("elevations, data").eq("job_id", jobId).maybeSingle(),
      ]);

      /* Opening the deck is the moment the sit-down happens. */
      if (job.status !== "presented" && job.status !== "signed") {
        await supabase.from("cb_jobs").update({ status: "presented" }).eq("id", jobId);
      }

      return {
        job,
        company: (companyRes.data ?? null) as (CbCompany & Record<string, unknown>) | null,
        measurement: measureRes.data,
        report: reportRes.data,
        photoCount: photosRes.count ?? 0,
        takeoff: takeoffRes.data,
      };
    },
  });
}

function buildFindings(
  elevations: Partial<Record<CbElevation, CbElevationState>>,
  photoCount: number,
): string[] {
  const out: string[] = [];
  let totalHits = 0;
  let damaged = 0;
  for (const [key, state] of Object.entries(elevations ?? {})) {
    const el = key as CbElevation;
    const s = (state ?? {}) as CbElevationState;
    const hits = (s.testSquares ?? []).reduce((a, t) => a + (Number(t.hits) || 0), 0);
    totalHits += hits;
    const items = Object.values(s.items ?? {}).filter((i) => i && (i as { checked?: boolean }).checked !== false).length;
    if (hits > 0 || items > 0) {
      damaged += 1;
      out.push(
        `${CB_ELEVATION_LABEL[el] ?? el} — ${hits > 0 ? `${hits} hits in the test square` : "damage documented"}${
          items > 0 ? `, ${items} item${items === 1 ? "" : "s"} affected` : ""
        }`,
      );
    } else if (s.cleared) {
      out.push(`${CB_ELEVATION_LABEL[el] ?? el} — inspected, no damage observed`);
    }
  }
  if (totalHits > 0) out.unshift(`${totalHits} documented hail impacts across ${damaged} elevation${damaged === 1 ? "" : "s"}`);
  if (photoCount > 0) out.push(`${photoCount} photographs supporting the findings`);
  return out.slice(0, 6);
}

/* ------------------------------- page ------------------------------- */

function CbPresentPage() {
  const { id } = useParams({ from: "/cb/job/$id/present" });
  const navigate = useNavigate();
  const { data, isLoading } = usePresentData(id);
  const reduced = usePrefersReducedMotion();

  const [sectionIdx, setSectionIdx] = useState<number | null>(null);
  const [slideIdx, setSlideIdx] = useState(0);

  const logoUrl = useCbLogoUrl(data?.company?.logo_url ?? null);
  /* Team photos live alongside logos in the private cb-logos bucket. */
  const teamPhotoUrl = useCbLogoUrl((data?.company?.team_photo_url as string) ?? null);

  const property: CbPropertyDeckData = useMemo(() => {
    const job = data?.job;
    const lineItems = Array.isArray(data?.report?.line_items) ? (data!.report!.line_items as unknown[]) : [];
    const narrative = (data?.report?.narrative ?? {}) as { summary?: string };
    const elevations = (data?.takeoff?.elevations ?? {}) as Partial<Record<CbElevation, CbElevationState>>;
    return {
      address: [job?.address, job?.city, job?.state].filter(Boolean).join(", "),
      carrier: job?.carrier ?? null,
      dateOfLoss: job?.date_of_loss ?? null,
      claimNumber: job?.claim_number ?? null,
      deductible: job?.deductible ?? null,
      squares: Number(data?.measurement?.total_squares ?? 0) || 0,
      lineItemCount: lineItems.length,
      photoCount: data?.photoCount ?? 0,
      findings: buildFindings(elevations, data?.photoCount ?? 0),
      summary: narrative.summary?.trim() || null,
    };
  }, [data]);

  const sections = useMemo(
    () =>
      buildCbDeck(
        (data?.company ?? null) as CbCompany | null,
        data?.company
          ? {
              about_headline: (data.company.about_headline as string) ?? null,
              about_story: (data.company.about_story as string) ?? null,
              founded_year: (data.company.founded_year as number) ?? null,
              team_photo_url: (data.company.team_photo_url as string) ?? null,
              service_areas: data.company.service_areas,
            }
          : null,
        teamPhotoUrl,
        property,
      ),
    [data?.company, teamPhotoUrl, property],
  );

  const section = sectionIdx === null ? null : sections[sectionIdx];
  const slide = section?.slides[slideIdx] ?? null;

  const go = useCallback(
    (dir: 1 | -1) => {
      if (sectionIdx === null || !section) return;
      const next = slideIdx + dir;
      if (next >= 0 && next < section.slides.length) {
        setSlideIdx(next);
        return;
      }
      const nextSection = sectionIdx + dir;
      if (nextSection < 0) {
        setSectionIdx(null);
        return;
      }
      if (nextSection >= sections.length) return;
      setSectionIdx(nextSection);
      setSlideIdx(dir === 1 ? 0 : Math.max(0, sections[nextSection].slides.length - 1));
    },
    [sectionIdx, slideIdx, section, sections],
  );

  const jumpToProperty = useCallback(() => {
    const i = sections.findIndex((s) => s.id === "next-steps");
    if (i >= 0) {
      setSectionIdx(i);
      setSlideIdx(Math.max(0, sections[i].slides.length - 1));
    }
  }, [sections]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        go(-1);
      } else if (e.key === "Escape") {
        setSectionIdx(null);
      } else if (e.key.toLowerCase() === "p") {
        jumpToProperty();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, jumpToProperty]);

  /* Swipe */
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6) go(dx < 0 ? 1 : -1);
  };

  if (isLoading) {
    return (
      <CbSurface>
        <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--cb-bg)" }}>
          <CbLoading label="Loading the presentation…" />
        </div>
      </CbSurface>
    );
  }

  if (!data) {
    return (
      <CbSurface>
        <div className="flex min-h-screen items-center px-6" style={{ background: "var(--cb-bg)" }}>
          <CbCard elevation="raised" className="mx-auto" style={{ padding: 26, maxWidth: 460 }}>
            <h1 className="cb-display" style={{ fontSize: 22, margin: 0 }}>
              Job not found
            </h1>
            <CbButton className="mt-4" block onClick={() => navigate({ to: "/cb" })}>
              Back to jobs
            </CbButton>
          </CbCard>
        </div>
      </CbSurface>
    );
  }

  return (
    <CbSurface>
      <div className="cb-present" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {/* Chrome */}
        <header className="cb-present-bar">
          <div className="flex min-w-0 items-center gap-3">
            {sectionIdx !== null ? (
              <button className="cb-present-icon" aria-label="Back to menu" onClick={() => setSectionIdx(null)}>
                <Home size={20} />
              </button>
            ) : null}
            {logoUrl ? (
              <img src={logoUrl} alt={`${data.company?.name ?? "Company"} logo`} className="cb-present-logo" />
            ) : (
              <span className="cb-present-company">{data.company?.name ?? "Claim Buddy"}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <CbButton size="md" variant="ghost" onClick={jumpToProperty}>
              <MapPin size={18} /> <span className="hidden sm:inline">Jump to my property</span>
            </CbButton>
            <button className="cb-present-icon" aria-label="Exit presentation" onClick={() => navigate({ to: "/cb" })}>
              <X size={20} />
            </button>
          </div>
        </header>

        {sectionIdx === null || !section || !slide ? (
          <SectionMenu
            sections={sections}
            address={property.address}
            onPick={(i) => {
              setSectionIdx(i);
              setSlideIdx(0);
            }}
          />
        ) : (
          <>
            <main className="cb-present-stage">
              <div key={`${section.id}-${slide.id}`} className={reduced ? "" : "cb-slide-enter"}>
                {slide.kind === "property" ? (
                  <PropertySlide
                    property={property}
                    companyName={data.company?.name ?? ""}
                    onReport={() => navigate({ to: "/cb/job/$id/report", params: { id }, search: { r: undefined } })}
                    onContract={() => navigate({ to: "/cb/job/$id/contract", params: { id } })}
                  />
                ) : (
                  <StandardSlide slide={slide} />
                )}
              </div>
            </main>

            <footer className="cb-present-foot">
              <button className="cb-present-icon" aria-label="Previous" onClick={() => go(-1)}>
                <ArrowLeft size={20} />
              </button>
              <div className="cb-present-dots" role="tablist" aria-label={`${section.title} slides`}>
                {section.slides.map((s, i) => (
                  <button
                    key={s.id}
                    role="tab"
                    aria-selected={i === slideIdx}
                    aria-label={`Slide ${i + 1}`}
                    className={`cb-present-dot ${i === slideIdx ? "is-on" : ""}`}
                    onClick={() => setSlideIdx(i)}
                  />
                ))}
              </div>
              <span className="cb-present-where">
                {section.index} · {section.title}
              </span>
              <button className="cb-present-icon" aria-label="Next" onClick={() => go(1)}>
                <ArrowRight size={20} />
              </button>
            </footer>
          </>
        )}
      </div>
    </CbSurface>
  );
}

/* ------------------------------ screens ------------------------------ */

function SectionMenu({
  sections,
  address,
  onPick,
}: {
  sections: CbSection[];
  address: string;
  onPick: (i: number) => void;
}) {
  return (
    <main className="cb-present-menu">
      <CbHeadline as="h1" text="Let's walk through it" className="cb-display cb-present-h1" />
      <CbReveal delay={120}>
        <p className="cb-present-sub">{address || "Your property"}</p>
      </CbReveal>
      <div className="cb-present-grid">
        {sections.map((s, i) => (
          <CbReveal key={s.id} delay={140 + i * 45}>
            <CbCard
              elevation="raised"
              tilt
              className="cb-present-menu-card"
              role="button"
              tabIndex={0}
              onClick={() => onPick(i)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onPick(i);
              }}
            >
              <span className="cb-num cb-present-index">{s.index}</span>
              <span className="cb-present-menu-title">{s.title}</span>
              <span className="cb-present-menu-blurb">{s.blurb}</span>
            </CbCard>
          </CbReveal>
        ))}
      </div>
    </main>
  );
}

function StandardSlide({ slide }: { slide: CbSlide }) {
  if (slide.html) return <CbHtmlSlide html={slide.html} />;
  return (
    <div className="cb-slide">

      {slide.kicker ? <p className="cb-present-kicker">{slide.kicker}</p> : null}
      <CbHeadline as="h2" text={slide.title} className="cb-display cb-present-title" />
      {slide.lead ? (
        <CbReveal delay={120}>
          {slide.lead.split(/\n\s*\n/).map((p, i) => (
            <p key={i} className="cb-present-lead">
              {p}
            </p>
          ))}
        </CbReveal>
      ) : null}

      {slide.imageUrl ? (
        <CbReveal delay={160}>
          <img src={slide.imageUrl} alt="Our team" className="cb-present-photo" />
        </CbReveal>
      ) : null}

      {slide.stats?.length ? (
        <div className="cb-present-stats">
          {slide.stats.map((st, i) => (
            <CbReveal key={st.label} delay={180 + i * 70}>
              <CbCard elevation="raised" className="cb-present-stat">
                <span className="cb-present-stat-value">
                  <CbCountUp value={st.value} prefix={st.prefix} suffix={st.suffix} decimals={st.decimals ?? 0} />
                </span>
                <span className="cb-present-stat-label">{st.label}</span>
              </CbCard>
            </CbReveal>
          ))}
        </div>
      ) : null}

      {slide.bullets?.length ? (
        <ul className="cb-present-list">
          {slide.bullets.map((b, i) => (
            <CbReveal key={b} as="li" delay={160 + i * 60}>
              <span className="cb-present-bullet-dot" aria-hidden />
              <span>{b}</span>
            </CbReveal>
          ))}
        </ul>
      ) : null}

      {slide.columns?.length ? (
        <div className="cb-present-cols">
          {slide.columns.map((c, i) => (
            <CbReveal key={c.heading} delay={170 + i * 90}>
              <CbCard elevation="raised" className="cb-present-col">
                <h3 className="cb-present-col-head">{c.heading}</h3>
                <ul>
                  {c.lines.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </CbCard>
            </CbReveal>
          ))}
        </div>
      ) : null}

      {slide.note ? (
        <CbReveal delay={320}>
          <p className="cb-present-note">{slide.note}</p>
        </CbReveal>
      ) : null}
    </div>
  );
}

function PropertySlide({
  property,
  companyName,
  onReport,
  onContract,
}: {
  property: CbPropertyDeckData;
  companyName: string;
  onReport: () => void;
  onContract: () => void;
}) {
  return (
    <div className="cb-slide">
      <p className="cb-present-kicker">Next steps — this property</p>
      <CbHeadline as="h2" text={property.address || "Your property"} className="cb-display cb-present-title" />

      <div className="cb-present-stats">
        <CbReveal delay={120}>
          <CbCard elevation="raised" className="cb-present-stat">
            <span className="cb-present-stat-value">
              <CbCountUp value={property.squares} decimals={1} />
            </span>
            <span className="cb-present-stat-label">Squares of roof</span>
          </CbCard>
        </CbReveal>
        <CbReveal delay={190}>
          <CbCard elevation="raised" className="cb-present-stat">
            <span className="cb-present-stat-value">
              <CbCountUp value={property.lineItemCount} />
            </span>
            <span className="cb-present-stat-label">Scope line items</span>
          </CbCard>
        </CbReveal>
        <CbReveal delay={260}>
          <CbCard elevation="raised" className="cb-present-stat">
            <span className="cb-present-stat-value">
              <CbCountUp value={property.photoCount} />
            </span>
            <span className="cb-present-stat-label">Photos documented</span>
          </CbCard>
        </CbReveal>
      </div>

      <CbReveal delay={300}>
        <CbCard elevation="card" className="cb-present-claim">
          <div>
            <span className="cb-microlabel">Carrier</span>
            <p>{property.carrier ?? "—"}</p>
          </div>
          <div>
            <span className="cb-microlabel">Date of loss</span>
            <p>{longDate(property.dateOfLoss) ?? "—"}</p>
          </div>
          <div>
            <span className="cb-microlabel">Claim number</span>
            <p className="cb-num">{property.claimNumber ?? "—"}</p>
          </div>
        </CbCard>
      </CbReveal>

      {property.findings.length ? (
        <ul className="cb-present-list cb-present-list-tight">
          {property.findings.slice(0, 4).map((f, i) => (
            <CbReveal key={f} as="li" delay={340 + i * 60}>
              <span className="cb-present-bullet-dot" aria-hidden />
              <span>{f}</span>
            </CbReveal>
          ))}
        </ul>
      ) : null}

      <CbReveal delay={520}>
        <CbCard elevation="floating" className="cb-present-deductible">
          <span className="cb-microlabel">Your out of pocket</span>
          <p className="cb-present-deductible-value">
            Your deductible only — <CbCountUp value={property.deductible ?? 0} prefix="$" />
          </p>
          <p className="cb-present-deductible-note">
            {property.deductible
              ? `On an approved claim, ${companyName ? `${companyName} bills` : "we bill"} the carrier for the balance of the approved scope. ${money(
                  property.deductible,
                )} is what you pay.`
              : "Your deductible amount is on your policy declarations page — we'll add it here."}
          </p>
        </CbCard>
      </CbReveal>

      <CbReveal delay={600}>
        <div className="cb-present-cta">
          <CbButton size="lg" onClick={onContract}>
            Sign the agreement
          </CbButton>
          <CbButton size="lg" variant="secondary" onClick={onReport}>
            Open the full report
          </CbButton>
        </div>
      </CbReveal>
    </div>
  );
}
