/**
 * Claim Buddy storm damage inspection report — the approved print template.
 *
 * Renders real 8.5in x 11in pages (816 x 1056 css px) so the PDF is a direct
 * capture of what is on screen. Every colour, name and logo is a token read
 * from the company record — nothing is hardcoded to one contractor.
 */
import type { CbReportViewModel } from "@/components/cb/CbReportDoc";
import { licenseList } from "@/components/cb/CbReportDoc";
import { tbc, type CbAiReport, type CbAiScopeRow } from "@/lib/cbReportAi";
import type { CbReportPhoto } from "@/lib/cbReport";

export const CB_TEMPLATE_PAGE_CLASS = "cbr-page";

const CSS = `
.cbr{--navy:#1B2A4A;--gold:#B08D57;--ink:#1a1a1a;--ink-soft:#3d4450;--muted:#6b7280;
  --rule:#d8dce3;--panel:#f4f6f9;--zebra:#fafbfc;
  font-family:"Helvetica Neue",Helvetica,Arial,sans-serif;color:var(--ink);font-size:14px;line-height:1.5}
.cbr *{box-sizing:border-box}
.cbr-page{position:relative;width:816px;height:1056px;padding:88px 72px 91px;margin:0 auto 18px;
  background:#fff;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.14)}
.cbr-rh{position:absolute;top:0;left:0;right:0;height:40px;background:var(--navy);color:#fff;
  display:flex;align-items:center;justify-content:space-between;padding:0 72px;
  font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}
.cbr-rh .addr{font-weight:400;letter-spacing:.02em;text-transform:none;font-size:11px;opacity:.92;
  max-width:60%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.cbr-rh:after{content:"";position:absolute;left:0;right:0;bottom:-3px;height:3px;background:var(--gold)}
.cbr-rf{position:absolute;bottom:40px;left:72px;right:72px;border-top:1px solid var(--rule);
  padding-top:7px;display:flex;justify-content:space-between;align-items:flex-start;
  font-size:10px;color:var(--muted);line-height:1.45}
.cbr-rf b{color:var(--ink-soft)}
.cbr-mast{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;
  padding-bottom:14px;border-bottom:2.5px solid var(--gold);margin-bottom:26px}
.cbr-mast img{max-height:88px;max-width:260px;object-fit:contain}
.cbr-mast .co{text-align:right;font-size:11.7px;line-height:1.6;color:var(--ink-soft)}
.cbr-mast .co .nm{font-size:14px;font-weight:700;color:var(--navy);letter-spacing:.02em;text-transform:uppercase}
.cbr-mast .co .lic{color:var(--gold);font-weight:700}
.cbr-eyebrow{font-size:10.5px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--gold)}
.cbr h1{font-size:30px;line-height:1.15;margin:6px 0 4px;color:var(--navy);letter-spacing:-.01em}
.cbr-sub{font-size:16.5px;font-weight:700;color:var(--gold);margin-bottom:22px}
.cbr-facts{display:grid;grid-template-columns:110px 1fr 110px 1fr;background:var(--panel);
  border-left:4px solid var(--navy);margin-bottom:24px}
.cbr-facts div{padding:9px 12px;font-size:12px;border-bottom:1px solid #e6e9ee}
.cbr-facts .k{font-size:9.8px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:var(--gold)}
.cbr-facts div:nth-last-child(-n+4){border-bottom:0}
.cbr-hero{width:100%;height:331px;object-fit:cover;display:block;background:#eee}
.cbr-cap{font-size:11px;color:var(--muted);margin-top:7px;line-height:1.5}
.cbr h2{font-size:20px;color:var(--navy);margin:26px 0 10px;padding-bottom:6px;
  border-bottom:2px solid var(--gold);letter-spacing:-.01em}
.cbr h2.first{margin-top:0}
.cbr h3{font-size:14.7px;color:var(--navy);margin:18px 0 6px}
.cbr p{margin:0 0 10px}
.cbr .lead b{color:var(--navy)}
.cbr table{width:100%;border-collapse:collapse;margin:10px 0 6px;font-size:12px}
.cbr thead th{background:var(--navy);color:#fff;text-align:left;padding:8px 10px;
  font-size:11.5px;font-weight:700;letter-spacing:.02em}
.cbr tbody td{padding:8px 10px;border-bottom:1px solid #e6e9ee;vertical-align:top;color:var(--ink-soft)}
.cbr tbody tr:nth-child(even){background:var(--zebra)}
.cbr td.comp{font-weight:600;color:var(--ink);width:168px}
.cbr td.act{width:202px}
.cbr-note{background:var(--panel);border-left:3px solid var(--gold);padding:11px 13px;
  font-size:11.2px;color:var(--ink-soft);margin:14px 0}
.cbr-note b{color:var(--navy)}
.cbr-photos{display:grid;grid-template-columns:1fr 1fr;gap:20px 26px;margin-top:12px}
.cbr-ph img{width:100%;height:250px;object-fit:cover;display:block;background:#eee}
.cbr-ph .t{font-size:12px;font-weight:700;color:var(--navy);margin:8px 0 3px}
.cbr-ph .d{font-size:11px;color:var(--ink-soft);line-height:1.5}
.cbr-sig{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:40px}
.cbr-sig .line{border-bottom:1px solid var(--ink);height:34px}
.cbr-sig .lbl{font-size:11.2px;color:var(--muted);margin-top:6px}
.cbr-disc{font-size:10.6px;color:var(--muted);line-height:1.55;margin-top:26px;
  border-top:1px solid var(--rule);padding-top:12px}
.cbr-missing{background:#fff8e6;border:1px solid var(--gold);padding:12px 14px;margin-top:16px}
.cbr-missing .h{font-size:12px;font-weight:700;color:var(--navy);margin-bottom:5px}
.cbr-missing ul{margin:0;padding-left:17px;font-size:11.5px;color:var(--ink-soft)}
`;

