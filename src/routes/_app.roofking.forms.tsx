import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sparkles, Loader2, Trash2, FileCog } from "lucide-react";
import { useIsRoofKing } from "@/hooks/useRoofKing";
import { useRKFormTemplates } from "@/hooks/roofking/useRKData";
import type { RKFormField } from "@/lib/roofking/types";

export const Route = createFileRoute("/_app/roofking/forms")({
  component: FormBuilderPage,
});

function FormBuilderPage() {
  const { companyId } = useIsRoofKing();
  const { data: templates = [] } = useRKFormTemplates(companyId);
  const qc = useQueryClient();
  const [prompt, setPrompt] = useState("");

  const generate = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No company");
      const { data: s } = await supabase.auth.getSession();
      const token = s.session?.access_token;
      if (!token) throw new Error("Not signed in");
      const r = await fetch("/api/rk-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: "form", payload: { prompt } }),
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t || "AI failed");
      }
      const j = (await r.json()) as { template: { name: string; description: string; fields: RKFormField[] } };
      const { error } = await supabase.from("rk_form_templates").insert({
        company_id: companyId,
        name: j.template.name || "Untitled Form",
        description: j.template.description ?? "",
        fields: j.template.fields ?? [],
        is_custom: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Form template created");
      setPrompt("");
      qc.invalidateQueries({ queryKey: ["rk", "forms"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rk_form_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Template deleted");
      qc.invalidateQueries({ queryKey: ["rk", "forms"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="space-y-5">
      <div className="rk-card rk-fade-in p-5">
        <h3 className="rk-display text-base">Generate a Form with AI</h3>
        <p className="mt-1 text-sm" style={{ color: "var(--rk-ink-muted)" }}>
          Describe what the form should capture. We'll generate a structured template you can reuse.
        </p>
        <textarea
          className="rk-input mt-3"
          rows={4}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder='e.g. "Annual TPO roof inspection — include drains, seams, penetrations, ponding water, and moisture readings."'
        />
        <div className="mt-3 flex justify-end">
          <button
            disabled={!prompt.trim() || generate.isPending}
            onClick={() => generate.mutate()}
            className="rk-btn rk-btn-gold"
          >
            {generate.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {generate.isPending ? "Generating…" : "Generate form with AI"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((t, i) => (
          <div key={t.id} className={`rk-card rk-fade-in delay-${Math.min(i + 1, 5)} p-4`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <FileCog className="h-4 w-4" style={{ color: "var(--rk-accent-light)" }} />
                <h4 className="rk-display text-sm">{t.name}</h4>
              </div>
              {t.is_custom && (
                <button onClick={() => remove.mutate(t.id)} className="text-[var(--rk-red)] hover:opacity-80" title="Delete">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {t.description && (
              <p className="mt-1 text-xs" style={{ color: "var(--rk-ink-muted)" }}>{t.description}</p>
            )}
            <p className="mt-3 text-[11px] uppercase tracking-wider" style={{ color: "var(--rk-ink-faint)" }}>
              <span className="rk-num">{t.fields?.length ?? 0}</span> fields
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(t.fields ?? []).slice(0, 8).map((f, idx) => (
                <span key={idx} className="rk-status-pill" style={{ color: "var(--rk-ink-muted)", background: "var(--rk-panel-2)" }}>{f.label}</span>
              ))}
              {(t.fields ?? []).length > 8 && (
                <span className="rk-status-pill" style={{ color: "var(--rk-ink-faint)", background: "var(--rk-panel-2)" }}>+{(t.fields ?? []).length - 8}</span>
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={() => toast.info("Use-template flow coming next — for now reference the schema from this card.")} className="rk-btn rk-btn-ghost">Use template</button>
            </div>
          </div>
        ))}
        {templates.length === 0 && (
          <div className="rk-card col-span-full p-10 text-center text-sm" style={{ color: "var(--rk-ink-faint)" }}>
            No templates yet. Generate one above.
          </div>
        )}
      </div>
    </div>
  );
}
