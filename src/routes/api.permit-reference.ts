import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

/**
 * Read-only door onto the permit reference library.
 *
 * The library — building departments, their rules, the form templates and the
 * field maps that let us fill them, the product approvals, the fastener
 * schedules — is not this app's data. It is the same for every company and it
 * now lives in one place: the `network` schema on Global Contractor Network's
 * own Supabase project, surfaced there as read-only views.
 *
 * The browser never talks to that project. Two reasons:
 *
 *  1. A user signed in here holds a JWT issued by *this* project. It means
 *     nothing to another one, so there is no way for the browser to
 *     authenticate against the library.
 *  2. The views are granted to `authenticated` and deliberately not to `anon`,
 *     because the anon key ships inside every published bundle and this library
 *     is the product.
 *
 * So the request comes here with the caller's own token, this route checks that
 * token against this project, and only then reads the library with a key that
 * exists solely on the server. The query surface is a fixed allowlist of
 * resources and filters — never a passthrough — so a caller cannot reach
 * anything the app does not already show.
 */

/** Where the library lives. Set both on the server; neither is public. */
const REFERENCE_URL = () => process.env.REFERENCE_SUPABASE_URL;
const REFERENCE_KEY = () => process.env.REFERENCE_SUPABASE_SERVICE_KEY;

/**
 * The blank forms themselves are still in the bucket they were uploaded to.
 * Rows carry a bucket-relative path, so the absolute URL is built here rather
 * than baked into the data — when the files move, this constant moves with
 * them and no row has to be rewritten.
 */
const FORM_BUCKET_BASE = () =>
  process.env.PERMIT_FORM_BUCKET_BASE ??
  "https://ujalvgknnbsxqpujxvwk.supabase.co/storage/v1/object/public/permit-form-templates";

type Client = ReturnType<typeof createClient>;

/** A filter the caller is allowed to send, and the column it maps to. */
type Filters = Record<string, string>;

interface Resource {
  /** View in the library's `public` schema. */
  view: string;
  columns: string;
  /** Query param → column, for exact matches. */
  eq?: Filters;
  /** Query param → columns searched with ILIKE, comma-separated. */
  search?: Record<string, string[]>;
  /** Query param → column, for `= true` when the param is "1"/"true". */
  flag?: Filters;
  order?: { column: string; ascending?: boolean };
  maxLimit: number;
  defaultLimit: number;
}

const RESOURCES: Record<string, Resource> = {
  departments: {
    view: "permit_building_departments",
    columns:
      "id, name, jurisdiction_type, county, city, website, portal_url, submission_method, processing_time, phone, email, address, hours, zip_codes, is_hvhz, notes",
    eq: { county: "county", city: "city", jurisdiction_type: "jurisdiction_type" },
    flag: { hvhz: "is_hvhz" },
    order: { column: "name" },
    maxLimit: 500,
    defaultLimit: 200,
  },
  required_documents: {
    view: "permit_required_documents",
    columns:
      "id, building_dept_id, trade_type, document_name, document_url, is_required, notes, sort_order",
    eq: { building_dept_id: "building_dept_id", trade_type: "trade_type" },
    order: { column: "sort_order" },
    maxLimit: 500,
    defaultLimit: 200,
  },
  form_templates: {
    view: "permit_form_templates",
    columns:
      "id, building_dept_id, jurisdiction_name, county, city, form_type, form_name, form_version, trade_types, file_path, field_mapping, is_fillable, field_count, requires_signature, requires_notary, notary_threshold, page_count, hvhz_only, instructions, common_errors, analysis_status, notes",
    eq: {
      building_dept_id: "building_dept_id",
      county: "county",
      city: "city",
      form_type: "form_type",
    },
    flag: { fillable: "is_fillable" },
    order: { column: "form_name" },
    maxLimit: 300,
    defaultLimit: 100,
  },
  field_mappings: {
    view: "permit_field_mappings",
    columns:
      "id, template_id, our_field, pdf_field, field_type, is_required, page_number, default_value, transform_function, transform_type, section, conditional_logic, validation_pattern, notes",
    eq: { template_id: "template_id" },
    order: { column: "page_number" },
    maxLimit: 800,
    defaultLimit: 500,
  },
  form_requirements: {
    view: "permit_form_requirements",
    columns:
      "id, building_dept_id, permit_type, conditions, required_template_ids, priority, notes",
    eq: { building_dept_id: "building_dept_id", permit_type: "permit_type" },
    order: { column: "priority" },
    maxLimit: 200,
    defaultLimit: 100,
  },
  department_rules: {
    view: "building_department_rules",
    columns:
      "id, building_department_id, county, city, rule_type, permit_types, rule_description, rule_action, document_required, is_active, priority",
    eq: {
      building_department_id: "building_department_id",
      county: "county",
      city: "city",
      rule_type: "rule_type",
    },
    order: { column: "priority" },
    maxLimit: 400,
    defaultLimit: 200,
  },
  inspections: {
    view: "permit_inspections",
    columns:
      "id, inspection_type, inspection_code, category, description, is_required, order_in_sequence, prerequisites",
    eq: { category: "category", inspection_type: "inspection_type" },
    order: { column: "order_in_sequence" },
    maxLimit: 200,
    defaultLimit: 200,
  },
  fastener_patterns: {
    view: "fastener_patterns",
    columns:
      "id, jurisdiction_county, jurisdiction_city, is_hvhz, zone_type, roof_material, deck_type, fastener_for, nail_type, nail_length, nail_gauge, spacing_inches, spacing_description, nails_per_square, source_document, source_page, notes",
    eq: {
      county: "jurisdiction_county",
      city: "jurisdiction_city",
      roof_material: "roof_material",
      zone_type: "zone_type",
      deck_type: "deck_type",
    },
    flag: { hvhz: "is_hvhz" },
    order: { column: "jurisdiction_county" },
    maxLimit: 300,
    defaultLimit: 200,
  },
  roofing_materials: {
    view: "roofing_materials",
    columns: "id, name, category, unit_of_measure, cost_per_unit, supplier, description",
    eq: { category: "category" },
    order: { column: "name" },
    maxLimit: 300,
    defaultLimit: 200,
  },
  approvals: {
    view: "product_approvals",
    columns:
      "id, manufacturer, product_name, product_line, product_category, noa_number, fl_product_approval, approval_date, expiration_date, hvhz_approved, applicable_trades, wind_speed_rating, noa_pdf_url, fl_approval_pdf_url, ul_listing_url, installation_guide_url, file_url",
    eq: { category: "product_category", manufacturer: "manufacturer" },
    search: {
      q: ["manufacturer", "product_name", "noa_number", "fl_product_approval"],
    },
    flag: { hvhz: "hvhz_approved" },
    order: { column: "manufacturer" },
    maxLimit: 500,
    defaultLimit: 60,
  },
};

