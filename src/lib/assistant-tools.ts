// Tool definitions for the AI assistant. Shape follows the OpenAI-compatible
// function-calling schema that Lovable AI Gateway forwards to Gemini.
//
// These are just declarations — actual execution lives server-side in
// src/routes/api.assistant-chat.ts, which reads the tool name and args and
// dispatches with the authenticated user's Supabase client.

export type ToolDef = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export const ASSISTANT_TOOLS: ToolDef[] = [
  {
    type: "function",
    function: {
      name: "navigate",
      description:
        "Navigate the app to a specific route. Use for 'open leads', 'go to jobs', 'take me to settings'.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description:
              "App route. Examples: /leads, /jobs, /jobs/new, /jobs/{id}/estimate, /jobs/{id}/order-form, /jobs/{id}/measure, /jobs/{id}/photos, /jobs/{id}/report, /invoices, /settings, /team, /clients, /price-books",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "explain_feature",
      description:
        "Explain what a section of the app does and how to use it. Use when the user asks 'how do I…' or 'what is this'.",
      parameters: {
        type: "object",
        properties: {
          topic: {
            type: "string",
            description:
              "Feature/topic key. Examples: leads, jobs, estimate, order_form, measurement, photos, report, invoices, contracts, settings, team, price_books, door_to_door",
          },
        },
        required: ["topic"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_lead",
      description:
        "Create a new lead / prospective customer in the CRM. Only call this when you have at minimum an address. Ask the user for missing critical fields (phone, email) BEFORE calling — do not invent them.",
      parameters: {
        type: "object",
        properties: {
          address: { type: "string", description: "Street address" },
          city: { type: "string" },
          state: { type: "string" },
          zip: { type: "string" },
          owner: { type: "string", description: "Owner or contact name" },
          phone: { type: "string" },
          email: { type: "string" },
          roof_type: {
            type: "string",
            description: "One of: Shingle, Tile, Metal, TPO, Modified Bitumen, Built-Up, EPDM, Unknown",
          },
          property_type: {
            type: "string",
            description: "Residential or Commercial",
          },
          year_built: { type: "string" },
          sqft: { type: "number" },
          estimated_value: { type: "number" },
          notes: {
            type: "string",
            description: "Damage notes, claim details, or other freeform context to save with the lead.",
          },
          claim_number: { type: "string" },
        },
        required: ["address"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_leads",
      description: "Search existing leads by name or address before creating duplicates.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_jobs",
      description: "Search existing jobs by name, address, or job number.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_job",
      description:
        "Create a new job. Use after a lead is created or when the user says 'create a job for X'. Requires at least a name.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Job name (usually customer + address)" },
          property_address: { type: "string" },
          primary_trade: {
            type: "string",
            description: "Roofing, Solar, Gutters, Windows, Siding, HVAC, Plumbing, Electrical, General",
          },
          job_type: { type: "string", description: "e.g. Shingle Reroof, Tile Repair, Flat Roof Recover" },
          claim_number: { type: "string" },
          insurance_carrier: { type: "string" },
          client_id: { type: "string", description: "Optional existing client UUID" },
          notes: { type: "string" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "populate_order_form",
      description:
        "Read roof measurements + estimate for a job and fill the order-form template input fields (squares, hip/ridge LF, valley LF, eaves/rakes, etc.). Never overwrites values the user has manually edited.",
      parameters: {
        type: "object",
        properties: {
          job_id: { type: "string", description: "Job UUID" },
        },
        required: ["job_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "auto_measure_property",
      description:
        "Scan the entire property with Google Solar satellite AI and save measurements for ALL structures — the main house AND any detached outbuildings (shed, garage, guest house). Creates one facet per detected roof plane with pitch and area. Call this when the user says 'measure this property', 'get roof measurements', or after creating a new job. Skips if the user has already saved a manual measurement.",
      parameters: {
        type: "object",
        properties: {
          job_id: { type: "string", description: "Job UUID" },
        },
        required: ["job_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_current_context",
      description:
        "Return what the user is currently looking at in the app (route, active job/lead if any). Call this at the start of a conversation or whenever you need situational awareness.",
      parameters: { type: "object", properties: {} },
    },
  },
];

// Explanations powering `explain_feature`. Kept static — cheap, deterministic,
// and reviewed by the team.
export const FEATURE_EXPLANATIONS: Record<string, string> = {
  leads:
    "**Leads** is your top-of-funnel CRM. Import lists, capture leads from door-to-door, and track them through statuses (new → contacted → qualified → quoted → won). Each lead can hold multiple contacts, notes, activities, and eventually convert into a Job.",
  jobs:
    "**Jobs** are active projects. Every job has tabs for Measure (roof geometry), Estimate (line-item pricing), Order Form (materials & labor for the crew/supplier), Photos, Contract, Report, and Invoices.",
  estimate:
    "**Estimate** builds the customer-facing price. Add line items from the master catalog, upload photos to auto-suggest items with AI, or apply macros for common bundles. Markup, overhead, profit are per-estimate.",
  order_form:
    "**Order Form** turns your estimate + measurements into a bill of materials and labor. Pick a roof-system template, review computed quantities, and generate Pre-Cap, Crew Work Order, and Supplier Order PDFs. Snapshots keep an approval history.",
  measurement:
    "**Measure** captures roof geometry — squares, eaves, rakes, ridges, hips, valleys, and pitch. You can draw sections on an aerial map, upload an EagleView/HOVER report, or enter manually. Measurements feed both the estimate and order form.",
  photos:
    "**Photos** stores every job image with tags (damage, before, after, drone). Photos also power AI condition analysis and line-item suggestions on the Estimate tab.",
  report:
    "**Report** builds a branded customer PDF pulling in measurements, photos, damage notes, and AI-generated cover letters/flyers/infographics.",
  invoices:
    "**Invoices** creates and tracks customer invoices with online payment via Stripe. Templates, payment reminders, and partial payments are all supported.",
  contracts:
    "**Contracts** generates and stores customer contracts for e-signature.",
  settings:
    "**Settings** manages your company brand, labor rates, materials catalog, and default markup/tax.",
  team: "**Team** invites employees, manages roles (owner/admin/member), and reviews join requests.",
  price_books:
    "**Price Books** stores per-market pricing sheets. Assign a book to a job and estimates pull from that market's rates.",
  door_to_door:
    "**Door-to-Door** is the mobile field mode: track sessions, log door knocks with dispositions, capture GPS + photos, and race gamified leaderboards.",
};

// Route hints the model can reference in navigate calls.
export const APP_ROUTES = [
  "/", "/leads", "/leads/pipeline", "/leads/list", "/leads/map",
  "/jobs", "/jobs/new", "/jobs/{id}", "/jobs/{id}/estimate",
  "/jobs/{id}/order-form", "/jobs/{id}/measure", "/jobs/{id}/photos",
  "/jobs/{id}/report", "/jobs/{id}/invoices", "/jobs/{id}/contract",
  "/invoices", "/invoices/new", "/clients", "/price-books",
  "/settings", "/team", "/door-to-door",
];
