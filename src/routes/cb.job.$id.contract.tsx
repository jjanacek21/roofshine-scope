import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Check, Download, FileSignature, Mail, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CbSurface } from "@/components/cb/CbSurface";
import { CbCard, CbButton, CbChip, CbLoading } from "@/components/cb/primitives";
import { CbHeadline, CbReveal, CbStagger, CbStickyHeader } from "@/components/cb/motion";
import { CbField, CbSegmentedCards } from "@/components/cb/forms";
import { CbConvertAction } from "@/components/cb/CbConvertAction";
import { CbSignaturePad } from "@/components/cb/CbSignaturePad";
import { cbDocumentSignedUrl } from "@/lib/cbPdf";
import { cbSignContract, cbEmailContract } from "@/lib/cb-contract.functions";
import {
  CB_DOC_TYPE_LABEL,
  contractBodyHtml,
  contractIntro,
  licenseListFromJson,
  renderAndStoreContractPdf,
  requiredClauses,
  type CbContractData,
  type CbDocType,
} from "@/lib/cbContract";
import type { CbLineItem } from "@/lib/cbReport";

export const Route = createFileRoute("/cb/job/$id/contract")({
  head: () => ({
    meta: [
      { title: "Sign the agreement — Claim Buddy" },
      {
        name: "description",
        content:
          "Review and sign the contingency or retail agreement: auto-filled claim details, the required legal clauses and an on-screen signature.",
      },
      { property: "og:title", content: "Sign the agreement — Claim Buddy" },
      { property: "og:description", content: "Sign on the tablet and both parties get a countersigned copy." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CbContractPage,
});

const money = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function useContractInputs(jobId: string) {
  return useQuery({
    queryKey: ["cb-contract-inputs", jobId],
    queryFn: async () => {
      const { data: job, error } = await supabase
        .from("cb_jobs")
        .select(
          "id, workspace_id, company_id, customer_name, customer_email, address, city, state, zip, carrier, claim_number, date_of_loss, deductible, created_by",
        )
        .eq("id", jobId)
        .maybeSingle();
      if (error) throw error;
      if (!job) throw new Error("Job not found");

      const [{ data: company }, { data: report }, { data: contract }] = await Promise.all([
        supabase
          .from("cb_companies")
          .select("id, name, legal_name, address, city, state, phone, email, license_numbers, default_doc_type")
          .eq("id", job.company_id)
          .maybeSingle(),
        supabase
          .from("cb_reports")
          .select("id, line_items")
          .eq("job_id", jobId)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("cb_contracts")
          .select("id, doc_type, signer_name, signer_email, signed_at, pdf_path")
          .eq("job_id", jobId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      return { job, company, report, contract };
    },
  });
}

function CbContractPage() {
  const { id } = useParams({ from: "/cb/job/$id/contract" });
  const navigate = useNavigate();
  const { data, isLoading, refetch } = useContractInputs(id);

  const [docType, setDocType] = useState<CbDocType | null>(null);
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [signaturePng, setSignaturePng] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ name?: string; email?: string; sig?: string }>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [signedPath, setSignedPath] = useState<string | null>(null);
  const [emailedTo, setEmailedTo] = useState<string[] | null>(null);
  const contractIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setDocType((prev) => prev ?? ((data.contract?.doc_type as CbDocType) || (data.company?.default_doc_type as CbDocType) || "contingency"));
    setSignerName((prev) => prev || data.job.customer_name || "");
    setSignerEmail((prev) => prev || data.job.customer_email || "");
    if (data.contract?.signed_at && data.contract.pdf_path) {
      contractIdRef.current = data.contract.id;
      setSignedPath(data.contract.pdf_path);
    }
  }, [data]);

  const contract: CbContractData | null = useMemo(() => {
    if (!data || !docType) return null;
    const job = data.job;
    const company = data.company;
    const lines = (data.report?.line_items as CbLineItem[] | null) ?? [];
    return {
      docType,
      homeownerName: signerName || job.customer_name || "",
      homeownerEmail: signerEmail || job.customer_email || "",
      propertyAddress: [job.address, job.city, job.state, job.zip].filter(Boolean).join(", "),
      state: job.state ?? company?.state ?? "",
      carrier: job.carrier,
      claimNumber: job.claim_number,
      dateOfLoss: job.date_of_loss,
      deductible: job.deductible,
      scope: lines.map((l) => ({ description: l.description, quantity: l.quantity, unit: l.unit })),
      repName: "",
      party: {
        companyName: company?.name ?? "Contractor",
        companyLegalName: company?.legal_name || company?.name || "Contractor",
        companyAddress: [company?.address, company?.city, company?.state].filter(Boolean).join(", "),
        companyPhone: company?.phone ?? null,
        companyEmail: company?.email ?? null,
        licenses: licenseListFromJson(company?.license_numbers),
      },
    };
  }, [data, docType, signerName, signerEmail]);

  const clauses = useMemo(
    () => (contract ? requiredClauses(contract.docType, contract.state) : []),
    [contract],
  );

  async function handleSign() {
    if (!contract || !data) return;
    const next: typeof errors = {};
    if (signerName.trim().length < 2) next.name = "Enter the homeowner's full name";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signerEmail.trim())) next.email = "Enter a valid email for their copy";
    if (!signaturePng) next.sig = "Sign in the box, then tap Done";
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy("signing");
    try {
      const res = await cbSignContract({
        data: {
          jobId: id,
          docType: contract.docType,
          signerName: signerName.trim(),
          signerEmail: signerEmail.trim(),
          signaturePng: signaturePng!,
          bodyHtml: contractBodyHtml(contract),
        },
      });
      if (!res.ok) throw new Error(res.error);
      contractIdRef.current = res.contractId;

      setBusy("pdf");
      const path = await renderAndStoreContractPdf({
        data: contract,
        sig: {
          signerName: signerName.trim(),
          signerEmail: signerEmail.trim(),
          signaturePng,
          signedAt: res.signedAt,
          ip: typeof res.ip === "string" ? res.ip : null,
          userAgent: res.userAgent,
        },
        contractId: res.contractId,
        workspaceId: res.workspaceId,
        jobId: id,
      });
      setSignedPath(path);

      setBusy("email");
      const recipients = Array.from(
        new Set([signerEmail.trim(), data.company?.email].filter(Boolean) as string[]),
      );
      const mail = await cbEmailContract({ data: { contractId: res.contractId, to: recipients } });
      if (mail.ok) setEmailedTo(recipients);
      else toast.message("Signed and saved", { description: "Emailing the copy failed — you can resend it below." });

      toast.success("Agreement signed");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not complete the signing");
    } finally {
      setBusy(null);
    }
  }

  async function resend() {
    if (!contractIdRef.current) return;
    const to = Array.from(new Set([signerEmail.trim(), data?.company?.email].filter(Boolean) as string[]));
    setBusy("email");
    const res = await cbEmailContract({ data: { contractId: contractIdRef.current, to } });
    setBusy(null);
    if (res.ok) {
      setEmailedTo(to);
      toast.success("Copy sent");
    } else toast.error(res.error);
  }

  async function openPdf() {
    if (!signedPath) return;
    const url = await cbDocumentSignedUrl(signedPath);
    if (url) window.open(url, "_blank", "noopener");
  }

  if (isLoading || !contract) {
    return (
      <CbSurface>
        <div className="cb-page-pad flex min-h-screen items-center justify-center">
          <CbLoading label="Building the agreement…" />
        </div>
      </CbSurface>
    );
  }

  /* ---------------- Confirmation ---------------- */
  if (signedPath) {
    return (
      <CbSurface>
        <div className="flex min-h-screen items-center px-5 py-10">
          <CbCard elevation="raised" className="mx-auto w-full" style={{ padding: 26, maxWidth: 560 }}>
            <span className="cb-signed-check" aria-hidden>
              <Check size={26} strokeWidth={3} />
            </span>
            <CbHeadline as="h1" text="Signed and on file" className="cb-display mt-4" style={{ fontSize: 26 }} />
            <CbReveal delay={90}>
              <p className="mt-3 text-[15px]" style={{ color: "var(--cb-text-muted)" }}>
                {signerName} signed the {CB_DOC_TYPE_LABEL[contract.docType].toLowerCase()} for{" "}
                {contract.propertyAddress}. A countersigned copy is stored with the job
                {emailedTo?.length ? ` and emailed to ${emailedTo.join(" and ")}` : ""}.
              </p>
            </CbReveal>
            <div className="mt-6 grid gap-2">
              <CbConvertAction jobId={id} />
              <CbButton block onClick={openPdf}>
                <span className="inline-flex items-center gap-2">
                  <Download size={17} /> Open the signed PDF
                </span>
              </CbButton>
              <CbButton block variant="secondary" loading={busy === "email"} onClick={resend}>
                <span className="inline-flex items-center gap-2">
                  <Mail size={17} /> Email me a copy
                </span>
              </CbButton>
              <CbButton block variant="ghost" onClick={() => navigate({ to: "/cb" })}>
                Back to dashboard
              </CbButton>
            </div>
          </CbCard>
        </div>
      </CbSurface>
    );
  }

  /* ---------------- Signing ---------------- */
  const facts: [string, string][] = [
    ["Homeowner", contract.homeownerName || "—"],
    ["Property", contract.propertyAddress || "—"],
    ["Contractor", contract.party.companyLegalName],
  ];
  if (contract.party.licenses.length) facts.push(["License", contract.party.licenses.join(", ")]);
  if (contract.docType === "contingency") {
    facts.push(
      ["Carrier", contract.carrier || "—"],
      ["Claim number", contract.claimNumber || "—"],
      ["Date of loss", contract.dateOfLoss ? new Date(contract.dateOfLoss).toLocaleDateString() : "—"],
      ["Deductible", contract.deductible != null ? money(Number(contract.deductible)) : "—"],
    );
  }

  return (
    <CbSurface>
      <CbStickyHeader>
        <div className="flex items-center gap-3 px-4 py-3">
          <button className="cb-iconbtn" aria-label="Back" onClick={() => navigate({ to: "/cb/job/$id/report", params: { id }, search: { r: undefined } })}>
            <ArrowLeft size={19} />
          </button>
          <div className="min-w-0">
            <p className="cb-microlabel">Agreement</p>
            <p className="truncate text-[15px] font-semibold">{contract.propertyAddress || "This property"}</p>
          </div>
        </div>
      </CbStickyHeader>

      <div className="cb-page-pad mx-auto w-full max-w-[760px] px-4 pb-28 pt-4">
        <CbStagger>
          <CbCard elevation="raised" style={{ padding: 20 }}>
            <CbSegmentedCards<CbDocType>
              label="Which document"
              value={contract.docType}
              onChange={setDocType}
              options={[
                {
                  value: "contingency",
                  title: "Insurance contingency",
                  body: "Signed before the claim is filed. Binding only if the carrier approves.",
                },
                { value: "retail", title: "Retail repair", body: "No claim. The homeowner is paying for the work." },
              ]}
            />
          </CbCard>

          <CbCard elevation="raised" style={{ padding: 20 }}>
            <h2 className="cb-h2">{CB_DOC_TYPE_LABEL[contract.docType]}</h2>
            <p className="mt-2 text-[14.5px] leading-relaxed" style={{ color: "var(--cb-text-muted)" }}>
              {contractIntro(contract)}
            </p>
            <dl className="cb-factgrid mt-4">
              {facts.map(([k, v]) => (
                <div key={k} className="cb-factrow">
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </CbCard>

          <CbCard elevation="raised" style={{ padding: 20 }}>
            <h2 className="cb-h2">Scope of work</h2>
            {contract.scope.length ? (
              <ul className="cb-scopelist mt-3">
                {contract.scope.map((line, i) => (
                  <li key={`${line.description}-${i}`}>
                    <span>{line.description}</span>
                    <span className="cb-num">
                      {line.quantity.toLocaleString()} {line.unit}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-[14.5px]" style={{ color: "var(--cb-text-muted)" }}>
                No report scope yet — the carrier's approved estimate will set the scope.
              </p>
            )}
          </CbCard>

          <CbCard elevation="raised" style={{ padding: 20 }}>
            <div className="flex items-center gap-2">
              <ShieldAlert size={18} style={{ color: "var(--cb-accent)" }} />
              <h2 className="cb-h2">Terms — required, not editable</h2>
            </div>
            <div className="mt-3 grid gap-4">
              {clauses.map((c) => (
                <div key={c.title}>
                  <p className="text-[14.5px] font-semibold">{c.title}</p>
                  <p className="mt-1 whitespace-pre-line text-[14px] leading-relaxed" style={{ color: "var(--cb-text-muted)" }}>
                    {c.body}
                  </p>
                </div>
              ))}
            </div>
          </CbCard>

          <CbCard elevation="raised" style={{ padding: 20 }}>
            <h2 className="cb-h2">Sign here</h2>
            <div className="mt-4 grid gap-3">
              <CbField
                label="Homeowner full name"
                value={signerName}
                error={errors.name}
                autoComplete="name"
                onChange={(e) => setSignerName(e.target.value)}
              />
              <CbField
                label="Email for their copy"
                type="email"
                inputMode="email"
                value={signerEmail}
                error={errors.email}
                autoComplete="email"
                onChange={(e) => setSignerEmail(e.target.value)}
              />
              <CbSignaturePad onChange={setSignaturePng} />
              {errors.sig ? <p className="cb-field-msg is-error">{errors.sig}</p> : null}
              {signaturePng ? <CbChip>Signature ready</CbChip> : null}
            </div>
          </CbCard>
        </CbStagger>
      </div>

      <div className="cb-actionbar">
        <CbButton
          block
          loading={!!busy}
          loadingText={busy === "pdf" ? "Preparing the PDF…" : busy === "email" ? "Sending copies…" : "Recording the signature…"}
          onClick={handleSign}
        >
          <span className="inline-flex items-center gap-2">
            <FileSignature size={18} /> Sign the agreement
          </span>
        </CbButton>
      </div>
    </CbSurface>
  );
}