/** PostgREST's `or` takes a comma-separated list, so these characters must go. */
const sanitize = (s: string) =>
  s
    .replace(/[%,()*\\]/g, " ")
    .trim()
    .slice(0, 80);

const isTrue = (v: string | null) => v === "1" || v === "true" || v === "yes";

function absoluteFormUrl(filePath: unknown): string | null {
  if (typeof filePath !== "string" || !filePath) return null;
  if (/^https?:\/\//i.test(filePath)) return filePath;
  return `${FORM_BUCKET_BASE().replace(/\/$/, "")}/${filePath.replace(/^\/+/, "")}`;
}

export const Route = createFileRoute("/api/permit-reference")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const name = url.searchParams.get("resource") ?? "";
        const spec = RESOURCES[name];
        if (!spec) {
          return Response.json(
            { error: "Unknown resource", available: Object.keys(RESOURCES) },
            { status: 400 },
          );
        }

        /* ── the caller must be signed in to THIS app ── */
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = authHeader.slice("Bearer ".length);

        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
          return new Response("Server misconfigured", { status: 500 });
        }
        const app = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });
        const { data: claims, error: claimErr } = await app.auth.getClaims(token);
        if (claimErr || !claims?.claims?.sub) return new Response("Unauthorized", { status: 401 });

        /* ── read the library ── */
        const refUrl = REFERENCE_URL();
        const refKey = REFERENCE_KEY();
        if (!refUrl || !refKey) {
          return Response.json(
            {
              error:
                "Permit reference library is not configured. Set REFERENCE_SUPABASE_URL and REFERENCE_SUPABASE_SERVICE_KEY on the server.",
            },
            { status: 503 },
          );
        }

        const library: Client = createClient(refUrl, refKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        let q = library.from(spec.view).select(spec.columns);

        for (const [param, column] of Object.entries(spec.eq ?? {})) {
          const v = url.searchParams.get(param);
          if (v) q = q.eq(column, v);
        }
        for (const [param, column] of Object.entries(spec.flag ?? {})) {
          const v = url.searchParams.get(param);
          if (v !== null && isTrue(v)) q = q.eq(column, true);
        }
        for (const [param, columns] of Object.entries(spec.search ?? {})) {
          const raw = url.searchParams.get(param);
          const term = raw ? sanitize(raw) : "";
          if (term) q = q.or(columns.map((c) => `${c}.ilike.%${term}%`).join(","));
        }
        /* Every view has is_active except the ones that never needed it. */
        if (spec.view === "product_approvals" || spec.view === "building_department_rules") {
          q = q.eq("is_active", true);
        }
        if (spec.order)
          q = q.order(spec.order.column, { ascending: spec.order.ascending !== false });

        const asked = Number(url.searchParams.get("limit") ?? spec.defaultLimit);
        const limit = Math.min(
          Number.isFinite(asked) && asked > 0 ? Math.floor(asked) : spec.defaultLimit,
          spec.maxLimit,
        );

        const { data, error } = await q.limit(limit);
        if (error) {
          console.error("permit-reference", name, error);
          return Response.json({ error: "Could not read the permit library" }, { status: 502 });
        }

        let rows = (data ?? []) as Record<string, unknown>[];
        if (spec.view === "permit_form_templates") {
          rows = rows.map((r) => ({ ...r, form_url: absoluteFormUrl(r.file_path) }));
        }

        return Response.json(
          { resource: name, count: rows.length, rows },
          {
            /* Reference data changes on the order of weeks, and every signed-in
               user gets the same answer — but it is per-user authorised, so the
               cache is the browser's alone, never a shared one. */
            headers: { "cache-control": "private, max-age=300" },
          },
        );
      },
    },
  },
});
