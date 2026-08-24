import { useState } from "react";
import type { SiteFaqItem } from "@/lib/site-content.types";

const CSS = `
.mkt-faq{max-width:900px;margin:0 auto}
.mkt-faq__grp + .mkt-faq__grp{margin-top:28px}
.mkt-faq__cat{font-family:var(--cb-mono,ui-monospace,monospace);font-size:11.5px;font-weight:800;
  letter-spacing:.12em;text-transform:uppercase;color:var(--cb-accent);margin:0 0 10px 2px}
.mkt-faq__i{border:1px solid var(--cb-hairline);border-radius:14px;background:var(--cb-surface);
  box-shadow:0 10px 24px rgba(9,12,16,.06);overflow:hidden}
.mkt-faq__i + .mkt-faq__i{margin-top:10px}
.mkt-faq__q{width:100%;display:flex;align-items:center;gap:14px;justify-content:space-between;
  background:none;border:0;padding:17px 18px;text-align:left;cursor:pointer;
  font-size:16px;font-weight:700;letter-spacing:-0.01em;color:var(--cb-text)}
.mkt-faq__q:hover{background:var(--cb-surface-2)}
.mkt-faq__chev{flex:0 0 auto;transition:transform .22s var(--cb-ease,ease);color:var(--cb-accent)}
.mkt-faq__i.is-open .mkt-faq__chev{transform:rotate(180deg)}
.mkt-faq__a{overflow:hidden;display:grid;grid-template-rows:0fr;transition:grid-template-rows .26s var(--cb-ease,ease)}
.mkt-faq__i.is-open .mkt-faq__a{grid-template-rows:1fr}
.mkt-faq__a > div{min-height:0}
.mkt-faq__a p{margin:0;padding:0 18px 18px;font-size:15px;line-height:1.62;color:var(--cb-text-dim);
  white-space:pre-line}
@media (prefers-reduced-motion: reduce){
  .mkt-faq__chev,.mkt-faq__a{transition:none}
}
`;

/** Preserves the incoming (sort_order) sequence while grouping by category. */
export function groupFaq(items: SiteFaqItem[]): Array<{ category: string; items: SiteFaqItem[] }> {
  const groups: Array<{ category: string; items: SiteFaqItem[] }> = [];
  for (const it of items) {
    const category = (it.category ?? "").trim() || "General";
    const hit = groups.find((g) => g.category === category);
    if (hit) hit.items.push(it);
    else groups.push({ category, items: [it] });
  }
  return groups;
}

/** Schema.org FAQPage payload built from the same rows the accordion renders. */
export function faqJsonLd(items: SiteFaqItem[]): string | null {
  if (!items.length) return null;
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  });
}

export default function FaqAccordion({ items }: { items: SiteFaqItem[] }) {
  const [openId, setOpenId] = useState<string | null>(items[0]?.id ?? null);
  if (!items.length) return null;

  return (
    <div className="mkt-faq">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {groupFaq(items).map((g) => (
        <div className="mkt-faq__grp" key={g.category}>
          <div className="mkt-faq__cat">{g.category}</div>
          {g.items.map((f) => {
            const open = openId === f.id;
            return (
              <div className={`mkt-faq__i${open ? " is-open" : ""}`} key={f.id}>
                <button
                  type="button"
                  className="mkt-faq__q"
                  aria-expanded={open}
                  aria-controls={`faq-a-${f.id}`}
                  // Only one panel is open at a time; clicking the open one closes it.
                  onClick={() => setOpenId(open ? null : f.id)}
                >
                  <span>{f.question}</span>
                  <svg
                    className="mkt-faq__chev"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </button>
                <div className="mkt-faq__a" id={`faq-a-${f.id}`} role="region">
                  <div>
                    <p>{f.answer}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
