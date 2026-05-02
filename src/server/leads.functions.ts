import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ContactInput = z.object({
  name: z.string().min(1).max(200),
  title: z.string().max(200).optional().nullable(),
  company: z.string().max(200).optional().nullable(),
  phones: z.array(z.string().min(3).max(40)).max(20).optional(),
  emails: z.array(z.string().min(3).max(200)).max(20).optional(),
});

const LeadInput = z.object({
  address: z.string().min(1).max(500),
  city: z.string().max(120).optional().nullable(),
  state: z.string().max(40).optional().nullable(),
  zip: z.string().max(20).optional().nullable(),
  owner: z.string().max(200).optional().nullable(),
  sqft: z.number().int().min(0).max(100_000_000).optional().nullable(),
  year_built: z.string().max(20).optional().nullable(),
  lat: z.number().min(-90).max(90).optional().nullable(),
  lng: z.number().min(-180).max(180).optional().nullable(),
  roof_type: z.string().max(80).optional().nullable(),
  property_type: z.string().max(80).optional().nullable(),
  estimated_value: z.number().min(0).max(1_000_000_000).optional().nullable(),
  sale_amount: z.string().max(80).optional().nullable(),
  reported_owner: z.string().max(200).optional().nullable(),
  contacts: z.array(ContactInput).max(20).optional(),
});

const ImportSchema = z.object({
  leads: z.array(LeadInput).min(1).max(2000),
});

