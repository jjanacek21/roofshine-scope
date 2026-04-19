import { createFileRoute } from "@tanstack/react-router";

// Worker-compatible PDF text extraction + AI line-item structuring.
// Accepts a multipart/form-data POST with a `file` field (PDF).
// Returns { rows: [{ Code, Description, Unit, "Unit Price", Category }], headers: [...] }

const HEADERS = ["Code", "Description", "Unit", "Unit Price", "Category"] as const;

async function extractPdfText(buffer: ArrayBuffer): Promise<string> {
  // pdfjs-dist legacy build works in Workers (no DOM dependency).
  const pdfjs = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as unknown as {
    GlobalWorkerOptions: { workerSrc: string };
    getDocument: (params: Record<string, unknown>) => { promise: Promise<{ numPages: number; getPage: (n: number) => Promise<{ getTextContent: () => Promise<{ items: unknown[] }> }> }> };
  };
  // Disable worker — run inline (Workers don't allow nested workers).
  pdfjs.GlobalWorkerOptions.workerSrc = "";

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    useSystemFonts: false,
  });
  const doc = await loadingTask.promise;

  const parts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((it: unknown) => (typeof (it as { str?: string }).str === "string" ? (it as { str: string }).str : ""))
      .join(" ");
    parts.push(text);
  }
  return parts.join("\n\n");
}

interface ExtractedRow {
  code: string;
  description: string;
  unit?: string;
  unit_price?: number;
  category?: string;
}

async function callAIExtract(rawText: string): Promise<ExtractedRow[]> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

  // Truncate to keep within model context (Gemini 2.5 Pro can handle a lot, but be safe).
  const text = rawText.length > 180_000 ? rawText.slice(0, 180_000) : rawText;

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
        { role: "user", content: `Extract all line items from this Xactimate document:\n\n${text}` },
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
          const text = await extractPdfText(buf);

          if (!text || text.trim().length < 50) {
            return new Response(
              JSON.stringify({
                error:
                  "Couldn't extract text from this PDF — it may be a scanned/image-only export. Try uploading the .xlsx export from Xactimate instead.",
              }),
              { status: 422, headers: { "Content-Type": "application/json" } },
            );
          }

          const items = await callAIExtract(text);

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
