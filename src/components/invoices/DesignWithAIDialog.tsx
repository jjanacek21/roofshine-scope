import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { generateInvoiceTemplate } from "@/lib/invoice-templates.functions";
import { toast } from "sonner";

export function DesignWithAIDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (templateId: string) => void;
}) {
  const qc = useQueryClient();
  const generate = useServerFn(generateInvoiceTemplate);
  const [name, setName] = useState("My Custom Template");
  const [prompt, setPrompt] = useState("");

  const m = useMutation({
    mutationFn: () => generate({ data: { name, prompt } }),
    onSuccess: (res: any) => {
      toast.success("Template created");
      qc.invalidateQueries({ queryKey: ["invoice-templates"] });
      onCreated?.(res.template.id);
      onOpenChange(false);
      setPrompt("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "AI failed"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> Design with AI
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Template name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Describe the look you want</Label>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              placeholder="Modern, dark navy header with gold accents, serif headings, monospace prices, big company logo top-left, clean borderless table."
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Mention colors, fonts, header style (banner/clean/split), and any vibe (modern, minimal, luxury, brutalist).
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending || prompt.length < 5 || !name.trim()}>
            {m.isPending ? "Designing…" : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