export const importLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => {
    const r = ImportSchema.safeParse(data);
    if (!r.success) {
      const msg = r.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ");
      throw new Error(`Invalid import data: ${msg}`);
    }
    return r.data;
  })
  .handler(async ({ data, context }) => {
    try {
      const { supabase, userId } = context;

      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("role, company_id")
        .eq("id", userId)
        .maybeSingle();
      if (profileErr) {
        return { inserted: 0, contactsInserted: 0, phonesInserted: 0, emailsInserted: 0, errors: [`Profile lookup failed: ${profileErr.message}`] };
      }
      if (!profile?.company_id) {
        return { inserted: 0, contactsInserted: 0, phonesInserted: 0, emailsInserted: 0, errors: ["No company found for your account"] };
      }
      const role = profile.role;
      if (role !== "owner" && role !== "admin" && role !== "super_admin") {
        return { inserted: 0, contactsInserted: 0, phonesInserted: 0, emailsInserted: 0, errors: ["Forbidden: only company admins can import leads"] };
      }

      const errors: string[] = [];

      // Build lead rows for bulk upsert. Dedupe within the batch by normalized address.
      const seen = new Map<string, (typeof data.leads)[number]>();
      for (const row of data.leads) {
        const key = row.address.trim().toLowerCase();
        if (!key) continue;
        // Last one wins within the batch
        seen.set(key, row);
      }
      const dedupedRows = Array.from(seen.values());

      const leadRowsForInsert = dedupedRows.map((row) => ({
        company_id: profile.company_id as string,
        created_by: userId,
        address: row.address.trim(),
        city: row.city ?? null,
        state: row.state ?? "FL",
        zip: row.zip ?? null,
        owner: row.owner ?? row.reported_owner ?? null,
        sqft: row.sqft ?? null,
        year_built: row.year_built ?? null,
        lat: row.lat ?? null,
        lng: row.lng ?? null,
        roof_type: row.roof_type ?? "Unknown",
        property_type: row.property_type ?? "Commercial",
        estimated_value: row.estimated_value ?? (row.sqft ? row.sqft * 4.5 : null),
        sale_amount: row.sale_amount ?? null,
        reported_owner: row.reported_owner ?? null,
      }));

      // Upsert leads in chunks. Use the expression-based unique index by listing the
      // columns we care about; Supabase's onConflict supports column names but not
      // expressions, so we rely on a separate `ON CONFLICT DO NOTHING`-equivalent path
      // by trying upsert with onConflict on a custom name. Since our unique index is
      // expression-based (lower(btrim(address))), we instead use ignoreDuplicates via
      // .upsert with onConflict being unsupported here — fall back to:
      //   1) select existing addresses for this company in the chunk
      //   2) insert only the missing ones
      let insertedLeadCount = 0;
      const addressToId = new Map<string, string>();

      const LEAD_CHUNK = 200;
      for (let i = 0; i < leadRowsForInsert.length; i += LEAD_CHUNK) {
        const chunk = leadRowsForInsert.slice(i, i + LEAD_CHUNK);
        const chunkAddrs = chunk.map((r) => r.address);

        // Fetch existing leads for this company by raw address (case-insensitive match
        // is not directly available in REST; addresses were trimmed, so equality works
        // for our just-trimmed values). We map them out of the insert set.
        const { data: existing, error: exErr } = await supabase
          .from("leads")
          .select("id, address")
          .eq("company_id", profile.company_id)
          .in("address", chunkAddrs);
        if (exErr) {
          errors.push(`Lookup chunk ${Math.floor(i / LEAD_CHUNK) + 1}: ${exErr.message}`);
          continue;
        }
        const existingByAddr = new Map<string, string>();
        for (const e of existing ?? []) {
          existingByAddr.set(e.address.trim().toLowerCase(), e.id);
          addressToId.set(e.address.trim().toLowerCase(), e.id);
        }

        const toInsert = chunk.filter(
          (r) => !existingByAddr.has(r.address.trim().toLowerCase()),
        );

        if (toInsert.length > 0) {
          const { data: inserted, error: insErr } = await supabase
            .from("leads")
            .insert(toInsert)
            .select("id, address");
          if (insErr) {
            errors.push(`Insert chunk ${Math.floor(i / LEAD_CHUNK) + 1}: ${insErr.message}`);
            continue;
          }
          insertedLeadCount += inserted?.length ?? 0;
          for (const r of inserted ?? []) {
            addressToId.set(r.address.trim().toLowerCase(), r.id);
          }
        }
      }

      // Build contacts for all leads we know about (newly inserted OR pre-existing).
      type PendingContact = {
        lead_id: string;
        name: string;
        title: string | null;
        company: string | null;
        sort_order: number;
        phones: string[];
        emails: string[];
      };
      const pendingContacts: PendingContact[] = [];
      for (const row of dedupedRows) {
        const leadId = addressToId.get(row.address.trim().toLowerCase());
        if (!leadId || !row.contacts) continue;
        row.contacts.forEach((c, idx) => {
          pendingContacts.push({
            lead_id: leadId,
            name: c.name,
            title: c.title ?? null,
            company: c.company ?? null,
            sort_order: idx,
            phones: c.phones ?? [],
            emails: c.emails ?? [],
          });
        });
      }

      // Skip contacts that already exist (by lead_id + name) so retries don't duplicate.
      let contactsInserted = 0;
      let phonesInserted = 0;
      let emailsInserted = 0;

      const CONTACT_CHUNK = 300;
      for (let i = 0; i < pendingContacts.length; i += CONTACT_CHUNK) {
        const chunk = pendingContacts.slice(i, i + CONTACT_CHUNK);
        const leadIds = Array.from(new Set(chunk.map((c) => c.lead_id)));
        const { data: existingC, error: exCErr } = await supabase
          .from("lead_contacts")
          .select("id, lead_id, name")
          .in("lead_id", leadIds);
        if (exCErr) {
          errors.push(`Contact lookup chunk ${Math.floor(i / CONTACT_CHUNK) + 1}: ${exCErr.message}`);
          continue;
        }
        const existingKey = new Set(
          (existingC ?? []).map((c) => `${c.lead_id}::${c.name.toLowerCase()}`),
        );

        const toInsert = chunk.filter(
          (c) => !existingKey.has(`${c.lead_id}::${c.name.toLowerCase()}`),
        );
        if (toInsert.length === 0) continue;

        const { data: inserted, error: insCErr } = await supabase
          .from("lead_contacts")
          .insert(
            toInsert.map((c) => ({
              lead_id: c.lead_id,
              name: c.name,
              title: c.title,
              company: c.company,
              sort_order: c.sort_order,
            })),
          )
          .select("id, lead_id, name");
        if (insCErr) {
          errors.push(`Contact insert chunk ${Math.floor(i / CONTACT_CHUNK) + 1}: ${insCErr.message}`);
          continue;
        }
        contactsInserted += inserted?.length ?? 0;

        // Map back so we can attach phones/emails.
        const idByKey = new Map<string, string>();
        for (const r of inserted ?? []) {
          idByKey.set(`${r.lead_id}::${r.name.toLowerCase()}`, r.id);
        }

        const phoneRows: { contact_id: string; phone: string; phone_type: string }[] = [];
        const emailRows: { contact_id: string; email: string }[] = [];
        for (const c of toInsert) {
          const cid = idByKey.get(`${c.lead_id}::${c.name.toLowerCase()}`);
          if (!cid) continue;
          for (const p of c.phones) phoneRows.push({ contact_id: cid, phone: p, phone_type: "unknown" });
          for (const e of c.emails) emailRows.push({ contact_id: cid, email: e });
        }

        if (phoneRows.length > 0) {
          // Insert in sub-chunks to stay within payload limits.
          const PCHUNK = 500;
          for (let j = 0; j < phoneRows.length; j += PCHUNK) {
            const sub = phoneRows.slice(j, j + PCHUNK);
            const { error: pErr } = await supabase.from("lead_contact_phones").insert(sub);
            if (pErr) errors.push(`Phones sub-chunk: ${pErr.message}`);
            else phonesInserted += sub.length;
          }
        }
        if (emailRows.length > 0) {
          const ECHUNK = 500;
          for (let j = 0; j < emailRows.length; j += ECHUNK) {
            const sub = emailRows.slice(j, j + ECHUNK);
            const { error: eErr } = await supabase.from("lead_contact_emails").insert(sub);
            if (eErr) errors.push(`Emails sub-chunk: ${eErr.message}`);
            else emailsInserted += sub.length;
          }
        }
      }

      return {
        inserted: insertedLeadCount,
        contactsInserted,
        phonesInserted,
        emailsInserted,
        errors,
      };
    } catch (e) {
      console.error("importLeads fatal:", e);
      return {
        inserted: 0,
        contactsInserted: 0,
        phonesInserted: 0,
        emailsInserted: 0,
        errors: [e instanceof Error ? e.message : "Unexpected server error"],
      };
    }
  });

