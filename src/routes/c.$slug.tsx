import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Phone,
  MessageSquare,
  Mail,
  Globe,
  Download,
  FileText,
  ExternalLink,
  Calendar,
  Instagram,
  Facebook,
  Linkedin,
  Youtube,
} from "lucide-react";

export const Route = createFileRoute("/c/$slug")({
  component: PublicCard,
  head: () => ({
    meta: [{ title: "Rep Card" }],
  }),
});

type PublicCardData = {
  profile: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    title: string | null;
    bio: string | null;
    avatar_url: string | null;
    mobile_phone: string | null;
    office_phone: string | null;
    card_slug: string;
  };
  company: {
    id: string;
    name: string;
    logo_url: string | null;
    website: string | null;
    phone: string | null;
    email: string | null;
  } | null;
  blocks: Array<{
    id: string;
    kind: "link" | "photo" | "document" | "video";
    title: string | null;
    subtitle: string | null;
    url: string | null;
    storage_path: string | null;
    thumb_url: string | null;
    sort_order: number;
  }>;
};

function detectLinkIcon(url: string) {
  const u = url.toLowerCase();
  if (u.includes("calendly")) return Calendar;
  if (u.includes("instagram")) return Instagram;
  if (u.includes("facebook") || u.includes("fb.com")) return Facebook;
  if (u.includes("linkedin")) return Linkedin;
  if (u.includes("youtube") || u.includes("youtu.be")) return Youtube;
  return Globe;
}

function publicUrl(path: string | null) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return supabase.storage.from("rep-card-assets").getPublicUrl(path).data.publicUrl;
}

