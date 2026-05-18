import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { type SectionType } from "@/lib/report-sections";

type Action = "cover_letter" | "flyer" | "infographic" | "cover_photo";

const ACTION_LABEL: Record<Action, string> = {
  cover_letter: "AI Cover Letter",
  flyer: "AI Flyer",
  infographic: "AI Infographic",
  cover_photo: "AI Cover Photo",
};

export function AIBlockDialog({
  open,
  onOpenChange,
  action,
  jobId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  action: Action;
  jobId: string;
  onCreated: (result: {
    type: SectionType;
    text?: string;
    assetId?: string;
    storagePath?: string;
    bucket?: string;
    mimeType?: string;
    aiPrompt?: string;
    aiStyle?: string;
  }) => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("modern, professional");
  const [tone, setTone] = useState("professional");
  const [loading, setLoading] = useState(false);

  const isText = action === "cover_letter";

  const run = async () => {
    setLoading(true);
    try {
      const { data: s } = await supabase.auth.getSession();
      const tok = s.session?.access_token;
      if (!tok) throw new Error("Not signed in");
      const r = await fetch("/api/report-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${tok}` },
        body: JSON.stringify({ action, job_id: jobId, prompt, style, tone }),
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t || `HTTP ${r.status}`);
      }
      const j = await r.json();
      if (j.kind === "text") {
        onCreated({ type: "cover_letter", text: j.text, aiPrompt: prompt });
      } else {
        onCreated({
          type: action as SectionType,
          assetId: j.asset.id,
          storagePath: j.asset.storage_path,
          bucket: j.asset.bucket,
          mimeType: j.asset.mime_type,
          aiPrompt: prompt,
          aiStyle: style,
        });
      }
      toast.success(`${ACTION_LABEL[action]} generated`);
      onOpenChange(false);
      setPrompt("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--brand)]" />
            Generate {ACTION_LABEL[action]}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Describe what you want</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder={
                isText
                  ? "e.g. Warm intro mentioning storm damage from last week"
                  : "e.g. Emphasize hail damage, include before/after vibe"
              }
            />
          </div>
          {isText ? (
            <div>
              <Label>Tone</Label>
              <Input value={tone} onChange={(e) => setTone(e.target.value)} placeholder="professional, warm, urgent" />
            </div>
          ) : (
            <div>
              <Label>Visual style</Label>
              <Input value={style} onChange={(e) => setStyle(e.target.value)} placeholder="modern, clean, blue accent" />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={run} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
