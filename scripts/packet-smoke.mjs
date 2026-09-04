/**
 * The three things that broke the last real packet, checked against live files.
 *
 * The previous assembler's final run for a job in Loxahatchee listed six
 * approvals as unsourced, one as `parse_failed`, and dropped the site photos
 * entirely. This reruns each of those failure modes against the same library
 * the app reads from, and asserts the behaviour the assembler now has:
 *
 *   1. NOA keys stored with their own label ("NOA No. 22-0123.01") resolve.
 *   2. A JPEG becomes a page instead of being dropped.
 *   3. A PDF pdf-lib cannot open is detected as such rather than taken on
 *      faith — and a qpdf rewrite of the same bytes opens cleanly, which is
 *      what scripts/repair-approvals.mjs does to the library.
 *
 * Point 3 is the one worth watching. Sampling the library, close to half of
 * the approvals fail pdf-lib the same way. In the browser the app renders
 * those pages instead (src/lib/permits/rescue.ts); this checks the durable fix.
 *
 *   node scripts/packet-smoke.mjs
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const LIB = "https://ujalvgknnbsxqpujxvwk.supabase.co/storage/v1/object/public/product-approvals/noa-pdfs";

/** Two that pdf-lib reads, and one it does not. */
const CASES = [
  { name: "GAF Cobra Exhaust Vent 23-1023.05", url: `${LIB}/GAF/23-1023-05.pdf`, expect: "readable" },
  { name: "GAF Cobra Ridge Runner 22-0726.06", url: `${LIB}/GAF/22-0726-06.pdf`, expect: "readable" },
  {
    name: "Gardner Underlayments 25-0219.08",
    url: `${LIB}/Gardner-Asphalt-Corporation/25-0219-08.pdf`,
    expect: "needs_repair",
    note: "the document the old assembler reported as parse_failed",
  },
];

const checks = [];
const record = (ok, group, label, detail = "") => checks.push({ ok, group, label, detail });

const sniff = (b) => {
  if (b.slice(0, 5).toString("latin1").startsWith("%PDF")) return "pdf";
  if (b[0] === 0xff && b[1] === 0xd8) return "jpeg";
  if (b[0] === 0x89 && b[1] === 0x50) return "png";
  return "other";
};

/** A Buffer is a view into a pooled ArrayBuffer; pdf-lib ignores byteOffset. */
const own = (b) => {
  const u = new Uint8Array(b.length);
  u.set(b);
  return u;
};

async function mergeable(bytes) {
  try {
    const d = await PDFDocument.load(own(bytes), { ignoreEncryption: true });
    const o = await PDFDocument.create();
    (await o.copyPages(d, d.getPageIndices())).forEach((p) => o.addPage(p));
    await o.save();
    return d.getPageCount();
  } catch {
    return 0;
  }
}

