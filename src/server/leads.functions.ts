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
      let createdLeadCount = 0;
      const addressToId = new Map<string, string>();
      const preExistingLeadIds = new Set<string>();
      const createdLeadIds = new Set<string>();

      const normPhone = (s: string) => s.replace(/\D+/g, "");
      const normEmail = (s: string) => s.trim().toLowerCase();
      const normName = (s: string) => s.trim().toLowerCase();

      const LEAD_CHUNK = 200;
      for (let i = 0; i < leadRowsForInsert.length; i += LEAD_CHUNK) {
        const chunk = leadRowsForInsert.slice(i, i + LEAD_CHUNK);
        const chunkAddrs = chunk.map((r) => r.address);

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
          const k = e.address.trim().toLowerCase();
          existingByAddr.set(k, e.id);
          addressToId.set(k, e.id);
          preExistingLeadIds.add(e.id);
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
          createdLeadCount += inserted?.length ?? 0;
          for (const r of inserted ?? []) {
            addressToId.set(r.address.trim().toLowerCase(), r.id);
            createdLeadIds.add(r.id);
          }
        }
      }

      // Group incoming contacts by lead. Track which leads pre-existed so we can
      // diff contact info before deciding whether to merge or skip.
      type IncomingContact = {
        name: string;
        title: string | null;
        company: string | null;
        sort_order: number;
        phones: string[];
        emails: string[];
      };
      const incomingByLead = new Map<string, IncomingContact[]>();
      for (const row of dedupedRows) {
        const leadId = addressToId.get(row.address.trim().toLowerCase());
        if (!leadId || !row.contacts) continue;
        const list = incomingByLead.get(leadId) ?? [];
        row.contacts.forEach((c, idx) => {
          list.push({
            name: c.name,
            title: c.title ?? null,
            company: c.company ?? null,
            sort_order: idx,
            phones: (c.phones ?? []).filter((p) => normPhone(p).length > 0),
            emails: (c.emails ?? []).filter((e) => normEmail(e).length > 0),
          });
        });
        incomingByLead.set(leadId, list);
      }

      // Pre-load existing contacts (and their phones/emails) for pre-existing leads,
      // so we can decide what to merge vs. skip without ever inserting duplicates.
      const existingContactsByLead = new Map<
        string,
        { id: string; nameKey: string; phones: Set<string>; emails: Set<string> }[]
      >();

      const preIds = Array.from(preExistingLeadIds);
      const PRELOAD_CHUNK = 200;
      for (let i = 0; i < preIds.length; i += PRELOAD_CHUNK) {
        const slice = preIds.slice(i, i + PRELOAD_CHUNK);
        const { data: cs, error: cErr } = await supabase
          .from("lead_contacts")
          .select("id, lead_id, name")
          .in("lead_id", slice);
        if (cErr) {
          errors.push(`Existing contact lookup: ${cErr.message}`);
          continue;
        }
        const contactIds = (cs ?? []).map((c) => c.id);
        const phonesByContact = new Map<string, Set<string>>();
        const emailsByContact = new Map<string, Set<string>>();
        if (contactIds.length > 0) {
          const { data: ps } = await supabase
            .from("lead_contact_phones")
            .select("contact_id, phone")
            .in("contact_id", contactIds);
          for (const p of ps ?? []) {
            const set = phonesByContact.get(p.contact_id) ?? new Set<string>();
            set.add(normPhone(p.phone));
            phonesByContact.set(p.contact_id, set);
          }
          const { data: es } = await supabase
            .from("lead_contact_emails")
            .select("contact_id, email")
            .in("contact_id", contactIds);
          for (const e of es ?? []) {
            const set = emailsByContact.get(e.contact_id) ?? new Set<string>();
            set.add(normEmail(e.email));
            emailsByContact.set(e.contact_id, set);
          }
        }
        for (const c of cs ?? []) {
          const arr = existingContactsByLead.get(c.lead_id) ?? [];
          arr.push({
            id: c.id,
            nameKey: normName(c.name),
            phones: phonesByContact.get(c.id) ?? new Set<string>(),
            emails: emailsByContact.get(c.id) ?? new Set<string>(),
          });
          existingContactsByLead.set(c.lead_id, arr);
        }
      }

      // Decide per lead: created, merged, or duplicate-skip. Build insert queues.
      const newContactsToInsert: {
        lead_id: string;
        name: string;
        title: string | null;
        company: string | null;
        sort_order: number;
        // attached afterwards via returned id
        phones: string[];
        emails: string[];
      }[] = [];
      const phonesToInsertExisting: { contact_id: string; phone: string; phone_type: string }[] = [];
      const emailsToInsertExisting: { contact_id: string; email: string }[] = [];
      const mergedLeadIds = new Set<string>();

      for (const [leadId, contacts] of incomingByLead.entries()) {
        const isNewLead = !preExistingLeadIds.has(leadId);
        const existingContacts = existingContactsByLead.get(leadId) ?? [];

        for (const c of contacts) {
          const nameKey = normName(c.name);
          const match = existingContacts.find((ec) => ec.nameKey === nameKey);
          if (!match) {
            // Brand-new contact on this lead.
            newContactsToInsert.push({
              lead_id: leadId,
              name: c.name,
              title: c.title,
              company: c.company,
              sort_order: c.sort_order,
              phones: c.phones,
              emails: c.emails,
            });
            if (!isNewLead) mergedLeadIds.add(leadId);
          } else {
            // Existing contact — diff phones/emails.
            const newPhones = c.phones.filter((p) => {
              const n = normPhone(p);
              if (!n || match.phones.has(n)) return false;
              match.phones.add(n);
              return true;
            });
            const newEmails = c.emails.filter((e) => {
              const n = normEmail(e);
              if (!n || match.emails.has(n)) return false;
              match.emails.add(n);
              return true;
            });
            for (const p of newPhones) {
              phonesToInsertExisting.push({ contact_id: match.id, phone: p, phone_type: "unknown" });
            }
            for (const e of newEmails) {
              emailsToInsertExisting.push({ contact_id: match.id, email: e });
            }
            if (!isNewLead && (newPhones.length > 0 || newEmails.length > 0)) {
              mergedLeadIds.add(leadId);
            }
          }
        }
      }

      // Insert queued new contacts (in chunks), then their phones/emails.
      let contactsInserted = 0;
      let phonesInserted = 0;
      let emailsInserted = 0;

      const CONTACT_CHUNK = 300;
      for (let i = 0; i < newContactsToInsert.length; i += CONTACT_CHUNK) {
        const chunk = newContactsToInsert.slice(i, i + CONTACT_CHUNK);
        const { data: inserted, error: insCErr } = await supabase
          .from("lead_contacts")
          .insert(
            chunk.map((c) => ({
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

        const idByKey = new Map<string, string>();
        for (const r of inserted ?? []) {
          idByKey.set(`${r.lead_id}::${normName(r.name)}`, r.id);
        }

        const phoneRows: { contact_id: string; phone: string; phone_type: string }[] = [];
        const emailRows: { contact_id: string; email: string }[] = [];
        for (const c of chunk) {
          const cid = idByKey.get(`${c.lead_id}::${normName(c.name)}`);
          if (!cid) continue;
          for (const p of c.phones) phoneRows.push({ contact_id: cid, phone: p, phone_type: "unknown" });
          for (const e of c.emails) emailRows.push({ contact_id: cid, email: e });
        }

        const PCHUNK = 500;
        for (let j = 0; j < phoneRows.length; j += PCHUNK) {
          const sub = phoneRows.slice(j, j + PCHUNK);
          const { error: pErr } = await supabase.from("lead_contact_phones").insert(sub);
          if (pErr) errors.push(`Phones sub-chunk: ${pErr.message}`);
          else phonesInserted += sub.length;
        }
        for (let j = 0; j < emailRows.length; j += PCHUNK) {
          const sub = emailRows.slice(j, j + PCHUNK);
          const { error: eErr } = await supabase.from("lead_contact_emails").insert(sub);
          if (eErr) errors.push(`Emails sub-chunk: ${eErr.message}`);
          else emailsInserted += sub.length;
        }
      }

      // Insert new phones/emails attached to pre-existing contacts.
      const PCHUNK2 = 500;
      for (let j = 0; j < phonesToInsertExisting.length; j += PCHUNK2) {
        const sub = phonesToInsertExisting.slice(j, j + PCHUNK2);
        const { error: pErr } = await supabase.from("lead_contact_phones").insert(sub);
        if (pErr) errors.push(`Merged phones sub-chunk: ${pErr.message}`);
        else phonesInserted += sub.length;
      }
      for (let j = 0; j < emailsToInsertExisting.length; j += PCHUNK2) {
        const sub = emailsToInsertExisting.slice(j, j + PCHUNK2);
        const { error: eErr } = await supabase.from("lead_contact_emails").insert(sub);
        if (eErr) errors.push(`Merged emails sub-chunk: ${eErr.message}`);
        else emailsInserted += sub.length;
      }

      // Skipped = pre-existing leads that didn't get merged.
      const mergedCount = mergedLeadIds.size;
      const skippedDuplicates = preExistingLeadIds.size - mergedCount;

      return {
        // Back-compat alias so older clients still read a sensible number.
        inserted: createdLeadCount,
        created: createdLeadCount,
        merged: mergedCount,
        skippedDuplicates,
        contactsInserted,
        phonesInserted,
        emailsInserted,
        errors,
      };
    } catch (e) {
      console.error("importLeads fatal:", e);
      return {
        inserted: 0,
        created: 0,
        merged: 0,
        skippedDuplicates: 0,
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

// ---------- Follow-Up: leads that received a report ----------

export const listFollowUps = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;

    // All report_sent activities visible to this user (RLS scopes via lead).
    // Page through to bypass the default 1000-row cap.
    const PAGE = 1000;
    const sends: { id: string; lead_id: string; created_at: string; note: string | null; user_id: string | null }[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from("lead_activities")
        .select("id, lead_id, created_at, note, user_id")
        .eq("type", "report_sent")
        .order("created_at", { ascending: false })
        .range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      const rows = data ?? [];
      sends.push(...rows);
      if (rows.length < PAGE) break;
    }
    if (sends.length === 0) return { items: [] as FollowUpItem[] };

    // Latest send per lead.
    const latestByLead = new Map<string, typeof sends[number]>();
    for (const s of sends) {
      if (!latestByLead.has(s.lead_id)) latestByLead.set(s.lead_id, s);
    }
    const leadIds = Array.from(latestByLead.keys());

    const { data: leads, error: leadsErr } = await supabase
      .from("leads")
      .select("id, address, city, state, zip, owner, status, sqft, roof_type, lat, lng")
      .in("id", leadIds);
    if (leadsErr) throw new Error(leadsErr.message);

    // All activities for those leads (to compute last reply / awaiting).
    const { data: acts } = await supabase
      .from("lead_activities")
      .select("lead_id, type, created_at")
      .in("lead_id", leadIds)
      .order("created_at", { ascending: false });

    const replyTypes = new Set(["call", "email", "text", "note", "status"]);

    const items: FollowUpItem[] = (leads ?? []).map((lead) => {
      const send = latestByLead.get(lead.id)!;
      const sentAt = send.created_at;
      const note = send.note ?? "";
      let channel: "email" | "text" | "other" = "other";
      if (note.startsWith("email")) channel = "email";
      else if (note.startsWith("text") || note.startsWith("sms")) channel = "text";

      // recipient after the arrow, if present
      const arrowIdx = note.indexOf("→");
      const recipient = arrowIdx >= 0 ? note.slice(arrowIdx + 1).trim() : null;

      const after = (acts ?? []).filter(
        (a) => a.lead_id === lead.id && replyTypes.has(a.type) && a.created_at > sentAt,
      );
      const lastReplyAt = after[0]?.created_at ?? null;
      const followupCount = after.length;

      return {
        leadId: lead.id,
        address: lead.address,
        city: lead.city,
        state: lead.state,
        zip: lead.zip,
        owner: lead.owner,
        status: lead.status,
        sqft: lead.sqft,
        roof_type: lead.roof_type,
        sentAt,
        channel,
        recipient,
        lastReplyAt,
        followupCount,
      };
    });

    // newest first
    items.sort((a, b) => (a.sentAt < b.sentAt ? 1 : -1));
    return { items };
  });

export type FollowUpItem = {
  leadId: string;
  address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  owner: string | null;
  status: string;
  sqft: number | null;
  roof_type: string | null;
  sentAt: string;
  channel: "email" | "text" | "other";
  recipient: string | null;
  lastReplyAt: string | null;
  followupCount: number;
};
