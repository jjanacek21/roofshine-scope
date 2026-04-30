import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Apply a reviewed assembly_import: create one master_macros row per color group
// the user kept, with master_macro_items referencing the picked line_item_master rows.

type Trade =
  | "roofing" | "exterior" | "windows" | "interior"
  | "hvac" | "plumbing" | "electrical" | "mitigation";

type ApplyItemInput = {
  line_item_master_id: string;
  qty: number;
  unit?: string;
  qty_mode?: "manual" | "count" | "fixed";
  is_optional?: boolean;
  item_notes?: string;
};

type ApplyAssemblyInput = {
  name: string;
  description?: string;
  asset_type: string;            // tile_roof, comp_shingle, chimney, ...
  is_addon: boolean;
  trade?: Trade;
  items: ApplyItemInput[];
};

type ApplyBody = {
  import_id: string;
  assemblies: ApplyAssemblyInput[];
};

export const Route = createFileRoute("/api/apply-assembly-import")({
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

        let body: ApplyBody;
        try {
          body = (await request.json()) as ApplyBody;
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }
        if (!body.import_id || !Array.isArray(body.assemblies) || body.assemblies.length === 0) {
          return Response.json({ error: "import_id and assemblies[] required" }, { status: 400 });
        }

        // Load the import row to determine company scope
        const { data: imp } = await supabase
          .from("assembly_imports")
          .select("id, company_id, status")
          .eq("id", body.import_id)
          .maybeSingle();
        if (!imp) return Response.json({ error: "Import not found" }, { status: 404 });
        if (imp.status === "applied") {
          return Response.json({ error: "Import already applied" }, { status: 409 });
        }

        const created: Array<{ id: string; name: string; item_count: number }> = [];

        for (const a of body.assemblies) {
          if (!a.name || !a.asset_type || !Array.isArray(a.items) || a.items.length === 0) continue;

          const { data: macro, error: mErr } = await supabase
            .from("master_macros")
            .insert({
              company_id: imp.company_id,
              name: a.name,
              description: a.description ?? null,
              trade: (a.trade ?? null) as never,
              kind: "assembly",
              asset_type: a.asset_type,
              is_addon: a.is_addon,
              is_default: imp.company_id === null,
              created_by: userId,
            })
            .select("id")
            .single();
          if (mErr || !macro) {
            return Response.json(
              { error: `Failed to create assembly "${a.name}": ${mErr?.message}` },
              { status: 500 },
            );
          }

          const itemRows = a.items.map((it, idx) => ({
            macro_id: macro.id,
            line_item_master_id: it.line_item_master_id,
            qty: Number(it.qty ?? 0) || 0,
            unit: it.unit ?? null,
            sort_order: idx,
            qty_mode: it.qty_mode ?? "manual",
            is_optional: it.is_optional ?? false,
            item_notes: it.item_notes ?? null,
          }));

          const { error: iErr } = await supabase.from("master_macro_items").insert(itemRows);
          if (iErr) {
            return Response.json(
              { error: `Failed to add items to "${a.name}": ${iErr.message}` },
              { status: 500 },
            );
          }
          created.push({ id: macro.id, name: a.name, item_count: itemRows.length });
        }

        await supabase
          .from("assembly_imports")
          .update({ status: "applied", applied_at: new Date().toISOString() })
          .eq("id", imp.id);

        return Response.json({ created });
      },
    },
  },
});
