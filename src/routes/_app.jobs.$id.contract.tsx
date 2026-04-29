import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { ContractTypePicker } from "@/components/contracts/ContractTypePicker";
import { SigningFrame } from "@/components/contracts/SigningFrame";
import { UploadSignedContractDialog } from "@/components/contracts/UploadSignedContractDialog";
import { buildSigningUrl } from "@/lib/contract-config";

export const Route = createFileRoute("/_app/jobs/$id/contract")({
  component: ContractPage,
});

type Phase = "choose" | "signing";

function ContractPage() {
  const { id: jobId } = Route.useParams();
  const { data: tenantData, isLoading: tenantLoading } = useTenant();
  const tenant = tenantData?.tenant ?? null;
  const tenantUser = tenantData?.tenantUser ?? null;

  const [phase, setPhase] = useState<Phase>("choose");
  const [contractType, setContractType] = useState<"residential" | "insurance" | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const { data: job } = useQuery({
    queryKey: ["job", jobId],
    queryFn: async () => {
      const { data } = await supabase.from("jobs").select("*").eq("id", jobId).maybeSingle();
      return data;
    },
  });

  const { data: client } = useQuery({
    queryKey: ["job-client", job?.client_id],
    enabled: !!job?.client_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("name, email, phone, address")
        .eq("id", job!.client_id!)
        .maybeSingle();
      return data;
    },
  });

  const customer = useMemo(
    () => ({
      name: client?.name ?? null,
      email: client?.email ?? null,
      phone: client?.phone ?? null,
      address: job?.property_address ?? client?.address ?? null,
    }),
    [client, job],
  );

  const signingUrl = useMemo(() => {
    if (!tenant || !tenantUser || !contractType) return "";
    return buildSigningUrl({
      rep: tenantUser.rep_slug,
      type: contractType,
      jobId,
      tenantId: tenant.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerEmail: customer.email,
      propertyAddress: customer.address,
      baseUrl: tenant.sign_base_url,
    });
  }, [tenant, tenantUser, contractType, jobId, customer]);

  if (tenantLoading) {
    return <div className="h-40 animate-pulse rounded-xl bg-[var(--bg-card)]" />;
  }

  if (!tenant || !tenantUser) {
    return (
      <div
        className="rounded-xl border p-6"
        style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
      >
        <h2 className="text-base font-semibold text-foreground">Contracts not enabled</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Your account isn't linked to a contracting tenant yet. Contact your admin to be added as a rep.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[18px] font-bold text-foreground">Contract</h2>
          <p className="text-[12px] text-muted-foreground">
            {tenant.company_name} · Rep: {tenantUser.rep_name}
          </p>
        </div>
        {phase === "signing" && (
          <button
            type="button"
            onClick={() => {
              setPhase("choose");
              setContractType(null);
            }}
            className="btn-ghost h-9 rounded-lg px-3 text-[13px] font-semibold"
          >
            Start over
          </button>
        )}
      </div>

      {phase === "choose" && (
        <ContractTypePicker
          tenant={tenant}
          onPick={(t) => {
            setContractType(t);
            setPhase("signing");
          }}
        />
      )}

      {phase === "signing" && signingUrl && (
        <SigningFrame
          url={signingUrl}
          onBack={() => {
            setPhase("choose");
            setContractType(null);
          }}
          onSave={() => setUploadOpen(true)}
        />
      )}

      <UploadSignedContractDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        tenant={tenant}
        tenantUser={tenantUser}
        jobId={jobId}
        customer={customer}
        onSaved={() => {
          setUploadOpen(false);
          setPhase("choose");
          setContractType(null);
        }}
      />
    </div>
  );
}