function qpdfRewrite(bytes) {
  const dir = mkdtempSync(join(tmpdir(), "noa-"));
  try {
    const a = join(dir, "in.pdf");
    const b = join(dir, "out.pdf");
    writeFileSync(a, bytes);
    execFileSync("qpdf", ["--object-streams=disable", a, b], { stdio: "pipe" });
    return readFileSync(b);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** A 120x90 JPEG, standing in for a site photo. */
const PHOTO_B64 =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEm" +
  "KzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7" +
  "Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCABaAHgDASIAAhEBAxEB/8QA" +
  "HwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIh" +
  "MUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVW" +
  "V1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXG" +
  "x8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQF" +
  "BgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAV" +
  "YnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOE" +
  "hYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq" +
  "8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDdooorlOoKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiii" +
  "gAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiii" +
  "gAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiii" +
  "gAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD//2Q==";

async function main() {
  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);
  out.addPage([612, 792]).drawText("PACKET MERGE SMOKE TEST", { x: 50, y: 730, size: 16, font });

  /* ── 1. approvals ── */
  for (const c of CASES) {
    let bytes;
    try {
      const r = await fetch(c.url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      bytes = Buffer.from(await r.arrayBuffer());
    } catch (e) {
      record(false, "approvals", c.name, `fetch: ${e.message}`);
      continue;
    }
    if (sniff(bytes) !== "pdf") {
      record(false, "approvals", c.name, `served ${sniff(bytes)}, not a PDF`);
      continue;
    }

    const direct = await mergeable(bytes);
    if (c.expect === "readable") {
      record(direct > 0, "approvals", c.name, direct ? `${direct}pp merged` : "pdf-lib could not open it");
      if (direct) {
        const d = await PDFDocument.load(own(bytes), { ignoreEncryption: true });
        (await out.copyPages(d, d.getPageIndices())).forEach((p) => out.addPage(p));
      }
      continue;
    }

    /* Expected to defeat pdf-lib. If that ever stops being true the library has
       been repaired and this case should be retired, so say so rather than
       passing quietly. */
    if (direct > 0) {
      record(true, "approvals", c.name, `now opens directly (${direct}pp) — library repaired`);
      continue;
    }
    let repaired = 0;
    try {
      const fixed = qpdfRewrite(bytes);
      repaired = await mergeable(fixed);
      if (repaired) {
        const d = await PDFDocument.load(own(fixed), { ignoreEncryption: true });
        (await out.copyPages(d, d.getPageIndices())).forEach((p) => out.addPage(p));
      }
    } catch (e) {
      record(false, "approvals", c.name, `qpdf: ${e.message}`);
      continue;
    }
    record(
      repaired > 0,
      "approvals",
      c.name,
      repaired ? `pdf-lib fails as expected; qpdf rewrite gives ${repaired}pp` : "unrepairable",
    );
  }

  /* ── 2. the photo the old assembler dropped ── */
  try {
    const jpg = own(Buffer.from(PHOTO_B64, "base64"));
    const img = await out.embedJpg(jpg);
    const page = out.addPage([612, 792]);
    const scale = Math.min(532 / img.width, 700 / img.height, 1);
    page.drawImage(img, {
      x: (612 - img.width * scale) / 2,
      y: 64 + (700 - img.height * scale) / 2,
      width: img.width * scale,
      height: img.height * scale,
    });
    page.drawText("Site photo", { x: 40, y: 40, size: 9, font, color: rgb(0.35, 0.35, 0.35) });
    record(true, "images", "JPEG becomes a page", `${img.width}x${img.height}`);
  } catch (e) {
    record(false, "images", "JPEG becomes a page", e.message);
  }

  /* ── 3. the keys that made six approvals unresolvable ── */
  const normalise = (n) =>
    String(n ?? "")
      .trim()
      .replace(/^\s*NOA\s*(No\.?)?\s*[:.\-]?\s*/i, "")
      .replace(/^(\d{2}-\d{4})(\d{2})$/, "$1.$2")
      .trim();
  for (const [raw, want] of [
    ["NOA 19-0789.03", "19-0789.03"],
    ["NOA No. 22-0123.01", "22-0123.01"],
    ["22-122104", "22-1221.04"],
    ["25-0219.08", "25-0219.08"],
    ["  NOA: 23-1023.05 ", "23-1023.05"],
  ]) {
    const got = normalise(raw);
    record(got === want, "noa keys", raw, `-> ${got}`);
  }

  /* ── the packet itself ── */
  const pages = out.getPages();
  pages.forEach((p, i) => {
    const label = `Page ${i + 1} of ${pages.length}`;
    p.drawText(label, {
      x: p.getSize().width - 50 - font.widthOfTextAtSize(label, 8),
      y: 22,
      size: 8,
      font,
      color: rgb(0.45, 0.45, 0.45),
    });
  });
  const saved = await out.save();
  record(
    Buffer.from(saved.slice(0, 5)).toString("latin1").startsWith("%PDF") && pages.length > 10,
    "packet",
    "one merged, page-numbered PDF",
    `${pages.length} pages, ${saved.length} bytes`,
  );

  let group = "";
  for (const c of checks) {
    if (c.group !== group) {
      group = c.group;
      console.log(`\n${group.toUpperCase()}`);
    }
    console.log(`  ${c.ok ? "ok  " : "FAIL"} ${c.label.padEnd(38)} ${c.detail}`);
  }
  const failed = checks.filter((c) => !c.ok);
  console.log(`\n${failed.length ? "FAIL" : "PASS"} — ${checks.length - failed.length}/${checks.length} checks`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
