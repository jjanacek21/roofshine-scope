import MarketingShell from "./MarketingShell";
import FaqAccordion from "@/components/marketing/FaqAccordion";
import { EMPTY_SITE_CONTENT, type SiteContent } from "@/lib/site-content.types";

export default function FaqPage({
  content = EMPTY_SITE_CONTENT,
}: {
  content?: SiteContent;
}) {
  return (
    <MarketingShell>
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 22px 84px" }}>
        <div
          style={{
            fontFamily: "var(--cb-mono,ui-monospace,monospace)",
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: "var(--cb-accent)",
          }}
        >
          Questions
        </div>
        <h1 style={{ fontSize: "clamp(28px,4vw,42px)", letterSpacing: "-0.03em", margin: "10px 0 8px" }}>
          Frequently asked questions
        </h1>
        <p
          style={{
            fontSize: 16,
            color: "var(--cb-text-dim)",
            maxWidth: "60ch",
            lineHeight: 1.6,
            margin: "0 0 30px",
          }}
        >
          What reps and owners ask us before they switch. If yours is not here, bring it to the demo.
        </p>

        {content.faq.length ? (
          <FaqAccordion items={content.faq} />
        ) : (
          <p style={{ color: "var(--cb-text-muted)" }}>
            No questions published yet — check back shortly.
          </p>
        )}
      </section>
    </MarketingShell>
  );
}