export const updateLeadStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        leadId: z.string().uuid(),
        status: z.enum(["new", "contacted", "qualified", "quoted", "report_sent", "won", "lost", "dnc"]),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("leads")
      .update({ status: data.status })
      .eq("id", data.leadId);
    if (error) throw new Error(error.message);
    await supabase.from("lead_activities").insert({
      lead_id: data.leadId,
      user_id: userId,
      type: "status",
      note: `Status changed to ${data.status}`,
    });
    return { ok: true };
  });

// ---------- Geocoding ----------

async function mapboxGeocode(query: string, token: string): Promise<{ lat: number; lng: number } | null> {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?limit=1&access_token=${token}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = (await res.json()) as { features?: { center?: [number, number] }[] };
  const center = json.features?.[0]?.center;
  if (!center) return null;
  return { lng: center[0], lat: center[1] };
}

export const geocodeLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ leadId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const token = process.env.MAPBOX_API_TOKEN;
    if (!token) return { lat: null, lng: null, error: "Mapbox token not configured" };

    const { data: lead, error: lerr } = await supabase
      .from("leads")
      .select("id, address, city, state, zip, lat, lng")
      .eq("id", data.leadId)
      .maybeSingle();
    if (lerr || !lead) return { lat: null, lng: null, error: "Lead not found" };
    if (lead.lat != null && lead.lng != null) return { lat: lead.lat, lng: lead.lng };

    const query = [lead.address, lead.city, lead.state, lead.zip].filter(Boolean).join(", ");
    const result = await mapboxGeocode(query, token);
    if (!result) return { lat: null, lng: null, error: "Address could not be located" };

    await supabase.from("leads").update({ lat: result.lat, lng: result.lng }).eq("id", data.leadId);
    await supabase.from("lead_activities").insert({
      lead_id: data.leadId,
      user_id: userId,
      type: "geocoded",
      note: `Geocoded address`,
    });
    return { lat: result.lat, lng: result.lng };
  });

export const backfillGeocodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const token = process.env.MAPBOX_API_TOKEN;
    if (!token) return { processed: 0, succeeded: 0, error: "Mapbox token not configured" };

    const { data: leads } = await supabase
      .from("leads")
      .select("id, address, city, state, zip")
      .is("lat", null)
      .limit(50);

    let succeeded = 0;
    for (const l of leads ?? []) {
      const q = [l.address, l.city, l.state, l.zip].filter(Boolean).join(", ");
      const r = await mapboxGeocode(q, token);
      if (!r) continue;
      await supabase.from("leads").update({ lat: r.lat, lng: r.lng }).eq("id", l.id);
      await supabase.from("lead_activities").insert({
        lead_id: l.id,
        user_id: userId,
        type: "geocoded",
        note: "Geocoded address (backfill)",
      });
      succeeded++;
    }
    return { processed: leads?.length ?? 0, succeeded };
  });

export const bulkDeleteLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ ids: z.array(z.string().uuid()).min(1).max(2000) }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify admin role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId!)
      .maybeSingle();
    const role = profile?.role;
    if (role !== "owner" && role !== "admin" && role !== "super_admin") {
      throw new Error("Only company owners and admins can delete leads");
    }

    // Log activity before delete
    await supabase.from("lead_activities").insert(
      data.ids.map((id) => ({
        lead_id: id,
        user_id: userId,
        type: "lead_deleted" as const,
        note: "Lead deleted",
      })),
    );

    const { error } = await supabase.from("leads").delete().in("id", data.ids);
    if (error) throw new Error(error.message);
    return { deleted: data.ids.length };
  });
