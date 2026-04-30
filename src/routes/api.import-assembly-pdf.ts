import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Color-coded Xactimate intake.
// User uploads a PDF whose line items are highlighted in different colors.
// Gemini 2.5 Pro reads the PDF and returns groups of highlighted text by color.
// We then fuzzy-match each highlighted snippet against `line_item_master` and
// return a per-color draft for the user to review before saving as assemblies.

type ColorGroupAI = {
  color_hex: string;       // e.g. "#FFFF00" — the dominant highlight color
  color_label: string;     // e.g. "yellow", "lime green", "pink"
  items: Array<{
    raw_text: string;      // the highlighted text as Gemini saw it (may contain code prefix)
    code_guess?: string;   // selector code if visible, e.g. "RFG 240"
    line_number?: number;  // numbered-list prefix from Xactimate ("9.", "104.")
  }>;
};

type CatalogRow = {
  id: string;
  code: string;
  name: string;
  unit: string;
  default_price: number;
  trade: string;
  category: string | null;
};

type MatchedItem = {
  raw_text: string;
  code_guess?: string;
  line_number?: number;
  matched: {
    line_item_master_id: string;
    code: string;
    name: string;
    unit: string;
    trade: string;
    default_price: number;
    score: number;       // 0..1
  } | null;
};

type ColorGroupResult = {
  color_hex: string;
  color_label: string;
  items: MatchedItem[];
  unmatched_count: number;
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

const STOPWORDS = new Set([
  "the", "and", "or", "of", "for", "to", "with", "a", "an",
  "r&r", "remove", "replace", "install", "detach", "reset",
  "per", "lf", "sf", "sq", "ea", "hr", "cy",
]);

function tokenize(s: string): string[] {
  return (s.toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t)));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

function bestMatch(
  rawText: string,
  codeGuess: string | undefined,
  catalog: CatalogRow[],
  catalogTokenCache: Map<string, Set<string>>,
): MatchedItem["matched"] {
  // Direct code match wins outright
  if (codeGuess) {
    const codeNorm = codeGuess.replace(/\s+/g, "").toUpperCase();
    const direct = catalog.find((c) => c.code.replace(/\s+/g, "").toUpperCase() === codeNorm);
    if (direct) {
      return {
        line_item_master_id: direct.id,
        code: direct.code,
        name: direct.name,
        unit: direct.unit,
        trade: direct.trade,
        default_price: Number(direct.default_price ?? 0),
        score: 1,
      };
    }
  }

  const queryTokens = new Set(tokenize(rawText));
  if (queryTokens.size === 0) return null;

  let best: { row: CatalogRow; score: number } | null = null;
  for (const row of catalog) {
    let cached = catalogTokenCache.get(row.id);
    if (!cached) {
      cached = new Set([...tokenize(row.name), ...tokenize(row.code)]);
      catalogTokenCache.set(row.id, cached);
    }
    const score = jaccard(queryTokens, cached);
    if (!best || score > best.score) best = { row, score };
  }

  if (!best || best.score < 0.35) return null;
  return {
    line_item_master_id: best.row.id,
    code: best.row.code,
    name: best.row.name,
    unit: best.row.unit,
    trade: best.row.trade,
    default_price: Number(best.row.default_price ?? 0),
    score: Number(best.score.toFixed(2)),
  };
}

async function callAIExtractColors(pdfBuffer: ArrayBuffer): Promise<ColorGroupAI[]> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

  const b64 = arrayBufferToBase64(pdfBuffer);

  const systemPrompt =
    "You are extracting COLOR-HIGHLIGHTED line items from an Xactimate insurance estimate PDF. " +
    "The user has highlighted certain line items in distinct colors (yellow, green, blue, pink, orange, purple, etc.). " +
    "Each color represents a different ASSEMBLY GROUP (for example yellow = base shingle roof items, green = chimney items). " +
    "Your job: walk the entire document, find every highlighted line item, and group them by their highlight color. " +
    "For each highlighted line item, capture: " +
    "- raw_text: the FULL line item text exactly as printed (including selector code if shown, e.g. 'R&R Composition shingle roofing - laminated'). " +
    "- code_guess: ONLY if an explicit Xactimate selector code is visible (like 'RFG 240'). Omit otherwise. " +
    "- line_number: the integer prefix if the line is numbered (e.g. '9' for '9. R&R drywall'). " +
    "Group all items sharing the SAME highlight color into a single color group. " +
    "color_hex should be the dominant hex color of the highlight (best estimate, e.g. '#FFFF00' for yellow). " +
    "color_label should be a human-friendly name ('yellow', 'lime green', 'hot pink'). " +
    "Skip page headers, footers, totals, and any non-highlighted text. " +
    "Be exhaustive — there can be 5–60 highlighted items per color across many pages.";

  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            { type: "text", text: "Return all highlighted line items grouped by highlight color." },
            { type: "image_url", image_url: { url: `data:application/pdf;base64,${b64}` } },
          ],
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "return_color_groups",
            description: "Return the highlighted line items grouped by highlight color.",
            parameters: {
              type: "object",
              properties: {
                color_groups: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      color_hex: { type: "string" },
                      color_label: { type: "string" },
                      items: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            raw_text: { type: "string" },
                            code_guess: { type: "string" },
                            line_number: { type: "integer" },
                          },
                          required: ["raw_text"],
                        },
                      },
                    },
                    required: ["color_hex", "color_label", "items"],
                  },
                },
              },
              required: ["color_groups"],
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "return_color_groups" } },
    }),
  });

  if (!r.ok) {
    const txt = await r.text();
    if (r.status === 429) throw new Error("Rate limit exceeded — try again in a moment.");
    if (r.status === 402) throw new Error("AI credits exhausted.");
    throw new Error(`AI gateway error (${r.status}): ${txt.slice(0, 300)}`);
  }

  const ai = (await r.json()) as {
    choices?: Array<{ message?: { tool_calls?: Array<{ function?: { arguments?: string } }> } }>;
  };
  const args = ai.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) return [];
  try {
    const parsed = JSON.parse(args) as { color_groups?: ColorGroupAI[] };
    return parsed.color_groups ?? [];
  } catch {
    return [];
  }
}

