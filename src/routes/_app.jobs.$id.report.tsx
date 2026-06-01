import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  FileDown,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Trash2,
  GripVertical,
  Sparkles,
  Upload,
  Video,
  Image as ImageIcon,
  Type,
  Minus,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "@/integrations/supabase/client";
import { useMapboxToken } from "@/hooks/useMapboxToken";
import { useProfile } from "@/hooks/useProfile";
import { getTradeLabel } from "@/lib/trades";
import {
  BUILT_IN_LABEL,
  CUSTOM_LABEL,
  defaultSections,
  newSection,
  type ReportSection,
  type SectionType,
} from "@/lib/report-sections";
import { AIBlockDialog } from "@/components/report/AIBlockDialog";
import { uploadReportAsset, useSignedUrls } from "@/components/report/asset-utils";
import { renderSectionsToPdf, addVideoAnnotation, uploadAndRegisterPdf } from "@/lib/report-pdf";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/jobs/$id/report")({
  component: JobReport,
});

type JobRow = {
  id: string;
  company_id: string;
  name: string;
  job_number: string | null;
  job_type: string | null;
  property_address: string | null;
  property_id: string | null;
  client_id: string | null;
  primary_trade: string | null;
  assigned_to: string | null;
  created_by: string | null;
};

function JobReport() {
  const { id: jobId } = Route.useParams();
  const { data: mapboxToken } = useMapboxToken();
  const { data: meProfile } = useProfile();
  const [hidePricing, setHidePricing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [sections, setSections] = useState<ReportSection[]>(() => defaultSections());
  const [reportRowId, setReportRowId] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState<null | "cover_letter" | "flyer" | "infographic" | "cover_photo">(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const { data: job } = useQuery({
    queryKey: ["job", jobId],
    queryFn: async () => {
      const { data } = await supabase.from("jobs").select("*").eq("id", jobId).maybeSingle();
      return data as JobRow | null;
    },
  });

  // Load or initialize job_reports row
  useEffect(() => {
    if (!job) return;
    (async () => {
      const { data } = await supabase
        .from("job_reports")
        .select("id, sections")
        .eq("job_id", jobId)
        .maybeSingle();
      if (data) {
        setReportRowId(data.id);
        const arr = (data.sections as unknown as ReportSection[]) ?? [];
        if (arr.length) setSections(arr);
      } else {
        const { data: ins } = await supabase
          .from("job_reports")
          .insert({
            job_id: jobId,
            company_id: job.company_id,
            rep_user_id: job.assigned_to ?? job.created_by ?? null,
            sections: defaultSections() as any,
          } as any)
          .select("id")
          .single();
        if (ins) setReportRowId(ins.id);
      }
    })();
  }, [job, jobId]);

  // Auto-save (debounced)
  useEffect(() => {
    if (!reportRowId) return;
    const t = setTimeout(async () => {
      await supabase
        .from("job_reports")
        .update({ sections: sections as any })
        .eq("id", reportRowId);
    }, 800);
    return () => clearTimeout(t);
  }, [sections, reportRowId]);

  const { data: company } = useQuery({
    queryKey: ["report-company", job?.company_id],
    enabled: !!job?.company_id,
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("*").eq("id", job!.company_id).maybeSingle();
      return data;
    },
  });

  const { data: rep } = useQuery({
    queryKey: ["report-rep", job?.assigned_to ?? job?.created_by],
    enabled: !!(job?.assigned_to ?? job?.created_by),
    queryFn: async () => {
      const repId = job?.assigned_to ?? job?.created_by;
      const { data } = await supabase
        .from("profiles")
        .select("first_name, last_name, email, mobile_phone, office_phone, title, avatar_url")
        .eq("id", repId!)
        .maybeSingle();
      return data;
    },
  });

  const { data: client } = useQuery({
    queryKey: ["report-client", job?.client_id],
    enabled: !!job?.client_id,
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("*").eq("id", job!.client_id!).maybeSingle();
      return data;
    },
  });

  const { data: property } = useQuery({
    queryKey: ["report-property", job?.property_id],
    enabled: !!job?.property_id,
    queryFn: async () => {
      const { data } = await supabase.from("properties").select("*").eq("id", job!.property_id!).maybeSingle();
      return data;
    },
  });

  const { data: estimates = [] } = useQuery({
    queryKey: ["report-estimates", jobId],
    queryFn: async () => {
      const { data } = await supabase.from("estimates").select("*").eq("job_id", jobId).order("created_at");
      return data ?? [];
    },
  });
  const primaryEstimate = estimates[0] ?? null;

  const { data: lineItems = [] } = useQuery({
    queryKey: ["report-items", primaryEstimate?.id],
    enabled: !!primaryEstimate,
    queryFn: async () => {
      const { data } = await supabase
        .from("estimate_line_items")
        .select("*")
        .eq("estimate_id", primaryEstimate!.id)
        .order("sort_order");
      return data ?? [];
    },
  });

  const { data: photos = [] } = useQuery({
    queryKey: ["report-photos", jobId],
    queryFn: async () => {
      const { data } = await supabase.from("job_photos").select("*").eq("job_id", jobId).order("created_at");
      return data ?? [];
    },
  });

  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!photos.length) return;
    (async () => {
      const map: Record<string, string> = {};
      for (const p of photos.slice(0, 8)) {
        const { data } = await supabase.storage.from("roof-photos").createSignedUrl(p.storage_path, 3600);
        if (data?.signedUrl) map[p.id] = data.signedUrl;
      }
      setPhotoUrls(map);
    })();
  }, [photos]);

  const { data: measurement } = useQuery({
    queryKey: ["report-measurement", job?.property_id],
    enabled: !!job?.property_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("roof_measurements")
        .select("*")
        .eq("property_id", job!.property_id!)
        .maybeSingle();
      return data;
    },
  });

  const damageRows = useMemo(() => {
    type D = { severity: string; finding: string; location: string };
    const rows: D[] = [];
    for (const p of photos) {
      const a = (p.ai_analysis ?? {}) as Record<string, unknown>;
      const sev = (a.severity as string) ?? null;
      const defects = (a.observed_defects as string[]) ?? [];
      const loc = (p.tag as string) ?? "—";
      for (const d of defects) rows.push({ severity: sev ?? "minor", finding: d, location: loc });
    }
    return rows;
  }, [photos]);

  // Signed URLs for custom block assets (images, videos, uploaded docs)
  const assetUrls = useSignedUrls(
    sections.map((s) =>
      s.props.storagePath ? { bucket: s.props.bucket, path: s.props.storagePath } : null,
    ),
  );

  const subtotal = lineItems.reduce((s, i) => s + Number(i.qty) * Number(i.unit_price), 0);
  const markup = (subtotal * Number(primaryEstimate?.markup_pct ?? 0)) / 100;
  const overhead = (subtotal * Number(primaryEstimate?.overhead_pct ?? 0)) / 100;
  const profit = (subtotal * Number(primaryEstimate?.profit_pct ?? 0)) / 100;
  const beforeTax = subtotal + markup + overhead + profit;
  const tax = (beforeTax * Number(primaryEstimate?.tax_pct ?? 0)) / 100;
  const calcTotal = beforeTax + tax;
  const useManualTotal = Boolean((primaryEstimate as any)?.use_manual_total);
  const manualTotal = Number((primaryEstimate as any)?.manual_total ?? 0);
  const grandTotal = useManualTotal ? manualTotal : calcTotal;

  const itemsByTrade = useMemo(() => {
    const map = new Map<string, typeof lineItems>();
    for (const i of lineItems) {
      if (!map.has(i.trade)) map.set(i.trade, []);
      map.get(i.trade)!.push(i);
    }
    return Array.from(map.entries());
  }, [lineItems]);

  const staticMapUrl = useMemo(() => {
    if (!mapboxToken || !property?.lat || !property?.lng) return null;
    return `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${property.lng},${property.lat},19,0/720x360@2x?access_token=${mapboxToken}`;
  }, [mapboxToken, property]);

  // ---------- section mutators ----------
  const updateSection = (id: string, patch: Partial<ReportSection>) =>
    setSections((arr) => arr.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const updateProps = (id: string, patch: Partial<ReportSection["props"]>) =>
    setSections((arr) => arr.map((s) => (s.id === id ? { ...s, props: { ...s.props, ...patch } } : s)));
  const removeSection = (id: string) => setSections((arr) => arr.filter((s) => s.id !== id));
  const addSection = (type: SectionType, partial?: Partial<ReportSection>) =>
    setSections((arr) => [...arr, newSection(type, partial)]);
  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setSections((arr) => {
      const oldI = arr.findIndex((s) => s.id === active.id);
      const newI = arr.findIndex((s) => s.id === over.id);
      return arrayMove(arr, oldI, newI);
    });
  };

  const handleUpload = async (file: File, kind: "upload" | "video") => {
    if (!job) return;
    const t = toast.loading("Uploading…");
    try {
      const asset = await uploadReportAsset({ file, companyId: job.company_id, jobId, kind });
      addSection(kind === "video" ? "embedded_video" : "uploaded_doc", {
        title: file.name,
        props: {
          assetId: asset.id,
          storagePath: asset.storage_path,
          bucket: asset.bucket,
          mimeType: asset.mime_type,
        },
      });
      toast.dismiss(t);
      toast.success("Added to report");
    } catch (e) {
      toast.dismiss(t);
      toast.error(e instanceof Error ? e.message : "Upload failed");
    }
  };

  const handleGenerate = async () => {
    if (!job) return;
    setGenerating(true);
    const t = toast.loading("Generating PDF…");
    try {
      const els = sections
        .filter((s) => s.visible)
        .map((s) => sectionRefs.current[s.id])
        .filter((e): e is HTMLDivElement => !!e);

      const { doc, pageMap } = await renderSectionsToPdf(els);

      // Attach embedded videos
      for (let i = 0; i < pageMap.length; i++) {
        const el = pageMap[i].sectionEl;
        const sectId = el.dataset.sectionId;
        const s = sections.find((x) => x.id === sectId);
        if (!s || s.type !== "embedded_video" || !s.props.storagePath) continue;
        const bucket = s.props.bucket ?? "report-assets";
        // Fetch video bytes (small files only — large videos remain as fallback URL only)
        const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(s.props.storagePath, 3600 * 24 * 7);
        const url = signed?.signedUrl;
        if (!url) continue;
        let videoBytes: Uint8Array | null = null;
        try {
          const head = await fetch(url, { method: "HEAD" });
          const len = Number(head.headers.get("content-length") ?? 0);
          if (len > 0 && len < 25_000_000) {
            const r = await fetch(url);
            videoBytes = new Uint8Array(await r.arrayBuffer());
          }
        } catch {}
        const pm = pageMap[i];
        if (videoBytes) {
          await addVideoAnnotation(doc, {
            pageIndex: pm.pageIndex,
            x: pm.x,
            y: pm.y - pm.drawH, // y already accounted; passing top-down style is handled inside
            width: pm.drawW,
            height: pm.drawH,
            posterBytes: new Uint8Array(),
            posterMime: "image/jpeg",
            videoBytes,
            videoMime: s.props.mimeType ?? "video/mp4",
            fallbackUrl: url,
          });
        }
      }

      const bytes = await doc.save();
      const { signedUrl } = await uploadAndRegisterPdf({
        bytes,
        jobId,
        companyId: job.company_id,
        estimateId: primaryEstimate?.id ?? null,
        hidePricing,
      });
      toast.dismiss(t);
      toast.success("Report PDF ready", {
        action: signedUrl ? { label: "Open", onClick: () => window.open(signedUrl, "_blank") } : undefined,
      });
    } catch (e) {
      console.error(e);
      toast.dismiss(t);
      toast.error(e instanceof Error ? e.message : "PDF generation failed");
    } finally {
      setGenerating(false);
    }
  };

  if (!job) return <div className="text-sm text-muted-foreground">Loading…</div>;
  const heroPhotoUrl = Object.values(photoUrls)[0] ?? null;

  return (
    <div className="space-y-4">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="application/pdf,image/png,image/jpeg"
        onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "upload")}
      />
      <input
        type="file"
        ref={videoInputRef}
        className="hidden"
        accept="video/mp4,video/quicktime,video/webm"
        onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], "video")}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-foreground">Report builder</h2>
          <p className="text-[12px] text-muted-foreground">
            {sections.filter((s) => s.visible).length} of {sections.length} sections ·{" "}
            {hidePricing ? "Pricing hidden" : "Pricing visible"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <Plus className="mr-1.5 h-4 w-4" /> Add section
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>AI templates</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => setAiOpen("cover_letter")}>
                <Sparkles className="mr-2 h-4 w-4" /> AI Cover Letter
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setAiOpen("flyer")}>
                <Sparkles className="mr-2 h-4 w-4" /> AI Flyer
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setAiOpen("infographic")}>
                <Sparkles className="mr-2 h-4 w-4" /> AI Infographic
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setAiOpen("cover_photo")}>
                <Sparkles className="mr-2 h-4 w-4" /> AI Cover Photo
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Custom</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => addSection("rich_text", { title: "Custom Note" })}>
                <Type className="mr-2 h-4 w-4" /> Rich text
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" /> Upload PDF / image
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => videoInputRef.current?.click()}>
                <Video className="mr-2 h-4 w-4" /> Embed video
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => addSection("divider", { title: "Divider" })}>
                <Minus className="mr-2 h-4 w-4" /> Divider
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Built-in</DropdownMenuLabel>
              {(Object.keys(BUILT_IN_LABEL) as Array<keyof typeof BUILT_IN_LABEL>).map((k) => (
                <DropdownMenuItem key={k} onClick={() => addSection(k)}>
                  {BUILT_IN_LABEL[k]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="ghost" size="sm" className="h-9" onClick={() => setHidePricing((v) => !v)}>
            {hidePricing ? <Eye className="mr-1.5 h-4 w-4" /> : <EyeOff className="mr-1.5 h-4 w-4" />}
            {hidePricing ? "Show pricing" : "Hide pricing"}
          </Button>
          <Button size="sm" className="h-9 btn-brand" onClick={handleGenerate} disabled={generating}>
            {generating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileDown className="mr-1.5 h-4 w-4" />}
            Generate PDF
          </Button>
        </div>
      </div>

      {/* Section reorder list */}
      <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>
        <DndContext sensors={useSensors(useSensor(PointerSensor))} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1">
              {sections.map((s) => (
                <SortableRow
                  key={s.id}
                  section={s}
                  onToggle={() => updateSection(s.id, { visible: !s.visible })}
                  onRemove={() => removeSection(s.id)}
                  onRename={(v) => updateSection(s.id, { title: v })}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Live preview */}
      <div className="mx-auto space-y-6" style={{ maxWidth: 820 }}>
        {sections.filter((s) => s.visible).map((s) => (
          <div
            key={s.id}
            ref={(el) => { sectionRefs.current[s.id] = el; }}
            data-section-id={s.id}
            className="pdf-section rounded-xl p-8 shadow-md"
            style={{ backgroundColor: "#ffffff", color: "#0a0a0b", fontFamily: "var(--font-sans)" }}
          >
            {renderSection({
              section: s,
              job,
              company,
              client,
              rep,
              property,
              heroPhotoUrl,
              measurement,
              damageRows,
              itemsByTrade,
              lineItems,
              hidePricing,
              estimates,
              photos,
              photoUrls,
              staticMapUrl,
              grandTotal,
              subtotal,
              markup,
              overhead,
              profit,
              tax,
              primaryEstimate,
              useManualTotal,
              assetUrls,
              updateProps,
            })}
          </div>
        ))}
      </div>

      {aiOpen && (
        <AIBlockDialog
          open={!!aiOpen}
          onOpenChange={(v) => !v && setAiOpen(null)}
          action={aiOpen}
          jobId={jobId}
          onCreated={(res) => {
            addSection(res.type, {
              title: CUSTOM_LABEL[res.type as keyof typeof CUSTOM_LABEL] ?? "Section",
              props: {
                text: res.text,
                assetId: res.assetId,
                storagePath: res.storagePath,
                bucket: res.bucket,
                mimeType: res.mimeType,
                aiPrompt: res.aiPrompt,
                aiStyle: res.aiStyle,
              },
            });
          }}
        />
      )}
    </div>
  );
}

function SortableRow({
  section,
  onToggle,
  onRemove,
  onRename,
}: {
  section: ReportSection;
  onToggle: () => void;
  onRemove: () => void;
  onRename: (v: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className="flex items-center gap-2 rounded-md border px-2 py-1.5"
    >
      <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground">
        <GripVertical className="h-4 w-4" />
      </button>
      <input
        value={section.title}
        onChange={(e) => onRename(e.target.value)}
        className="flex-1 bg-transparent text-[13px] font-medium text-foreground outline-none"
      />
      <span className="text-[10px] uppercase text-muted-foreground">{section.type.replace(/_/g, " ")}</span>
      <button onClick={onToggle} className="text-muted-foreground hover:text-foreground">
        {section.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      </button>
      <button onClick={onRemove} className="text-muted-foreground hover:text-destructive">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

// ---------- section renderers ----------
type RenderCtx = {
  section: ReportSection;
  job: JobRow;
  company: any;
  client: any;
  rep: any;
  property: any;
  heroPhotoUrl: string | null;
  measurement: any;
  damageRows: Array<{ severity: string; finding: string; location: string }>;
  itemsByTrade: Array<[string, any[]]>;
  lineItems: any[];
  hidePricing: boolean;
  estimates: any[];
  photos: any[];
  photoUrls: Record<string, string>;
  staticMapUrl: string | null;
  grandTotal: number;
  subtotal: number;
  markup: number;
  overhead: number;
  profit: number;
  tax: number;
  primaryEstimate: any;
  useManualTotal: boolean;
  assetUrls: Record<string, string>;
  updateProps: (id: string, patch: Partial<ReportSection["props"]>) => void;
};

function renderSection(ctx: RenderCtx) {
  const { section: s } = ctx;
  switch (s.type) {
    case "cover":
      return <CoverSection ctx={ctx} />;
    case "executive":
      return <ExecutiveSection ctx={ctx} />;
    case "damage":
      return <DamageSection ctx={ctx} />;
    case "measurement":
      return <MeasurementSection ctx={ctx} />;
    case "investment":
      return <InvestmentSection ctx={ctx} />;
    case "documentation":
    case "photos":
      return <PhotosSection ctx={ctx} />;
    case "options":
      return <OptionsSection ctx={ctx} />;
    case "terms":
      return <TermsSection ctx={ctx} />;
    case "footer":
      return <FooterSection ctx={ctx} />;
    case "rich_text":
    case "cover_letter":
      return <RichTextSection ctx={ctx} />;
    case "image":
    case "flyer":
    case "infographic":
    case "cover_photo":
      return <ImageSection ctx={ctx} />;
    case "uploaded_doc":
      return <UploadedDocSection ctx={ctx} />;
    case "embedded_video":
      return <VideoSection ctx={ctx} />;
    case "divider":
      return <div className="my-2 h-1 rounded-full" style={{ background: "linear-gradient(90deg, #000, #1e90ff)" }} />;
    default:
      return null;
  }
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 border-b-2 border-neutral-900 pb-1 text-xl font-extrabold text-neutral-900">{children}</h2>;
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        border: "1px solid #e5e5e5",
        borderRadius: 8,
        padding: "8px 10px",
        background: "#fafafa",
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#737373" }}>
        {label}
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700, color: "#0a0a0a", marginTop: 2 }}>
        {value}
      </div>
    </div>
  );
}
function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-[12px]">
      <span className="text-neutral-600">{label}</span>
      <span className="font-mono-num text-neutral-800">
        ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    </div>
  );
}

function CoverSection({ ctx }: { ctx: RenderCtx }) {
  const { job, company, client, rep, measurement, heroPhotoUrl } = ctx;
  return (
    <>
      <div className="flex items-start justify-between">
        {company?.logo_url ? (
          <img src={company.logo_url} alt={company.name ?? "Logo"} className="h-14 w-auto object-contain" crossOrigin="anonymous" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-lg text-xl font-extrabold text-white" style={{ background: "linear-gradient(135deg, #1e90ff, #0c5fb3)" }}>
            {company?.name?.[0] ?? "B"}
          </div>
        )}
        <div className="text-right font-mono-num text-[11px] text-neutral-500">
          <div>{job.job_number ?? "DRAFT"}</div>
          <div>{new Date().toLocaleDateString()}</div>
        </div>
      </div>
      <h1 className="mt-5 text-3xl font-extrabold text-neutral-900">{job.job_type ?? "Construction"} Proposal</h1>
      <p className="mt-1 text-base italic text-neutral-600">Prepared for {client?.name ?? "Client"}</p>
      <div className="my-4 h-1 rounded-full" style={{ background: "linear-gradient(90deg, #000, #1e90ff)" }} />

      {heroPhotoUrl && (
        <img
          src={heroPhotoUrl}
          alt=""
          crossOrigin="anonymous"
          style={{ width: "100%", height: 160, objectFit: "cover", borderRadius: 10 }}
        />
      )}

      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, fontSize: 13 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#737373" }}>Property</div>
          <div style={{ color: "#171717", marginTop: 2 }}>{job.property_address ?? "—"}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#737373" }}>Scope</div>
          <div style={{ color: "#171717", marginTop: 2 }}>
            {measurement?.squares ? `${Number(measurement.squares).toFixed(1)} SQ · ` : ""}
            {job.primary_trade ? getTradeLabel(job.primary_trade) : "—"}
          </div>
        </div>
      </div>

      {rep && (
        <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 12, border: "1px solid #e5e5e5", borderRadius: 10, padding: 12 }}>
          {rep.avatar_url && (
            <img
              src={rep.avatar_url}
              alt=""
              crossOrigin="anonymous"
              style={{ height: 48, width: 48, borderRadius: 999, objectFit: "cover", flexShrink: 0 }}
            />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "#737373" }}>Your representative</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#0a0a0a" }}>
              {[rep.first_name, rep.last_name].filter(Boolean).join(" ")}{rep.title ? ` · ${rep.title}` : ""}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#525252" }}>
              {rep.mobile_phone ?? rep.office_phone ?? ""}{rep.email ? ` · ${rep.email}` : ""}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ExecutiveSection({ ctx }: { ctx: RenderCtx }) {
  const { section, job, company, primaryEstimate, updateProps } = ctx;
  return (
    <>
      <H2>{section.title}</H2>
      <textarea
        className="w-full resize-none rounded border-0 bg-transparent text-[13px] leading-relaxed text-neutral-700 outline-none focus:bg-neutral-50"
        rows={Math.max(4, (section.props.text ?? "").split("\n").length + 1)}
        value={section.props.text ?? ""}
        placeholder={primaryEstimate?.notes ?? `${company?.name ?? "Our team"} inspected the property at ${job.property_address ?? "the address on file"} on ${new Date().toLocaleDateString()}. Based on our findings, we recommend the scope outlined here.`}
        onChange={(e) => updateProps(section.id, { text: e.target.value })}
      />
      {!section.props.text && (
        <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-neutral-700">
          {primaryEstimate?.notes ?? `${company?.name ?? "Our team"} inspected the property at ${job.property_address ?? "the address on file"} on ${new Date().toLocaleDateString()}. Based on our findings, we recommend the scope of work outlined in this proposal.`}
        </p>
      )}
    </>
  );
}

function DamageSection({ ctx }: { ctx: RenderCtx }) {
  const { section, damageRows } = ctx;
  return (
    <>
      <H2>{section.title}</H2>
      {damageRows.length === 0 ? (
        <p className="text-[13px] text-neutral-500">No AI-analyzed damage findings yet.</p>
      ) : (
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-neutral-500">
              <th className="border-b border-neutral-200 py-2">Severity</th>
              <th className="border-b border-neutral-200 py-2">Finding</th>
              <th className="border-b border-neutral-200 py-2">Location</th>
            </tr>
          </thead>
          <tbody>
            {damageRows.slice(0, 20).map((d, i) => (
              <tr key={i} className="border-b border-neutral-100">
                <td className="py-2"><span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-neutral-700">{d.severity}</span></td>
                <td className="py-2 text-neutral-800">{d.finding}</td>
                <td className="py-2 text-neutral-600">{d.location}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function MeasurementSection({ ctx }: { ctx: RenderCtx }) {
  const { section, measurement, staticMapUrl } = ctx;
  if (!measurement) return (<><H2>{section.title}</H2><p className="text-[13px] text-neutral-500">No measurement on file.</p></>);
  const stats: Array<[string, string]> = [
    ["Squares", Number(measurement.squares ?? 0).toFixed(1)],
    ["Area SF", Number(measurement.total_area_sqft ?? 0).toFixed(0)],
    ["Eaves LF", Number(measurement.eaves_lf ?? 0).toFixed(0)],
    ["Ridges LF", Number(measurement.ridges_lf ?? 0).toFixed(0)],
    ["Hips LF", Number(measurement.hips_lf ?? 0).toFixed(0)],
    ["Valleys LF", Number(measurement.valleys_lf ?? 0).toFixed(0)],
    ["Rakes LF", Number(measurement.rakes_lf ?? 0).toFixed(0)],
    ["Pitch", String(measurement.predominant_pitch ?? "—")],
  ];
  return (
    <>
      <H2>{section.title}</H2>
      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        {staticMapUrl && (
          <img
            src={staticMapUrl}
            alt=""
            crossOrigin="anonymous"
            style={{ width: 280, height: 200, objectFit: "cover", borderRadius: 8, flexShrink: 0 }}
          />
        )}
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 8 }}>
          {stats.map(([label, value]) => (
            <Stat key={label} label={label} value={value} />
          ))}
        </div>
      </div>
    </>
  );
}

function InvestmentSection({ ctx }: { ctx: RenderCtx }) {
  const { section, itemsByTrade, lineItems, hidePricing, grandTotal, subtotal, markup, overhead, profit, tax, primaryEstimate, useManualTotal } = ctx;
  return (
    <>
      <H2>{section.title}</H2>
      {lineItems.length === 0 ? (
        <p className="text-[13px] text-neutral-500">No line items yet.</p>
      ) : (
        <>
          {itemsByTrade.map(([trade, items]) => (
            <div key={trade} className="mb-4">
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-neutral-700">{getTradeLabel(trade)}</div>
              <table className="w-full text-[12px]">
                <thead><tr className="text-left text-[10px] uppercase tracking-wider text-neutral-500">
                  <th className="border-b border-neutral-200 py-1.5">Item</th>
                  {!hidePricing && (<><th className="border-b py-1.5 text-right">Qty</th><th className="border-b py-1.5">Unit</th><th className="border-b py-1.5 text-right">Price</th><th className="border-b py-1.5 text-right">Total</th></>)}
                </tr></thead>
                <tbody>{items.map((it: any) => (
                  <tr key={it.id} className="border-b border-neutral-100">
                    <td className="py-1.5 text-neutral-800">{it.name}</td>
                    {!hidePricing && (<>
                      <td className="py-1.5 text-right font-mono-num text-neutral-700">{Number(it.qty).toFixed(2)}</td>
                      <td className="py-1.5 text-neutral-600">{it.unit}</td>
                      <td className="py-1.5 text-right font-mono-num text-neutral-700">${Number(it.unit_price).toFixed(2)}</td>
                      <td className="py-1.5 text-right font-mono-num font-semibold text-neutral-900">${(Number(it.qty) * Number(it.unit_price)).toFixed(2)}</td>
                    </>)}
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ))}
          {!hidePricing && !useManualTotal && (
            <div className="mt-4 space-y-1 border-t border-neutral-300 pt-3 text-[12px]">
              <Row label="Subtotal" value={subtotal} />
              <Row label={`Markup (${primaryEstimate?.markup_pct ?? 0}%)`} value={markup} />
              <Row label={`Overhead (${primaryEstimate?.overhead_pct ?? 0}%)`} value={overhead} />
              <Row label={`Profit (${primaryEstimate?.profit_pct ?? 0}%)`} value={profit} />
              <Row label={`Tax (${primaryEstimate?.tax_pct ?? 0}%)`} value={tax} />
            </div>
          )}
          <div className="mt-4 flex items-baseline justify-between border-t border-neutral-300 pt-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-700">Grand Total</span>
            <span className="font-mono-num font-extrabold text-neutral-900" style={{ fontSize: 28 }}>
              ${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

        </>
      )}
    </>
  );
}

function PhotosSection({ ctx }: { ctx: RenderCtx }) {
  const { section, photos, photoUrls } = ctx;
  if (photos.length === 0) return null;
  return (
    <>
      <H2>{section.title}</H2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 10 }}>
        {photos.slice(0, 9).map((p: any) => (
          <div key={p.id}>
            {photoUrls[p.id] && (
              <img
                src={photoUrls[p.id]}
                alt=""
                crossOrigin="anonymous"
                style={{ width: "100%", height: 110, objectFit: "cover", borderRadius: 6 }}
              />
            )}
            <div style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.05em", color: "#737373", marginTop: 2 }}>
              {p.tag ?? "Untagged"}
            </div>
            {p.caption && <div style={{ fontSize: 10, color: "#404040" }}>{p.caption}</div>}
          </div>
        ))}
      </div>
    </>
  );
}

function OptionsSection({ ctx }: { ctx: RenderCtx }) {
  const { section, estimates, hidePricing } = ctx;
  if (estimates.length <= 1 || hidePricing) return null;
  return (
    <>
      <H2>{section.title}</H2>
      <table className="w-full text-[12px]">
        <thead><tr className="text-left text-[10px] uppercase tracking-wider text-neutral-500">
          <th className="border-b py-2">Tier</th><th className="border-b py-2">Status</th><th className="border-b py-2 text-right">Total</th>
        </tr></thead>
        <tbody>{estimates.map((e: any) => (
          <tr key={e.id} className="border-b border-neutral-100">
            <td className="py-2 font-semibold capitalize text-neutral-800">{e.tier === "original" ? e.name : e.tier}</td>
            <td className="py-2 capitalize text-neutral-600">{e.status}</td>
            <td className="py-2 text-right font-mono-num font-bold text-neutral-900">${Number(e.total ?? 0).toLocaleString()}</td>
          </tr>
        ))}</tbody>
      </table>
    </>
  );
}

function TermsSection({ ctx }: { ctx: RenderCtx }) {
  const { section, company, updateProps } = ctx;
  return (
    <>
      <H2>{section.title}</H2>
      <textarea
        className="w-full resize-none rounded border-0 bg-transparent text-[12px] leading-relaxed text-neutral-700 outline-none focus:bg-neutral-50"
        rows={4}
        value={section.props.text ?? ""}
        placeholder={company?.warranty_blurb ?? "Payment terms, warranty, financing…"}
        onChange={(e) => updateProps(section.id, { text: e.target.value })}
      />
      <div className="mt-6 grid grid-cols-2 gap-6">
        <div><div style={{ borderBottom: "1px solid #525252", height: 28 }} /><div className="mt-1 text-[10px] uppercase tracking-wider text-neutral-500">Customer Signature</div></div>
        <div><div style={{ borderBottom: "1px solid #525252", height: 28 }} /><div className="mt-1 text-[10px] uppercase tracking-wider text-neutral-500">Date</div></div>
      </div>

    </>
  );
}

function FooterSection({ ctx }: { ctx: RenderCtx }) {
  const { company } = ctx;
  return (
    <>
      <div className="mb-4 h-1 rounded-full" style={{ background: "linear-gradient(90deg, #000, #1e90ff)" }} />
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-[11px] text-neutral-600">
        <div className="font-bold text-neutral-800">{company?.name ?? "Company"}</div>
        <div className="font-mono-num">
          {company?.phone && <span>{company.phone}</span>}
          {company?.email && <span> · {company.email}</span>}
          {company?.website && <span> · {company.website}</span>}
        </div>
      </div>
    </>
  );
}

function RichTextSection({ ctx }: { ctx: RenderCtx }) {
  const { section, updateProps } = ctx;
  return (
    <>
      <H2>{section.title}</H2>
      <textarea
        className="w-full resize-none rounded border-0 bg-transparent text-[13px] leading-relaxed text-neutral-700 outline-none focus:bg-neutral-50"
        rows={Math.max(6, (section.props.text ?? "").split("\n").length + 1)}
        value={section.props.text ?? ""}
        placeholder="Type your custom content…"
        onChange={(e) => updateProps(section.id, { text: e.target.value })}
      />
    </>
  );
}

function ImageSection({ ctx }: { ctx: RenderCtx }) {
  const { section, assetUrls } = ctx;
  const url = section.props.storagePath ? assetUrls[section.props.storagePath] : null;
  // Cover photos / flyers / infographics shouldn't dominate the page —
  // cap height so portrait headshots stay reasonable.
  const isCover = section.type === "cover_photo";
  const isInfographic = section.type === "infographic";
  const isFlyer = section.type === "flyer";
  // Infographics & flyers should fill the full page width (and up to full page
  // height) so detail stays readable. Cover photos stay capped to avoid
  // portrait headshots dominating the first page.
  const maxH = isCover ? 240 : isInfographic || isFlyer ? 980 : 360;
  return (
    <>
      <H2>{section.title}</H2>
      {url ? (
        <div style={{ textAlign: "center", width: "100%" }}>
          <img
            src={url}
            alt={section.title}
            crossOrigin="anonymous"
            style={{
              maxHeight: maxH,
              width: isInfographic || isFlyer ? "100%" : "auto",
              maxWidth: "100%",
              borderRadius: 8,
              objectFit: "contain",
              display: "inline-block",
            }}
          />
        </div>
      ) : (
        <div className="flex h-48 items-center justify-center rounded border border-dashed border-neutral-300 text-[12px] text-neutral-500">
          <ImageIcon className="mr-2 h-4 w-4" /> No image
        </div>
      )}
      {section.props.aiPrompt && (
        <p className="mt-2 text-[10px] italic text-neutral-500">Prompt: {section.props.aiPrompt}</p>
      )}
    </>
  );
}

function UploadedDocSection({ ctx }: { ctx: RenderCtx }) {
  const { section, assetUrls } = ctx;
  const url = section.props.storagePath ? assetUrls[section.props.storagePath] : null;
  const isImage = section.props.mimeType?.startsWith("image/");
  return (
    <>
      <H2>{section.title}</H2>
      {url && isImage ? (
        <img src={url} alt="" className="w-full rounded-lg object-contain" crossOrigin="anonymous" />
      ) : url ? (
        <div className="rounded-lg border border-neutral-200 p-4 text-center text-[12px]">
          <FileText className="mx-auto mb-2 h-8 w-8 text-neutral-400" />
          <a href={url} target="_blank" rel="noreferrer" className="text-blue-600 underline">{section.title}</a>
          <p className="mt-1 text-[10px] text-neutral-500">PDF will be merged into final report.</p>
        </div>
      ) : (
        <p className="text-[12px] text-neutral-500">No file attached.</p>
      )}
    </>
  );
}

function VideoSection({ ctx }: { ctx: RenderCtx }) {
  const { section, assetUrls } = ctx;
  const url = section.props.storagePath ? assetUrls[section.props.storagePath] : null;
  return (
    <>
      <H2>{section.title}</H2>
      {url ? (
        <video src={url} controls className="w-full rounded-lg" />
      ) : (
        <div className="flex h-48 items-center justify-center rounded border border-dashed border-neutral-300 text-[12px] text-neutral-500">
          <Video className="mr-2 h-4 w-4" /> No video
        </div>
      )}
      <p className="mt-2 text-[10px] italic text-neutral-500">
        Video plays inline in PDFs that support rich media (Acrobat, most mobile readers). Other viewers will see the poster and a link.
      </p>
    </>
  );
}
