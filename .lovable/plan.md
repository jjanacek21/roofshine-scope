

## Goal

Make Xactimate PDF uploads actually return line items — right now the dropzone shows **"Failed to execute 'json' on 'Response': Unexpected end of JSON input"** because the server returned an empty body.

## Root cause

The endpoint `/api/parse-xactimate-pdf` uses the **`unpdf`** package to extract text from the PDF before sending it to the AI. `unpdf` internally bundles `pdfjs`, which crashes inside the Cloudflare Worker runtime as soon as a real PDF is parsed (visible in dev-server stderr: `file:///dev-server/node_modules/unpdf/dist/pdfjs.mjs:54 … at #t`). The crash kills the worker request **before** our handler's try/catch can return JSON, so the browser sees an empty 200/500 body and `resp.json()` throws.

In short: `unpdf` is not Worker-compatible for arbitrary Xactimate PDFs.

## Fix

**Stop trying to extract text in the Worker. Send the PDF directly to Gemini.** Gemini 2.5 Pro (which we already use via the Lovable AI Gateway) accepts native PDF input as a base64-encoded `application/pdf` part on the user message — no pdfjs, no text extraction step, no Node dependencies, and it actually produces *better* results because Gemini sees the original Xactimate layout (columns, totals, page breaks) instead of a flattened text dump.

### What changes

1. **`src/routes/api.parse-xactimate-pdf.ts`**
   - Remove the `extractPdfText` function and the `unpdf` import entirely.
   - Read the uploaded PDF as an `ArrayBuffer`, base64-encode it.
   - Call the AI gateway with a multimodal message:
     ```ts
     messages: [
       { role: "system", content: <existing extraction prompt> },
       { role: "user", content: [
           { type: "text", text: "Extract every line item from this Xactimate estimate." },
           { type: "image_url", image_url: { url: `data:application/pdf;base64,${b64}` } },
       ]},
     ]
     ```
   - Keep the same `return_line_items` tool-call schema and the same final response shape (`{ rows, headers, count }`) so the client component is unchanged.
   - Keep the 25 MB size guard.
   - Keep the existing 422/429/402 error mapping.

2. **`src/components/pricebook/UploadParseStep.tsx`** — defensive parse so the user gets a useful error even if the worker ever returns empty again:
   ```ts
   const text = await resp.text();
   const data = text ? JSON.parse(text) : { error: "Server returned an empty response — try again." };
   ```
   Replaces the bare `resp.json()` on line 62.

3. **`package.json`** — remove `unpdf` dependency since nothing else uses it (kept the bundle smaller and removes a fragile Worker dep).

### What stays the same

- Excel / CSV path (`extractEstimateFromSpreadsheet`) — unchanged, already works.
- Client component, wizard steps, mapping UI, save logic — unchanged.
- The AI prompt, the tool schema, the `≥5 items` guard — unchanged.
- No DB or schema changes.

## Result

Drop a Xactimate PDF on the upload step → Gemini reads the PDF directly → 10–30 s later the dropzone flips to "AI extracted N line items" → Step 2 auto-fills the name from the filename → Save publishes the master pricing library. The "Unexpected end of JSON input" error is gone because (a) the Worker stops crashing, and (b) the client tolerates empty bodies with a clear message.

## Out of scope

- No changes to the company-side pricing wizard logic (it shares the same endpoint, so it benefits automatically).
- No OCR fallback for scanned-only PDFs — Gemini handles vision-based PDFs natively, so this is no longer needed.