export const Route = createFileRoute("/api/import-assembly-pdf")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = authHeader.replace("Bearer ", "");

        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Server misconfigured", { status: 500 });
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });
        const { data: claims, error: cErr } = await supabase.auth.getClaims(token);
        if (cErr || !claims?.claims?.sub) return new Response("Unauthorized", { status: 401 });
        const userId = claims.claims.sub as string;

        // Parse multipart form
        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return Response.json({ error: "Expected multipart/form-data" }, { status: 400 });
        }
        const file = form.get("file");
        if (!(file instanceof File)) {
          return Response.json({ error: "No file uploaded" }, { status: 400 });
        }
        if (file.size > 25 * 1024 * 1024) {
          return Response.json({ error: "PDF too large (max 25MB)" }, { status: 400 });
        }

        // Determine company. Super admins may import master-level (company_id null).
        const { data: profile } = await supabase
          .from("profiles")
          .select("company_id, role")
          .eq("id", userId)
          .maybeSingle();
        const isSuperAdmin = profile?.role === "super_admin";
        const companyIdParam = (form.get("company_id") as string | null) || profile?.company_id || null;
        const targetCompanyId =
          isSuperAdmin && (form.get("master") === "true") ? null : companyIdParam;

        // Save the PDF to xactimate-uploads
        const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const folder = targetCompanyId ?? "_master";
        const storagePath = `${folder}/assemblies/${Date.now()}_${cleanName}`;
        const buffer = await file.arrayBuffer();
        const { error: upErr } = await supabase.storage
          .from("xactimate-uploads")
          .upload(storagePath, new Uint8Array(buffer), {
            contentType: "application/pdf",
            upsert: false,
          });
        if (upErr) {
          return Response.json({ error: `Upload failed: ${upErr.message}` }, { status: 500 });
        }

        // Pull catalog scoped to this company (or master if super admin importing master)
        const orFilter = targetCompanyId
          ? `company_id.eq.${targetCompanyId},company_id.is.null`
          : "company_id.is.null";
        const { data: catalog } = await supabase
          .from("line_item_master")
          .select("id, code, name, unit, default_price, trade, category")
          .eq("status", "active")
          .or(orFilter)
          .limit(2000);
        const catalogRows = (catalog ?? []) as CatalogRow[];

        // Run AI extraction
        let aiGroups: ColorGroupAI[];
        try {
          aiGroups = await callAIExtractColors(buffer);
        } catch (e) {
          return Response.json(
            { error: e instanceof Error ? e.message : "AI extraction failed" },
            { status: 502 },
          );
        }

        // Fuzzy match each item against the catalog
        const catalogTokenCache = new Map<string, Set<string>>();
        const matched: ColorGroupResult[] = aiGroups.map((g) => {
          const items: MatchedItem[] = g.items.map((it) => ({
            raw_text: it.raw_text,
            code_guess: it.code_guess,
            line_number: it.line_number,
            matched: bestMatch(it.raw_text, it.code_guess, catalogRows, catalogTokenCache),
          }));
          return {
            color_hex: g.color_hex,
            color_label: g.color_label,
            items,
            unmatched_count: items.filter((i) => !i.matched).length,
          };
        });

        // Persist the parse result for review
        const { data: imp, error: insErr } = await supabase
          .from("assembly_imports")
          .insert({
            company_id: targetCompanyId,
            uploaded_by: userId,
            source_path: storagePath,
            filename: file.name,
            status: "reviewing",
            parsed: { colors: matched },
          })
          .select("id")
          .single();
        if (insErr || !imp) {
          return Response.json({ error: insErr?.message ?? "DB insert failed" }, { status: 500 });
        }

        return Response.json({
          import_id: imp.id,
          colors: matched,
          total_items: matched.reduce((sum, c) => sum + c.items.length, 0),
          matched_items: matched.reduce(
            (sum, c) => sum + c.items.filter((i) => !!i.matched).length,
            0,
          ),
        });
      },
    },
  },
});
