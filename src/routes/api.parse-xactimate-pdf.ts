import { createFileRoute } from "@tanstack/react-router";

// Worker-compatible Xactimate PDF line-item extraction.
// Sends the PDF directly to Gemini via the Lovable AI Gateway as a base64
// `application/pdf` part — no pdfjs / unpdf / native deps needed.
// Returns { rows: [{ Code, Description, Unit, "Unit Price", Category }], headers: [...] }

const HEADERS = ["Code", "Description", "Unit", "Unit Price", "Category"] as const;

interface ExtractedRow {
  code: string;
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
    "Extract every line item from the document. For each item return: code (Xactimate selector like RFG 240 or RFG-240), " +
    "description (item name), unit (SQ, LF, EA, HR, SF, etc.), unit_price (number, USD, no $ or commas), " +
    "and category if visible (typically the first 3 letters of the code: RFG, SDG, WDW, etc.). " +
    "Skip headers, totals, and non-item rows. Be exhaustive — include every billable line.";

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
                      description: { type: "string" },
                      unit: { type: "string" },
                      unit_price: { type: "number" },
                      category: { type: "string" },
                    },
                    required: ["code", "description"],
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

          if (items.length < 5) {
            return new Response(
              JSON.stringify({
                error: `Only ${items.length} line items extracted. Try uploading the .xlsx export from Xactimate for better results.`,
              }),
              { status: 422, headers: { "Content-Type": "application/json" } },
            );
          }

          // Normalize into the same row shape the wizard expects.
          const rows = items.map((it) => ({
            Code: String(it.code ?? "").trim(),
            Description: String(it.description ?? "").trim(),
            Unit: String(it.unit ?? "EA").trim().toUpperCase(),
            "Unit Price": typeof it.unit_price === "number" ? it.unit_price : Number(it.unit_price ?? 0) || 0,
            Category: String(it.category ?? "").trim() || (String(it.code ?? "").slice(0, 3).toUpperCase()),
          }));

          return new Response(JSON.stringify({ rows, headers: HEADERS, count: rows.length }), {
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
