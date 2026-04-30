# Fix iframe loading + bundle the GCN gold logo

Two issues from your report:

1. Iframe still requires "Open in new tab"
2. The PDF shows a hand-drawn "GCN" wordmark instead of your real logo

## Issue 1 — Iframe blocked

`src/routes/api/public/sign.ts` sends `x-frame-options: SAMEORIGIN`. The
signing HTML is served from `project--{id}-dev.lovable.app`, but the editor
iframe parent is `id-preview--{id}.lovable.app` — a different origin, so
SAMEORIGIN blocks framing. New tab works because there's no parent.

**Fix:** delete the `x-frame-options` header line. The endpoint is
intentionally public and meant to be embedded.

## Issue 2 — Wrong logo

The signer (`src/sign/GCN-Sign.html`) doesn't contain a logo image at all.
The on-screen header is text-only, and the PDF (line ~1901) draws the
literal string "GCN" in yellow. That's the "wrong logo."

**Fix:**

1. Save the uploaded `LOGO_GOLD.png` to `src/sign/assets/gcn-logo.png`.
2. Inline it as a base64 data URI inside `GCN-Sign.html` so the file stays
   self-contained (matches how the rest of the signer is structured —
   single bundled HTML, no extra fetches).
3. **On-screen header (~line 372):** replace the text-only `.brand` block
   with `<img class="brand-mark" src="{dataUri}" />` sized ~36px tall, with
   the company name + address text alongside it.
4. **PDF header (~lines 1896–1909):** replace `doc.text('GCN', ...)` with
   `doc.addImage(LOGO_DATA_URI, 'PNG', M, 6, 26, 26)` — a 26×26pt mark on
   the black bar, with the company name/address text shifted to sit
   alongside it. Keep the gold underline rule below the bar.
5. Tweak: bump the favicon in the `<head>` to use the same data URI so the
   new tab also picks up the brand mark.

## What I'm not changing

- Per-tenant logo override (`tenants.logo_base64`) — already a TODO in the
  memory; deferring until you onboard another tenant. Single-tenant for
  now means the bundled asset is fine.
- The signer's signature/PDF logic itself.

## Verification

- Reload `/jobs/.../contract` → Construction Agreement → Step 1 of 5 must
  render directly inside the preview iframe (no broken-document icon, no
  "Open in new tab").
- Walk to Step 5, download → confirm PDF header shows the gold GCN mark
  instead of the "GCN" text.
- Sanity check: open the PDF in a viewer, look at it side by side with
  `LOGO_GOLD.png` to confirm the mark renders crisply at 26pt.
