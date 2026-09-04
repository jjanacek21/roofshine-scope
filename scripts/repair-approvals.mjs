/**
 * Rewriting the approval PDFs that pdf-lib cannot open.
 *
 * Sampling 35 approvals at random, 17 could not be opened by pdf-lib — every
 * one failing on the catalog's page tree with "Expected instance of PDFDict".
 * They are not corrupt: pdf.js and MuPDF read all of them, and the text is
 * clean. Miami-Dade's document system writes cross-reference streams in a shape
 * pdf-lib will not follow, and Miami-Dade is where NOAs come from.
 *
 * A qpdf rewrite with --object-streams=disable rebuilds the file with the
 * same pages and a cross-reference table pdf-lib can walk. Nothing is re-encoded and nothing is rasterised — output is
 * within a percent of the input size, and the text layer survives.
 *
 * The app has a fallback for this (src/lib/permits/rescue.ts renders the pages
 * instead) but the fallback loses the text layer, so running this is worth
 * doing once.
 *
 * Usage:
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   node scripts/repair-approvals.mjs [--dry] [--limit N]
 *
 * A service role key is needed because it rewrites objects in the
 * product-approvals bucket. It never deletes: each repaired file is written
 * beside the original as <name>.repaired.pdf and the row is repointed, so the
 * original is always recoverable.
 */
import { createClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY = process.argv.includes("--dry");
const LIMIT = Number(process.argv[process.argv.indexOf("--limit") + 1]) || 0;
const BUCKET = "product-approvals";

if (!URL_ || !KEY) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(2);
}

const db = createClient(URL_, KEY, { auth: { persistSession: false } });

/** True when pdf-lib can open it and copy every page out. */
async function readable(bytes) {
  try {
    const d = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const o = await PDFDocument.create();
    (await o.copyPages(d, d.getPageIndices())).forEach((p) => o.addPage(p));
    await o.save();
    return d.getPageCount();
  } catch {
    return 0;
  }
}

/**
 * Rewrite the file's structure without touching its content.
 *
 * `--object-streams=disable` is the whole fix: it writes the cross-reference
 * table in the classic form instead of a stream, which is the exact thing
 * pdf-lib cannot follow. Pages, fonts, images and the text layer are untouched
 * and the output lands within a percent or two of the input size. MuPDF's
 * `mutool clean -gggg -z` does the same job if qpdf is not available.
 */
function repair(bytes) {
  const dir = mkdtempSync(join(tmpdir(), "noa-"));
  try {
    const src = join(dir, "in.pdf");
    const dst = join(dir, "out.pdf");
    writeFileSync(src, bytes);
    execFileSync("qpdf", ["--object-streams=disable", src, dst], { stdio: "pipe" });
    return readFileSync(dst);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const pathFromUrl = (u) => {
  const m = String(u).match(new RegExp(`/object/public/${BUCKET}/(.+)$`));
  return m ? decodeURIComponent(m[1]) : null;
};

async function main() {
  let q = db
    .from("product_approvals")
    .select("id, manufacturer, product_name, noa_number, noa_pdf_url, fl_approval_pdf_url, file_url")
    .or("noa_pdf_url.not.is.null,fl_approval_pdf_url.not.is.null,file_url.not.is.null");
  if (LIMIT) q = q.limit(LIMIT);
  const { data, error } = await q;
  if (error) throw error;

  const stats = { seen: 0, ok: 0, repaired: 0, failed: 0, skipped: 0 };
  const failures = [];

  for (const row of data ?? []) {
    const url = row.noa_pdf_url || row.fl_approval_pdf_url || row.file_url;
    const path = pathFromUrl(url);
    if (!path) {
      stats.skipped++;
      continue;
    }
    stats.seen++;

    const { data: blob, error: dlErr } = await db.storage.from(BUCKET).download(path);
    if (dlErr || !blob) {
      stats.failed++;
      failures.push([row.noa_number, "download", String(dlErr?.message ?? "no body")]);
      continue;
    }
    const bytes = Buffer.from(await blob.arrayBuffer());
    if (!bytes.slice(0, 5).toString("latin1").startsWith("%PDF")) {
      stats.failed++;
      failures.push([row.noa_number, "not_pdf", `${bytes.length} bytes`]);
      continue;
    }

    if (await readable(bytes)) {
      stats.ok++;
      continue;
    }

    let fixed;
    try {
      fixed = repair(bytes);
    } catch (e) {
      stats.failed++;
      failures.push([row.noa_number, "qpdf", String(e.message).slice(0, 80)]);
      continue;
    }
    const pages = await readable(fixed);
    if (!pages) {
      stats.failed++;
      failures.push([row.noa_number, "still_unreadable", `${fixed.length} bytes`]);
      continue;
    }

    if (DRY) {
      stats.repaired++;
      console.log(`  would repair ${row.noa_number ?? row.id}  ${pages}pp`);
      continue;
    }

    /* Written beside the original, never over it. */
    const newPath = path.replace(/\.pdf$/i, "") + ".repaired.pdf";
    const { error: upErr } = await db.storage
      .from(BUCKET)
      .upload(newPath, fixed, { contentType: "application/pdf", upsert: true });
    if (upErr) {
      stats.failed++;
      failures.push([row.noa_number, "upload", upErr.message]);
      continue;
    }
    const newUrl = `${URL_}/storage/v1/object/public/${BUCKET}/${newPath
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;
    const col = row.noa_pdf_url ? "noa_pdf_url" : row.fl_approval_pdf_url ? "fl_approval_pdf_url" : "file_url";
    const { error: updErr } = await db
      .from("product_approvals")
      .update({ [col]: newUrl })
      .eq("id", row.id);
    if (updErr) {
      stats.failed++;
      failures.push([row.noa_number, "update", updErr.message]);
      continue;
    }
    stats.repaired++;
    if (stats.repaired % 25 === 0) console.log(`  ${stats.repaired} repaired...`);
  }

  console.log("\n" + JSON.stringify(stats, null, 2));
  if (failures.length) {
    console.log("\nFAILURES");
    for (const f of failures.slice(0, 40)) console.log("  " + f.join("  "));
    if (failures.length > 40) console.log(`  ...and ${failures.length - 40} more`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
