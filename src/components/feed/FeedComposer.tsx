import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Send, Image as ImageIcon, Globe, Users, Building2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";

type Visibility = "global" | "friends" | "team";

interface Props {
  onPosted?: () => void;
}

export function FeedComposer({ onPosted }: Props) {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("global");
  const [posting, setPosting] = useState(false);
  const [media, setMedia] = useState<{ url: string; type: string }[]>([]);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const path = `${user.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("feed-media").upload(path, file, { upsert: false });
    if (error) {
      toast.error(error.message);
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from("feed-media").getPublicUrl(path);
    setMedia((m) => [...m, { url: data.publicUrl, type: file.type.startsWith("video") ? "video" : "image" }]);
    setUploading(false);
  };

  const submit = async () => {
    if (!user || (!body.trim() && media.length === 0)) return;
    setPosting(true);
    const { error } = await supabase.from("feed_posts").insert({
      author_id: user.id,
      body: body.trim() || null,
      media: media as any,
      visibility,
      company_id: visibility === "team" ? profile?.company_id ?? null : null,
    });
    setPosting(false);
    if (error) {
      toast.error("Could not post", { description: error.message });
      return;
    }
    setBody("");
    setMedia([]);
    onPosted?.();
  };

  return (
    <div className="rounded-2xl border bg-[var(--bg-card)] p-4 space-y-3" style={{ borderColor: "var(--border)" }}>
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Share an update with the network…"
        rows={3}
        className="resize-none border-0 bg-transparent focus-visible:ring-0 px-0"
      />
      {media.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {media.map((m, i) =>
            m.type === "video" ? (
              <video key={i} src={m.url} className="h-20 w-20 rounded object-cover" />
            ) : (
              <img key={i} src={m.url} className="h-20 w-20 rounded object-cover" alt="" />
            ),
          )}
        </div>
      )}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <ToggleGroup type="single" value={visibility} onValueChange={(v) => v && setVisibility(v as Visibility)} size="sm">
          <ToggleGroupItem value="global" className="gap-1.5 text-xs"><Globe className="h-3.5 w-3.5" /> Global</ToggleGroupItem>
          <ToggleGroupItem value="friends" className="gap-1.5 text-xs"><Users className="h-3.5 w-3.5" /> Friends</ToggleGroupItem>
          <ToggleGroupItem value="team" className="gap-1.5 text-xs"><Building2 className="h-3.5 w-3.5" /> Team</ToggleGroupItem>
        </ToggleGroup>
        <div className="flex items-center gap-2">
          <label className="cursor-pointer text-muted-foreground hover:text-foreground">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
            <input type="file" accept="image/*,video/*" className="hidden" onChange={handleUpload} />
          </label>
          <Button onClick={submit} disabled={posting || (!body.trim() && media.length === 0)} size="sm" className="gap-1.5">
            <Send className="h-3.5 w-3.5" /> Post
          </Button>
        </div>
      </div>
    </div>
  );
}