/** Estimated printed height of one scope row, in template pixels. */
function scopeRowHeight(r: CbAiScopeRow): number {
  const lines = (text: string, chars: number) => Math.max(1, Math.ceil((text || "").length / chars));
  const rows = Math.max(lines(r.component, 22), lines(r.condition, 46), lines(r.action, 30));
  return 20 + rows * 16;
}

/**
 * Split scope rows across pages by estimated height so a long condition never
 * runs off the bottom of a page. `first` is the budget on the opening page,
 * which also carries the summary block.
 */
function paginateScope(rows: CbAiScopeRow[], first: number, rest: number): CbAiScopeRow[][] {
  if (rows.length === 0) return [[]];
  const out: CbAiScopeRow[][] = [];
  let page: CbAiScopeRow[] = [];
  let budget = first;
  let used = 0;
  for (const r of rows) {
    const h = scopeRowHeight(r);
    if (page.length && used + h > budget) {
      out.push(page);
      page = [];
      used = 0;
      budget = rest;
    }
    page.push(r);
    used += h;
  }
  if (page.length) out.push(page);
  return out;
}

function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out.length ? out : [[]];
}

function fmtDate(v: unknown): string {
  const s = typeof v === "string" ? v : "";
  if (!s) return tbc(null);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return tbc(s);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function companyAddress(c: CbReportViewModel["company"]): string {
  return (
    [c?.address, [c?.city, c?.state].filter(Boolean).join(", "), c?.zip].filter(Boolean).join(", ") || tbc(null)
  );
}

export interface CbTemplateProps {
  vm: CbReportViewModel;
  ai: CbAiReport;
}

export function CbReportTemplate({ vm, ai }: CbTemplateProps) {
  const company = vm.company;
  const brand = company as unknown as { primary_color?: string; accent_color?: string; short_name?: string; license_line?: string } | null;
  const job = (vm.job ?? {}) as Record<string, string | number | null | undefined>;
  const name = String(company?.name ?? "");
  const shortName = brand?.short_name || name;
  const licenses = licenseList(company?.license_numbers);
  const licenseLine = brand?.license_line || (licenses.length ? `License ${licenses.join(", ")}` : tbc(null));
  const address = tbc(job.address);
  const owner = tbc(job.customer_name);
  const reportDate = fmtDate(vm.generatedAt);
  const pm = tbc(job.project_manager ?? vm.repName);

  const style: React.CSSProperties = {
    ["--navy" as string]: brand?.primary_color || "#1B2A4A",
    ["--gold" as string]: brand?.accent_color || "#B08D57",
  };

  /* Content box is 1056pt tall less the running head, footer and page padding. */
  const summaryLines = (ai.summary.length ? ai.summary : ["Not inspected"]).reduce(
    (n, p) => n + Math.max(1, Math.ceil(p.length / 92)),
    0,
  );
  const summaryBlock = 120 + summaryLines * 22;
  const roofPages = paginateScope(ai.roof_scope, Math.max(220, 920 - summaryBlock), 860);
  const exteriorPages = paginateScope(ai.exterior_scope, 560, 860);
  const captions = new Map(ai.photo_captions.map((c) => [c.photo_id, c]));
  const appendix = vm.photos.filter((p) => p.id !== vm.coverPhoto?.id);
  const photoPages = appendix.length ? chunk(appendix, 4) : [];

  const pages: React.ReactNode[] = [];
  const Head = () => (
    <div className="cbr-rh">
      <span>Storm Damage Inspection Report</span>
      <span className="addr">{address}</span>
    </div>
  );
  const Foot = ({ n }: { n: number }) => (
    <div className="cbr-rf">
      <div>
        <b>{name}</b> | {companyAddress(company)} | {tbc(company?.phone)}
        <br />
        Project Manager: {pm} &nbsp;|&nbsp; Prepared for: {owner} &nbsp;|&nbsp; Report Date: {reportDate}
      </div>
      <div>
        <b>Page {n}</b>
      </div>
    </div>
  );

  const page = (key: string, body: React.ReactNode) => {
    const n = pages.length + 1;
    pages.push(
      <div className={CB_TEMPLATE_PAGE_CLASS} key={key}>
        <Head />
        {body}
        <Foot n={n} />
      </div>,
    );
  };

  const scopeTable = (rows: CbAiScopeRow[]) => (
    <table>
      <thead>
        <tr>
          <th>Component / Trade</th>
          <th>Observed Condition</th>
          <th>Recommended Action</th>
        </tr>
      </thead>
      <tbody>
        {rows.length ? (
          rows.map((r, i) => (
            <tr key={i}>
              <td className="comp">{r.component}</td>
              <td>{r.condition}</td>
              <td className="act">{r.action}</td>
            </tr>
          ))
        ) : (
          <tr>
            <td className="comp">Not inspected</td>
            <td>No items were recorded for this section during the inspection.</td>
            <td className="act">Not inspected</td>
          </tr>
        )}
      </tbody>
    </table>
  );

  const heroUrl = vm.coverPhoto ? vm.urls[vm.coverPhoto.storage_path] ?? vm.urls[vm.coverPhoto.thumb_path ?? ""] : null;
  const logoUrl = vm.logoUrl;

  /* ---- page 1: cover ---- */
  page(
    "cover",
    <>
      <div className="cbr-mast">
        {logoUrl ? <img src={logoUrl} alt="" /> : <div style={{ fontSize: 24, fontWeight: 700, color: "var(--navy)" }}>{name}</div>}
        <div className="co">
          <div className="nm">{name}</div>
          <div>{companyAddress(company)}</div>
          <div>
            {tbc(company?.phone)} &nbsp;|&nbsp; {tbc(company?.website)}
          </div>
          <div className="lic">{licenseLine}</div>
        </div>
      </div>
      <div className="cbr-eyebrow">Storm Damage Inspection Report</div>
      <h1>{address}</h1>
      <div className="cbr-sub">
        {tbc(job.peril ?? "Hail & Wind Event")} — Date of Loss: {fmtDate(job.date_of_loss)}
      </div>
      <div className="cbr-facts">
        <div className="k">Property owner</div>
        <div>{owner}</div>
        <div className="k">Date of loss</div>
        <div>{fmtDate(job.date_of_loss)}</div>
        <div className="k">Property address</div>
        <div>{address}</div>
        <div className="k">Date of inspection</div>
        <div>{fmtDate(job.inspection_date ?? job.created_at)}</div>
        <div className="k">Peril</div>
        <div>{tbc(job.peril ?? "Hail / Wind")}</div>
        <div className="k">Report date</div>
        <div>{reportDate}</div>
        <div className="k">Carrier / claim</div>
        <div>
          {tbc(job.carrier)} — {tbc(job.claim_number)}
        </div>
        <div className="k">Structure type</div>
        <div>{tbc(vm.sheet.roof_system.stories ? `${vm.sheet.roof_system.stories}-Story Single Family` : null)}</div>
        <div className="k">Project manager</div>
        <div>{pm}</div>
        <div className="k">Roof system</div>
        <div>{tbc(vm.sheet.roof_system.roof_type)}</div>
      </div>
      {heroUrl ? (
        <>
          <img className="cbr-hero" src={heroUrl} alt="" />
          <div className="cbr-cap">{ai.cover_caption || `Front (street-facing) elevation — ${address}.`}</div>
        </>
      ) : null}
    </>,
  );

  /* ---- summary + roof scope ---- */
  roofPages.forEach((rows, i) => {
    page(
      `roof-${i}`,
      <>
        {i === 0 ? (
          <>
            <h2 className="first">1. Summary of Findings</h2>
            {(ai.summary.length ? ai.summary : ["Not inspected"]).map((p, k) => (
              <p className="lead" key={k}>
                {p}
              </p>
            ))}
            <h2>2. Scope of Loss — Roof System</h2>
          </>
        ) : (
          <h2 className="first">2. Scope of Loss — Roof System (continued)</h2>
        )}
        {scopeTable(rows)}
        {i === roofPages.length - 1 ? (
          <div className="cbr-note">
            <b>Note on quantities.</b> Component counts above reflect field observation and the aerial measurement at
            the time of inspection. Final quantities and pricing will be established from the line-item estimate
            prepared for this claim and reconciled with the carrier&rsquo;s adjuster on site.
          </div>
        ) : null}
      </>,
    );
  });

  /* ---- exterior scope + storm context ---- */
  exteriorPages.forEach((rows, i) => {
    const last = i === exteriorPages.length - 1;
    page(
      `ext-${i}`,
      <>
        <h2 className="first">3. Scope of Loss — Exterior Components{i > 0 ? " (continued)" : ""}</h2>
        {scopeTable(rows)}
        {last ? (
          <>
            <div className="cbr-note">
              <b>Note on the interior.</b>{" "}
              {ai.interior_note ||
                "Not inspected. Areas not inspected are printed as Not inspected rather than omitted."}
            </div>
            <h2>4. Storm Event &amp; Claim Context</h2>
            <p>{ai.storm_context || "Not inspected"}</p>
            <h3>This Is an Act-of-God Loss</h3>
            <p>
              Hail and wind are weather perils. Nothing the homeowner did or failed to do caused this damage, and no
              one could have moved the house out of the storm&rsquo;s path. This is precisely the event the policy was
              purchased to cover. Every policyholder who reports a loss is entitled to have that loss inspected by
              their carrier&rsquo;s adjuster — an inspection is not a favor, it is what the policy provides.
            </p>
            <h3>How a Storm Like This Affects Rates in the Area</h3>
            <p>
              Carriers do not absorb catastrophe losses — they recover them. Property insurance is priced at the{" "}
              <b>territory</b> level, typically by ZIP code or county, based on the loss experience of that territory.
              When a hail event of this size produces claims across the area, the loss experience for the entire
              territory changes, and the rate adjustment that follows applies to <b>every policyholder in it</b> — the
              ones who filed and the ones who did not.
            </p>
          </>
        ) : null}
      </>,
    );
  });

  /* Section numbers close up when the appendix is empty. */
  const PHOTO_SEC = 5;
  const SUPPORT_SEC = photoPages.length ? 6 : 5;
  const TERMS_SEC = SUPPORT_SEC + 1;
  const ACK_SEC = TERMS_SEC + 1;

  /* ---- photographic documentation ---- */
  photoPages.forEach((group, i) => {
    page(
      `photos-${i}`,
      <>
        <h2 className="first">{PHOTO_SEC}. Photographic Documentation{i > 0 ? " (continued)" : ""}</h2>
        {i === 0 ? (
          <p>
            Impacts below were located, circled in chalk and photographed during the inspection. Chalk is applied to
            reveal displacement of granules and oxidation and does not alter the underlying surface.
          </p>
        ) : null}
        <div className="cbr-photos">
          {group.map((p: CbReportPhoto, k) => {
            const cap = captions.get(p.id);
            const url = vm.urls[p.storage_path] ?? vm.urls[p.thumb_path ?? ""] ?? "";
            return (
              <div className="cbr-ph" key={p.id}>
                {url ? <img src={url} alt="" /> : <div style={{ height: 250, background: "#eee" }} />}
                <div className="t">{cap?.title || `Photo ${i * 4 + k + 1}`}</div>
                <div className="d">{cap?.description || p.caption || "Documented during the inspection."}</div>
              </div>
            );
          })}
        </div>
      </>,
    );
  });

  /* ---- support, terms, signature ---- */
  page(
    "close",
    <>
      <h2 className="first">{SUPPORT_SEC}. How {shortName} Supports the Claim</h2>
      <p>
        We document, price, meet the adjuster on site and present our documentation, submit supplements and request
        reinspection when items are omitted, then build. Large carriers often write repair-only estimates or deny on
        first inspection; properly documented that is often corrected on review — but promise no outcome. {name}{" "}
        presents documentation as the contractor and does <b>not</b> negotiate the claim or advise on coverage.
      </p>
      <p>
        <b>Pricing.</b> Xactimate at the carrier&rsquo;s own regional price list, quantities from aerial measurement.
        We do not make up prices.
      </p>
      <p>
        <b>Fees.</b> No charge for the inspection, documentation, estimate or adjuster attendance. Compensation is
        award of the contract on approval; not approved = nothing owed. The deductible is the owner&rsquo;s
        responsibility.
      </p>
      <h2>{TERMS_SEC}. Terms &amp; Next Steps</h2>
      <p>
        1. Report the loss to the carrier and request an adjuster inspection.
        <br />
        2. We attend the adjuster appointment and present this documentation on site.
        <br />
        3. The carrier issues a scope and settlement summary; we review it against this report.
        <br />
        4. Omitted items are supplemented with photo and measurement support.
        <br />
        5. On approval, work is scheduled and the contract is executed.
      </p>
    </>,
  );

  /* ---- acknowledgement ---- */
  page(
    "ack",
    <>
      {ai.missing.length ? (
        <div className="cbr-missing">
          <div className="h">Information still needed</div>
          <ul>
            {ai.missing.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <h2 className={ai.missing.length ? undefined : "first"}>{ACK_SEC}. Acknowledgement</h2>
      <div className="cbr-sig">
        <div>
          <div className="line" />
          <div className="lbl">Inspecting representative — {tbc(vm.repName)}</div>
        </div>
        <div>
          <div className="line" />
          <div className="lbl">Homeowner — {owner}</div>
        </div>
      </div>
      <div className="cbr-disc">{vm.narrative.statement}</div>
    </>,
  );

  return (
    <div className="cbr" style={style}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {pages}
    </div>
  );
}
