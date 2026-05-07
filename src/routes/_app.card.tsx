import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getPublicCardUrl } from "@/lib/publicUrl";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";
import {
  Upload,
  Link as LinkIcon,
  Image as ImageIcon,
  FileText,
  Video,
  Trash2,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Copy,
  Download,
  ExternalLink,
  MessageSquare,
  Mail,
} from "lucide-react";

export const Route = createFileRoute("/_app/card")({
  component: CardEditor,
});

type Block = {
  id: string;
  user_id: string;
  kind: "link" | "photo" | "document" | "video";
  title: string | null;
  subtitle: string | null;
  url: string | null;
  storage_path: string | null;
  thumb_url: string | null;
  sort_order: number;
  is_visible: boolean;
};

function publicUrl(path: string | null) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return supabase.storage.from("rep-card-assets").getPublicUrl(path).data.publicUrl;
}

function CardEditor() {
  const { user } = useAuth();
  const { data: profile, refetch: refetchProfile } = useProfile();
  const qc = useQueryClient();

  // Profile form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [title, setTitle] = useState("");
  const [bio, setBio] = useState("");
  const [mobile, setMobile] = useState("");
  const [office, setOffice] = useState("");
  const [pubEmail, setPubEmail] = useState("");
  const [slug, setSlug] = useState("");
  const [slugStatus, setSlugStatus] = useState<"idle" | "ok" | "taken" | "invalid" | "checking">("idle");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setFirstName(profile.first_name ?? "");
    setLastName(profile.last_name ?? "");
    setTitle(profile.title ?? "");
    setBio(profile.bio ?? "");
    setMobile(profile.mobile_phone ?? "");
    setOffice(profile.office_phone ?? "");
    setPubEmail(profile.email ?? "");
    setSlug(profile.card_slug ?? "");
    setAvatarUrl(profile.avatar_url ?? null);
  }, [profile]);

  // Slug check
  useEffect(() => {
    if (!slug || slug === profile?.card_slug) {
      setSlugStatus("idle");
      return;
    }
    if (!/^[a-z0-9-]{3,40}$/.test(slug)) {
      setSlugStatus("invalid");
      return;
    }
    setSlugStatus("checking");
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("is_card_slug_available", { _slug: slug });
      setSlugStatus(data ? "ok" : "taken");
    }, 350);
    return () => clearTimeout(t);
  }, [slug, profile?.card_slug]);

  // Blocks query
  const { data: blocks = [] } = useQuery({
    queryKey: ["my-card-blocks", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("rep_card_blocks")
        .select("*")
        .eq("user_id", user!.id)
        .order("sort_order", { ascending: true });
      return (data as Block[]) ?? [];
    },
  });

  const refetchBlocks = () => qc.invalidateQueries({ queryKey: ["my-card-blocks", user?.id] });

  async function uploadAvatar(file: File) {
    if (!user) return;
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/avatar.${ext}`;
    const { error } = await supabase.storage
      .from("rep-card-assets")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) return toast.error(error.message);
    const { data } = supabase.storage.from("rep-card-assets").getPublicUrl(path);
    setAvatarUrl(`${data.publicUrl}?v=${Date.now()}`);
  }

  async function saveProfile() {
    if (!user) return;
    if (slug !== profile?.card_slug && slugStatus !== "ok") {
      toast.error("Pick an available card handle");
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        title: title.trim() || null,
        bio: bio.trim() || null,
        mobile_phone: mobile.trim() || null,
        office_phone: office.trim() || null,
        email: pubEmail.trim() || null,
        card_slug: slug || null,
        avatar_url: avatarUrl,
      })
      .eq("id", user.id);
    if (error) return toast.error(error.message);
    toast.success("Profile saved");
    refetchProfile();
  }

  // Block mutations
  const addBlock = async (b: Partial<Block>) => {
    if (!user) return;
    const nextOrder = (blocks[blocks.length - 1]?.sort_order ?? -1) + 1;
    const { error } = await supabase.from("rep_card_blocks").insert({
      user_id: user.id,
      company_id: profile?.company_id ?? null,
      kind: b.kind!,
      title: b.title ?? null,
      subtitle: b.subtitle ?? null,
      url: b.url ?? null,
      storage_path: b.storage_path ?? null,
      sort_order: nextOrder,
    });
    if (error) return toast.error(error.message);
    refetchBlocks();
  };

  const updateBlock = async (id: string, patch: Partial<Block>) => {
    const { error } = await supabase.from("rep_card_blocks").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    refetchBlocks();
  };

  const deleteBlock = async (b: Block) => {
    if (b.storage_path) {
      await supabase.storage.from("rep-card-assets").remove([b.storage_path]);
    }
    await supabase.from("rep_card_blocks").delete().eq("id", b.id);
    refetchBlocks();
  };

  const moveBlock = async (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= blocks.length) return;
    const a = blocks[idx], c = blocks[j];
    await Promise.all([
      supabase.from("rep_card_blocks").update({ sort_order: c.sort_order }).eq("id", a.id),
      supabase.from("rep_card_blocks").update({ sort_order: a.sort_order }).eq("id", c.id),
    ]);
    refetchBlocks();
  };

  // Adders
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  async function uploadAsset(file: File, folder: "photos" | "docs" | "video", kind: Block["kind"]) {
    if (!user) return;
    const ext = file.name.split(".").pop() || "bin";
    const path = `${user.id}/${folder}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("rep-card-assets")
      .upload(path, file, { contentType: file.type });
    if (error) return toast.error(error.message);
    await addBlock({ kind, title: file.name.replace(/\.[^.]+$/, ""), storage_path: path });
  }

  const [videoUrlInput, setVideoUrlInput] = useState("");

  // Share
  const cardUrl = getPublicCardUrl(slug);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const published = !!profile?.card_published;

  useEffect(() => {
    if (!cardUrl) return;
    QRCode.toDataURL(cardUrl, { width: 320, margin: 2 }).then(setQrDataUrl);
  }, [cardUrl]);

  const copyLink = () => {
    navigator.clipboard.writeText(cardUrl);
    toast.success("Link copied");
  };

  const downloadQR = () => {
    if (!qrDataUrl) return;
    const a = document.createElement("a");
    a.href = qrDataUrl;
    a.download = `${slug}-qr.png`;
    a.click();
  };

  async function togglePublished(next: boolean) {
    if (!user) return;
    if (next && !profile?.card_slug) {
      toast.error("Save a card handle first");
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({ card_published: next })
      .eq("id", user.id);
    if (error) return toast.error(error.message);
    toast.success(next ? "Card is live" : "Card unpublished");
    refetchProfile();
  }


  const publicAvatar = useMemo(() => publicUrl(avatarUrl), [avatarUrl]);

  if (!user || !profile) {
    return <div className="text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">My virtual card</h1>
          <p className="text-sm text-muted-foreground">
            Build the card homeowners see when you share your link or QR.
          </p>
        </div>
        {slug && (
          <a
            href={`/c/${slug}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
          >
            <ExternalLink className="h-3.5 w-3.5" /> View card
          </a>
        )}
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* Profile */}
          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold">Profile</h2>
            <div className="mt-4 flex items-start gap-5">
              <div className="flex flex-col items-center gap-2">
                <div
                  className="h-24 w-24 overflow-hidden rounded-full border-2 border-border bg-muted"
                  style={{
                    backgroundImage: publicAvatar ? `url(${publicAvatar})` : undefined,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
                <label className="cursor-pointer text-xs font-medium text-primary hover:underline">
                  <Upload className="mr-1 inline h-3 w-3" />
                  {avatarUrl ? "Replace" : "Upload"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])}
                  />
                </label>
              </div>
              <div className="grid flex-1 grid-cols-2 gap-3">
                <Field label="First name">
                  <input className="field-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </Field>
                <Field label="Last name">
                  <input className="field-input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </Field>
                <Field label="Title" full>
                  <input className="field-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Senior Roof Consultant" />
                </Field>
                <Field label="Mobile">
                  <input className="field-input" value={mobile} onChange={(e) => setMobile(e.target.value)} />
                </Field>
                <Field label="Office">
                  <input className="field-input" value={office} onChange={(e) => setOffice(e.target.value)} />
                </Field>
                <Field label="Public email" full>
                  <input className="field-input" value={pubEmail} onChange={(e) => setPubEmail(e.target.value)} />
                </Field>
                <Field label="Bio" full>
                  <textarea
                    rows={3}
                    maxLength={500}
                    className="field-input resize-none"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                  />
                </Field>
                <Field label="Card handle" full>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">/c/</span>
                    <input
                      className="field-input flex-1"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value.toLowerCase())}
                    />
                  </div>
                  <div className="mt-1 text-xs">
                    {slugStatus === "checking" && <span className="text-muted-foreground">Checking…</span>}
                    {slugStatus === "ok" && <span className="text-green-600">✓ Available</span>}
                    {slugStatus === "taken" && <span className="text-red-600">Taken</span>}
                    {slugStatus === "invalid" && <span className="text-red-600">3–40 lowercase letters/numbers/dashes</span>}
                  </div>
                </Field>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={saveProfile} className="btn-brand h-9 rounded-md px-4 text-sm font-semibold">
                Save profile
              </button>
            </div>
          </section>

          {/* Blocks */}
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Card blocks</h2>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setLinkOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  <LinkIcon className="h-3.5 w-3.5" /> Link
                </button>
                <button
                  onClick={() => photoInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  <ImageIcon className="h-3.5 w-3.5" /> Photo
                </button>
                <button
                  onClick={() => docInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  <FileText className="h-3.5 w-3.5" /> Document
                </button>
                <button
                  onClick={() => videoInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                >
                  <Video className="h-3.5 w-3.5" /> Video
                </button>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && uploadAsset(e.target.files[0], "photos", "photo")}
                />
                <input
                  ref={docInputRef}
                  type="file"
                  accept=".pdf,image/*,.doc,.docx"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && uploadAsset(e.target.files[0], "docs", "document")}
                />
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && uploadAsset(e.target.files[0], "video", "video")}
                />
              </div>
            </div>

            {/* Add link inline */}
            {linkOpen && (
              <div className="mt-4 flex flex-col gap-2 rounded-lg border border-dashed border-border p-3 sm:flex-row">
                <input
                  className="field-input flex-1"
                  placeholder="Title (e.g. Schedule a call)"
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                />
                <input
                  className="field-input flex-[2]"
                  placeholder="https://…"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                />
                <button
                  className="btn-brand h-10 rounded-md px-3 text-sm font-semibold"
                  onClick={async () => {
                    if (!linkUrl) return;
                    await addBlock({ kind: "link", title: linkTitle || linkUrl, url: linkUrl });
                    setLinkTitle("");
                    setLinkUrl("");
                    setLinkOpen(false);
                  }}
                >
                  Add
                </button>
                <button
                  className="h-10 rounded-md border border-border px-3 text-sm"
                  onClick={() => setLinkOpen(false)}
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Add YouTube/Vimeo */}
            <div className="mt-3 flex flex-col gap-2 rounded-lg border border-dashed border-border p-3 sm:flex-row">
              <input
                className="field-input flex-1"
                placeholder="Or paste a YouTube / Vimeo URL"
                value={videoUrlInput}
                onChange={(e) => setVideoUrlInput(e.target.value)}
              />
              <button
                className="h-10 rounded-md border border-border px-3 text-sm hover:bg-muted"
                onClick={async () => {
                  if (!videoUrlInput) return;
                  await addBlock({ kind: "video", title: "Video intro", url: videoUrlInput });
                  setVideoUrlInput("");
                }}
              >
                Add video link
              </button>
            </div>

            {/* List */}
            <div className="mt-5 space-y-2">
              {blocks.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No blocks yet — add a link, photo, document, or video above.
                </p>
              )}
              {blocks.map((b, i) => (
                <BlockRow
                  key={b.id}
                  block={b}
                  onMoveUp={() => moveBlock(i, -1)}
                  onMoveDown={() => moveBlock(i, 1)}
                  onToggle={() => updateBlock(b.id, { is_visible: !b.is_visible })}
                  onDelete={() => deleteBlock(b)}
                  onRename={(t) => updateBlock(b.id, { title: t })}
                />
              ))}
            </div>
          </section>
        </div>

        {/* Share panel */}
        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Share your card</h2>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  published
                    ? "bg-green-500/15 text-green-600"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {published ? "Live" : "Draft"}
              </span>
            </div>

            <label className="mt-3 flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold">Publish card</p>
                <p className="text-[11px] text-muted-foreground">
                  {profile?.card_slug
                    ? published
                      ? "Anyone with the link can view your card."
                      : "Turn on to make your card public."
                    : "Save a card handle above first."}
                </p>
              </div>
              <input
                type="checkbox"
                checked={published}
                disabled={!profile?.card_slug}
                onChange={(e) => togglePublished(e.target.checked)}
                className="h-5 w-9 cursor-pointer appearance-none rounded-full bg-muted transition-colors checked:bg-primary disabled:cursor-not-allowed disabled:opacity-50 relative before:absolute before:left-0.5 before:top-0.5 before:h-4 before:w-4 before:rounded-full before:bg-white before:transition-transform checked:before:translate-x-4"
              />
            </label>

            {!slug ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Pick a card handle above to enable sharing.
              </p>
            ) : (
              <div className={published ? "" : "pointer-events-none opacity-50"}>
                <div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
                  <span className="flex-1 truncate font-mono text-xs">{cardUrl}</span>
                  <button onClick={copyLink} className="text-primary hover:opacity-80">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
                {qrDataUrl && (
                  <div className="mt-4 flex flex-col items-center gap-2 rounded-lg border border-border bg-background p-4">
                    <img src={qrDataUrl} alt="QR code" className="h-44 w-44" />
                    <button
                      onClick={downloadQR}
                      className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                    >
                      <Download className="h-3 w-3" /> Download PNG
                    </button>
                  </div>
                )}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <a
                    href={`sms:?body=${encodeURIComponent(`Here's my card: ${cardUrl}`)}`}
                    className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted"
                  >
                    <MessageSquare className="h-3.5 w-3.5" /> Text link
                  </a>
                  <a
                    href={`mailto:?subject=${encodeURIComponent("My card")}&body=${encodeURIComponent(cardUrl)}`}
                    className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-muted"
                  >
                    <Mail className="h-3.5 w-3.5" /> Email link
                  </a>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold">Tips</h2>
            <ul className="mt-2 space-y-2 text-xs text-muted-foreground">
              <li>• Lead with your strongest link (Calendly, reviews).</li>
              <li>• Add 3–6 photos of recent jobs.</li>
              <li>• Upload your license & insurance as PDFs.</li>
              <li>• Use a 30-second intro video.</li>
            </ul>
            <Link to="/" className="mt-3 inline-block text-xs text-primary hover:underline">
              Back to dashboard
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`flex flex-col gap-1 text-xs font-semibold text-muted-foreground ${full ? "col-span-2" : ""}`}>
      {label}
      <div className="font-normal text-foreground">{children}</div>
    </label>
  );
}

function BlockRow({
  block,
  onMoveUp,
  onMoveDown,
  onToggle,
  onDelete,
  onRename,
}: {
  block: Block;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onRename: (t: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [t, setT] = useState(block.title ?? "");
  useEffect(() => setT(block.title ?? ""), [block.title]);
  const url = publicUrl(block.storage_path);

  const KindIcon =
    block.kind === "link" ? LinkIcon : block.kind === "photo" ? ImageIcon : block.kind === "document" ? FileText : Video;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
      <div className="flex flex-col">
        <button onClick={onMoveUp} className="text-muted-foreground hover:text-foreground">
          <ArrowUp className="h-3 w-3" />
        </button>
        <button onClick={onMoveDown} className="text-muted-foreground hover:text-foreground">
          <ArrowDown className="h-3 w-3" />
        </button>
      </div>
      {block.kind === "photo" && url ? (
        <img src={url} className="h-10 w-10 rounded object-cover" alt="" />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded bg-muted">
          <KindIcon className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            autoFocus
            value={t}
            onChange={(e) => setT(e.target.value)}
            onBlur={() => {
              setEditing(false);
              if (t !== block.title) onRename(t);
            }}
            onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            className="field-input h-8"
          />
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="block w-full truncate text-left text-sm font-medium hover:text-primary"
          >
            {block.title || <span className="text-muted-foreground">Untitled</span>}
          </button>
        )}
        {block.url && <p className="truncate text-xs text-muted-foreground">{block.url}</p>}
      </div>
      <span className="hidden rounded bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground sm:inline">
        {block.kind}
      </span>
      <button onClick={onToggle} className="text-muted-foreground hover:text-foreground" title={block.is_visible ? "Hide" : "Show"}>
        {block.is_visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      </button>
      <button onClick={onDelete} className="text-muted-foreground hover:text-red-600">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
