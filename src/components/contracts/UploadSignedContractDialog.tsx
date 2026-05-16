import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { parseContractFilename } from "@/lib/contract-config";
import type { Tenant, TenantUser } from "@/hooks/useTenant";
import { Loader2, UploadCloud } from "lucide-react";

export function UploadSignedContractDialog({
  open,
  onOpenChange,
  tenant,
  tenantUser,
  jobId,
  customer,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tenant: Tenant;
  tenantUser: TenantUser;
  jobId: string;
  customer: {
    name: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
  };
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const parsed = file ? parseContractFilename(file.name) : null;

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file || !parsed) throw new Error("Pick a valid signed PDF first.");
      const path = `${tenant.slug}/${jobId}/${parsed.documentId}.pdf`;
      const { error: upErr } = await supabase.storage
        .from("contracts")
        .upload(path, file, { upsert: true, contentType: "application/pdf" });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("contracts").getPublicUrl(path);

      const { data: inserted, error: insErr } = await supabase.from("contracts").insert({
        tenant_id: tenant.id,
        job_id: jobId,
        document_id: parsed.documentId,
        contract_type: parsed.contractType,
        customer_name: customer.name,
        customer_email: customer.email,
        customer_phone: customer.phone,
        property_address: customer.address,
        rep_user_id: tenantUser.id,
        pdf_url: pub.publicUrl,
        signed_at: new Date().toISOString(),
        status: "signed",
        raw_data: {},
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any).select("id").single();
      if (insErr) throw insErr;

      // Mirror into job_documents so it shows in the Documents tab.
      try {
        const { data: u } = await supabase.auth.getUser();
        const { data: prof } = u.user
          ? await supabase.from("profiles").select("company_id").eq("id", u.user.id).maybeSingle()
          : { data: null };
        if (prof?.company_id) {
          await supabase.from("job_documents").insert({
            job_id: jobId,
            company_id: prof.company_id,
            kind: parsed.contractType === "insurance" ? "contingency" : "contract",
            title: `${parsed.documentId}.pdf`,
            bucket: "contracts",
            storage_path: path,
            mime_type: "application/pdf",
            file_size: file.size,
            source_table: "contracts",
            source_id: inserted?.id ?? null,
            created_by: u.user?.id ?? null,
          });
        }
      } catch (e) {
        console.warn("Contract saved, but failed to mirror into job_documents:", e);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["job-contracts", jobId] });
      qc.invalidateQueries({ queryKey: ["job-documents-all", jobId] });
      toast.success("Contract saved to job");
      setFile(null);
      setError(null);
      onSaved();
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setError(e.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload signed PDF</DialogTitle>
          <DialogDescription>
            Pick the signed contract PDF that was just downloaded to this device.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors hover:bg-[var(--bg-elevated)]"
            style={{ borderColor: "var(--border)" }}
          >
            <UploadCloud className="h-6 w-6 text-muted-foreground" />
            <span className="text-[13px] text-foreground">
              {file ? file.name : "Tap to choose PDF"}
            </span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                if (f && !parseContractFilename(f.name)) {
                  setError(
                    "Filename must look like GCN-RC-YYMMDD-XXXX.pdf or GCN-IC-YYMMDD-XXXX.pdf",
                  );
                } else {
                  setError(null);
                }
              }}
            />
          </label>

          {file && parsed && (
            <div
              className="rounded-lg border p-3 text-[12px]"
              style={{ borderColor: "var(--border)", background: "var(--bg-elevated)" }}
            >
              <div className="font-mono-num text-foreground">{parsed.documentId}</div>
              <div className="text-muted-foreground">
                {parsed.contractType === "residential"
                  ? "Construction Agreement"
                  : "Insurance Contingency"}
              </div>
            </div>
          )}

          {error && <p className="text-[12px] text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="btn-ghost h-10 rounded-lg px-4 text-[13px] font-semibold"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!file || !parsed || uploadMutation.isPending}
              onClick={() => uploadMutation.mutate()}
              className="btn-brand inline-flex h-10 items-center gap-2 rounded-lg px-5 text-[13px] font-semibold disabled:opacity-50"
            >
              {uploadMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Upload
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
