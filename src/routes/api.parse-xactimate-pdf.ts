import { createFileRoute } from "@tanstack/react-router";

// Worker-compatible Xactimate PDF line-item extraction.
// Sends the PDF directly to Gemini via the Lovable AI Gateway as a base64
// `application/pdf` part — no pdfjs / unpdf / native deps needed.
// Returns { rows: [{ Code, Description, Unit, "Unit Price", Category }], headers: [...] }

const HEADERS = ["Code", "Description", "Unit", "Unit Price", "Category"] as const;

interface ExtractedRow {
  code?: string;
  line_number?: number;
  description: string;
  unit?: string;
  unit_price?: number;
  category?: string;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  // btoa is available in the Worker runtime.
  return btoa(binary);
}

async function callAIExtractFromPdf(pdfBuffer: ArrayBuffer): Promise<ExtractedRow[]> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

  const b64 = arrayBufferToBase64(pdfBuffer);

  const systemPrompt =
    "You are an expert at parsing Xactimate insurance estimates and contractor price lists. " +
    "Extract EVERY SINGLE line item from EVERY page of the document — do not stop until the last page is processed. " +
    "Many Xactimate PDFs do not show selector codes (RFG 240); instead, line items are NUMBERED ('9. R&R 1/2\" drywall…', '104. R&R Ridge cap…'). " +
    "When there is no explicit selector code, leave `code` empty and put the line number in `line_number`. " +
    "For each item return: " +
    "`description` (the text after `N. `, joined across wrapped lines, no trailing units or numbers); " +
    "`unit` (parsed from the QTY column — values like '1.00 SQ' → 'SQ'; if only a unit appears with no qty, still return it: SQ, LF, EA, HR, SF, CY, BF, etc.); " +
    "`unit_price` (USD number, no $ or commas — use the LARGER of REMOVE / REPLACE columns; if both are 0 and TOTAL > 0, divide TOTAL by qty); " +
    "`category` (the section header above the row — 'Main Level', 'Roof1', 'Exterior', 'Garage', etc.); " +
    "`code` (only if an explicit selector like 'RFG 240' is shown — otherwise omit); " +
    "`line_number` (the integer prefix, e.g. 9 for '9. R&R drywall'). " +
    "Skip page footers, table headers ('DESCRIPTION QTY REMOVE REPLACE TAX TOTAL'), 'CONTINUED -' rows, totals/subtotals, and the cover page. " +
    "Be exhaustive — a typical Xactimate has 100–400 line items spread across 10–30 pages.";

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract every line item from this Xactimate estimate PDF." },
            {
              type: "image_url",
              image_url: { url: `data:application/pdf;base64,${b64}` },
            },
          ],
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "return_line_items",
            description: "Return the extracted line items.",
            parameters: {
              type: "object",
              properties: {
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      code: { type: "string" },
                      line_number: { type: "number" },
                      description: { type: "string" },
                      unit: { type: "string" },
                      unit_price: { type: "number" },
                      category: { type: "string" },
                    },
                    required: ["description"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["items"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "return_line_items" } },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 429) throw new Error("AI rate limit exceeded — try again in a minute.");
    if (response.status === 402) throw new Error("AI credits exhausted — top up in Settings → Workspace → Usage.");
    throw new Error(`AI gateway error ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = await response.json();
  const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) throw new Error("AI returned no structured items.");
  const parsed = JSON.parse(toolCall.function.arguments);
  return Array.isArray(parsed.items) ? parsed.items : [];
}

export const Route = createFileRoute("/api/parse-xactimate-pdf")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const form = await request.formData();
          const file = form.get("file");
          if (!(file instanceof File)) {
            return new Response(JSON.stringify({ error: "Missing file" }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }
          if (file.size > 25 * 1024 * 1024) {
            return new Response(JSON.stringify({ error: "PDF exceeds 25 MB" }), {
              status: 413,
              headers: { "Content-Type": "application/json" },
            });
          }

          const buf = await file.arrayBuffer();
          const items = await callAIExtractFromPdf(buf);

          if (items.length === 0) {
            return new Response(
              JSON.stringify({
                error: "No line items extracted from the PDF. Try uploading the .xlsx export from Xactimate instead.",
              }),
              { status: 422, headers: { "Content-Type": "application/json" } },
            );
          }

          // Normalize into the same row shape the wizard expects.
          // Derive a synthetic Code when the AI didn't return a selector code (common for line-numbered Xactimates).
          const rows = items.map((it) => {
            const explicitCode = String(it.code ?? "").trim();
            const category = String(it.category ?? "").trim();
            const catSlug = category ? category.replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase() : "GEN";
            const lineNum = typeof it.line_number === "number" ? it.line_number : undefined;
            const code = explicitCode || (lineNum != null ? `${catSlug}-${lineNum}` : `${catSlug}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`);
            return {
              Code: code,
              Description: String(it.description ?? "").trim(),
              Unit: String(it.unit ?? "EA").trim().toUpperCase() || "EA",
              "Unit Price": typeof it.unit_price === "number" ? it.unit_price : Number(it.unit_price ?? 0) || 0,
              Category: category || (explicitCode ? explicitCode.slice(0, 3).toUpperCase() : "General"),
            };
          });

          const warning = rows.length < 5
            ? `Only ${rows.length} line items extracted — the PDF may be scanned or unusually formatted. Review carefully or upload the .xlsx export instead.`
            : undefined;

          return new Response(JSON.stringify({ rows, headers: HEADERS, count: rows.length, warning }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          console.error("parse-xactimate-pdf error:", e);
          return new Response(
            JSON.stringify({ error: e instanceof Error ? e.message : "Failed to parse PDF" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
