## Goal

Save the complete `GCN-Sign.html` to `public/sign/` so the Contract iframe loads it from the same origin. All the plumbing (per-tenant URL override, iframe load fallback, "Open in new tab", DB column) is already in place from the previous turn.

## What I'll do on approval

### 1. Reassemble the full HTML file from your 3 paste parts

Stitch parts 1, 2, and 3 back together into one valid `GCN-Sign.html`. Notes on reassembly:

- **Part 1 was truncated mid-`<head>`** (cut off in the initial paste). I have the `<head>` from part 2 onwards. I'll reconstruct the opening `<head>` block (charset, viewport, jsPDF CDN, title) — these are standard and visible from the part-2 CSS preamble.
- **Part 2 contains the body markup** but the chat stripped tag attributes / class names from the visible text (e.g. headers, buttons, fields show as plain text). I'll need to reconstruct the actual JSX-equivalent HTML for the steps from the visible structure (step labels, field labels, option groups, etc.). The CSS class hooks (`option-card`, `dtp-option`, `initial-input`, `sig-pad`, `nav-bar`, `step[data-step="N"]`, etc.) are all defined and the JS references specific IDs — I'll wire markup to match the IDs the JS expects.
- **Part 3 is the complete `<script>`** — schemas, state, sig pads, validation, PDF generation, download/email. Pasted verbatim.

### 2. Write to `public/sign/GCN-Sign.html`

Single self-contained file. jsPDF loaded from CDN (already in the HTML). No other assets needed — QR code is inlined as base64 in the PDF generator.

### 3. Verify the wiring end-to-end

- Confirm `public/sign/GCN-Sign.html` is served at `/sign/GCN-Sign.html` (TanStack Start serves `public/` as static).
- Confirm `buildSigningUrl` in `src/lib/contract-config.ts` defaults to `/sign` and the URL params (`rep`, `type`, `jobId`, `tenantId`, `customerName`, etc.) match what the HTML's `init()` reads (`URLSearchParams.get('rep')`, `get('type')`).
- The HTML's `REPS` object is hardcoded with 5 GCN reps keyed by slug. The `rep` param from the iframe is `tenantUser.rep_slug` — confirm the seeded tenant_users have matching slugs (`jared`, `austin`, `aj`, `joey`, `michael`), or the HTML will fall back to Jared.

### 4. One small follow-up I'll flag (not block on)

The HTML's `submitAgreement()` only generates the PDF client-side and opens mailto. It does **not** POST the signed PDF back to your app. Your existing `UploadSignedContractDialog` handles upload separately (rep clicks "Save signed contract" → uploads the downloaded PDF). That's the intended flow for now — works, but means the rep does an extra step.

A future improvement: have the iframe `postMessage` the PDF blob to the parent on sign completion so it auto-uploads. I won't do that now — wait until you confirm the basic flow works.

## Risk

The body markup in part 2 came through with class names and attributes stripped by the chat renderer. I'll reconstruct it carefully to match the IDs the JS expects, but you should test the full 5-step flow once it's deployed and tell me anything that looks off (missing field, broken step transition, signature pad not showing). Easy to fix iteratively.

## Files touched

- **Created**: `public/sign/GCN-Sign.html` (single file, ~1500 lines)

No other files change — all the React-side plumbing is already done.