function buildVCard(d: PublicCardData) {
  const p = d.profile;
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${p.last_name ?? ""};${p.first_name ?? ""};;;`,
    `FN:${[p.first_name, p.last_name].filter(Boolean).join(" ")}`,
  ];
  if (p.title) lines.push(`TITLE:${p.title}`);
  if (d.company) lines.push(`ORG:${d.company.name}`);
  if (p.email) lines.push(`EMAIL;TYPE=WORK:${p.email}`);
  if (p.mobile_phone) lines.push(`TEL;TYPE=CELL:${p.mobile_phone}`);
  if (p.office_phone) lines.push(`TEL;TYPE=WORK:${p.office_phone}`);
  lines.push(`URL:${CONSULTATION_URL}`);
  lines.push("END:VCARD");
  return lines.join("\n");
}

function PublicCard() {
  const { slug } = Route.useParams();
  const [data, setData] = useState<PublicCardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: rpc } = await supabase.rpc("get_public_rep_card", { _slug: slug });
      setData((rpc as PublicCardData) ?? null);
      setLoading(false);
    })();
  }, [slug]);

  useEffect(() => {
    if (data) {
      const name = [data.profile.first_name, data.profile.last_name].filter(Boolean).join(" ");
      document.title = `${name}${data.profile.title ? " · " + data.profile.title : ""}`;
    }
  }, [data]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <h1 className="text-2xl font-bold">Card not found</h1>
        <p className="text-sm text-muted-foreground">This rep card doesn't exist yet.</p>
        <Link to="/" className="text-sm text-primary hover:underline">
          Go home
        </Link>
      </div>
    );
  }

  const { profile, company, blocks } = data;
  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ");
  const avatar = publicUrl(profile.avatar_url);

  const downloadVCard = () => {
    const vcf = buildVCard(data);
    const blob = new Blob([vcf], { type: "text/vcard" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fullName || "contact"}.vcf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="mx-auto max-w-[520px] px-5">
        {/* Hero */}
        <div className="pt-10 text-center">
          {avatar ? (
            <img
              src={avatar}
              alt={fullName}
              className="mx-auto h-32 w-32 rounded-full border-2 border-border object-cover shadow-lg"
            />
          ) : (
            <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-full bg-muted text-3xl font-bold text-muted-foreground">
              {(profile.first_name?.[0] ?? "") + (profile.last_name?.[0] ?? "")}
            </div>
          )}
          <h1 className="mt-4 text-2xl font-bold tracking-tight">{fullName}</h1>
          {profile.title && (
            <p className="mt-1 text-sm text-muted-foreground">{profile.title}</p>
          )}
          {company && (
            <div className="mt-3 flex items-center justify-center gap-2 text-sm">
              {company.logo_url && (
                <img src={publicUrl(company.logo_url) ?? ""} alt="" className="h-5 w-5 rounded" />
              )}
              <span className="font-medium">{company.name}</span>
            </div>
          )}
          {profile.bio && (
            <p className="mx-auto mt-4 max-w-[420px] text-sm leading-relaxed text-muted-foreground">
              {profile.bio}
            </p>
          )}
        </div>

        {/* Quick actions */}
        <div className="mt-6 grid grid-cols-4 gap-2">
          {profile.mobile_phone && (
            <QuickAction href={`tel:${profile.mobile_phone}`} icon={Phone} label="Call" />
          )}
          {profile.mobile_phone && (
            <QuickAction href={`sms:${profile.mobile_phone}`} icon={MessageSquare} label="Text" />
          )}
          {profile.email && (
            <QuickAction href={`mailto:${profile.email}`} icon={Mail} label="Email" />
          )}
          <button
            onClick={downloadVCard}
            className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card px-2 py-3 text-xs font-medium transition-colors hover:bg-muted"
          >
            <Download className="h-5 w-5 text-primary" />
            Save
          </button>
        </div>

        {/* Blocks */}
        <div className="mt-8 space-y-3">
          {blocks.map((b) => {
            if (b.kind === "link" && b.url) {
              const Icon = detectLinkIcon(b.url);
              return (
                <a
                  key={b.id}
                  href={b.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 text-sm font-semibold transition-all hover:border-primary hover:shadow-md"
                >
                  <Icon className="h-5 w-5 text-primary" />
                  <span className="flex-1 truncate">{b.title || b.url}</span>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </a>
              );
            }
            if (b.kind === "document" && b.storage_path) {
              const url = publicUrl(b.storage_path);
              return (
                <a
                  key={b.id}
                  href={url ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 text-sm font-semibold transition-all hover:border-primary hover:shadow-md"
                >
                  <FileText className="h-5 w-5 text-primary" />
                  <span className="flex-1 truncate">{b.title || "Document"}</span>
                  <Download className="h-4 w-4 text-muted-foreground" />
                </a>
              );
            }
            if (b.kind === "video") {
              const yt = b.url?.match(
                /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/,
              );
              if (yt) {
                return (
                  <div key={b.id} className="overflow-hidden rounded-xl border border-border bg-card">
                    {b.title && <p className="px-4 pt-3 text-sm font-semibold">{b.title}</p>}
                    <div className="relative pt-[56.25%]">
                      <iframe
                        src={`https://www.youtube.com/embed/${yt[1]}`}
                        className="absolute inset-0 h-full w-full"
                        allowFullScreen
                      />
                    </div>
                  </div>
                );
              }
              const videoUrl = b.storage_path ? publicUrl(b.storage_path) : b.url;
              if (videoUrl) {
                return (
                  <div key={b.id} className="overflow-hidden rounded-xl border border-border bg-card">
                    {b.title && <p className="px-4 pt-3 text-sm font-semibold">{b.title}</p>}
                    <video src={videoUrl} controls className="w-full" />
                  </div>
                );
              }
            }
            return null;
          })}

          {/* Photos grid */}
          {(() => {
            const photos = blocks.filter((b) => b.kind === "photo" && b.storage_path);
            if (!photos.length) return null;
            return (
              <div className="grid grid-cols-3 gap-1.5 pt-2">
                {photos.map((p) => {
                  const url = publicUrl(p.storage_path);
                  return (
                    <button
                      key={p.id}
                      onClick={() => url && setLightbox(url)}
                      className="aspect-square overflow-hidden rounded-lg bg-muted"
                    >
                      <img src={url ?? ""} alt={p.title ?? ""} className="h-full w-full object-cover" />
                    </button>
                  );
                })}
              </div>
            );
          })()}
        </div>

        {company?.website && (
          <p className="mt-12 text-center text-xs text-muted-foreground">
            <a href={company.website} target="_blank" rel="noreferrer" className="hover:underline">
              {company.name} · {company.website.replace(/^https?:\/\//, "")}
            </a>
          </p>
        )}
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} className="max-h-full max-w-full object-contain" alt="" />
        </div>
      )}
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof Phone;
  label: string;
}) {
  return (
    <a
      href={href}
      className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card px-2 py-3 text-xs font-medium transition-colors hover:bg-muted"
    >
      <Icon className="h-5 w-5 text-primary" />
      {label}
    </a>
  );
}
