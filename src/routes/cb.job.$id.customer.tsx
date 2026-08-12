import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { CbSurface } from "@/components/cb/CbSurface";
import { CbCard, CbButton } from "@/components/cb/primitives";
import { CbHeadline } from "@/components/cb/motion";

export const Route = createFileRoute("/cb/job/$id/customer")({
  head: () => ({
    meta: [
      { title: "Customer details — Claim Buddy" },
      {
        name: "description",
        content: "Capture the homeowner, carrier and claim details for this roof inspection.",
      },
      { property: "og:title", content: "Customer details — Claim Buddy" },
      { property: "og:description", content: "Start of the Claim Buddy inspection flow." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CbJobCustomerPage,
});

function CbJobCustomerPage() {
  const { id } = useParams({ from: "/cb/job/$id/customer" });
  const navigate = useNavigate();

  return (
    <CbSurface>
      <div className="min-h-screen px-5 py-10" style={{ background: "var(--cb-bg)" }}>
        <div className="mx-auto w-full max-w-[620px]">
          <CbCard elevation="floating" style={{ padding: 26 }}>
            <CbHeadline text="Customer details" as="h1" className="cb-display" style={{ fontSize: 22 }} />
            <p className="mt-2 text-[13.5px]" style={{ color: "var(--cb-text-muted)" }}>
              This inspection is created and saved as a draft. The customer intake screen lands here next.
            </p>
            <p className="mt-3 cb-num text-[12px]" style={{ color: "var(--cb-text-muted)" }}>
              Job {id}
            </p>
            <div className="mt-6">
              <CbButton block variant="secondary" onClick={() => navigate({ to: "/cb" })}>
                Back to inspections
              </CbButton>
            </div>
          </CbCard>
        </div>
      </div>
    </CbSurface>
  );
}
