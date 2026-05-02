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

async function geocodeAddress(
  address: string,
  apiKey: string,
): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const data = (await r.json()) as {
      results?: { geometry?: { location?: { lat: number; lng: number } } }[];
    };
    const loc = data.results?.[0]?.geometry?.location;
    if (loc) return { lat: loc.lat, lng: loc.lng };
  } catch {
    // ignore
  }
  return null;
}

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

      // Verify caller is a company admin (owner/admin/super_admin)
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("role, company_id")
        .eq("id", userId)
        .maybeSingle();
      if (profileErr) {
        return { inserted: 0, errors: [`Profile lookup failed: ${profileErr.message}`] };
      }
      if (!profile?.company_id) {
        return { inserted: 0, errors: ["No company found for your account"] };
      }
      const role = profile.role;
      if (role !== "owner" && role !== "admin" && role !== "super_admin") {
        return { inserted: 0, errors: ["Forbidden: only company admins can import leads"] };
      }

      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      let inserted = 0;
      const errors: string[] = [];

      // Limit geocode calls per request to avoid timeouts (geocoding is slow)
      let geocodeBudget = 25;

      for (const row of data.leads) {
        try {
          let lat = row.lat ?? null;
          let lng = row.lng ?? null;
          if ((lat == null || lng == null) && apiKey && geocodeBudget > 0) {
            const full = [row.address, row.city, row.state, row.zip]
              .filter(Boolean)
              .join(", ");
            const geo = await geocodeAddress(full, apiKey);
            if (geo) {
              lat = geo.lat;
              lng = geo.lng;
            }
            geocodeBudget--;
          }

          const estimated =
            row.estimated_value ?? (row.sqft ? row.sqft * 4.5 : null);

          const { data: leadRow, error: leadErr } = await supabase
            .from("leads")
            .insert({
              company_id: profile.company_id,
              created_by: userId,
              address: row.address,
              city: row.city ?? null,
              state: row.state ?? "FL",
              zip: row.zip ?? null,
              owner: row.owner ?? row.reported_owner ?? null,
              sqft: row.sqft ?? null,
              year_built: row.year_built ?? null,
              lat,
              lng,
              roof_type: row.roof_type ?? "Unknown",
              property_type: row.property_type ?? "Commercial",
              estimated_value: estimated,
              sale_amount: row.sale_amount ?? null,
              reported_owner: row.reported_owner ?? null,
            })
            .select("id")
            .single();
          if (leadErr || !leadRow) throw new Error(leadErr?.message ?? "Insert failed");

          if (row.contacts && row.contacts.length > 0) {
            for (let i = 0; i < row.contacts.length; i++) {
              const c = row.contacts[i];
              const { data: contactRow, error: cErr } = await supabase
                .from("lead_contacts")
                .insert({
                  lead_id: leadRow.id,
                  name: c.name,
                  title: c.title ?? null,
                  company: c.company ?? null,
                  sort_order: i,
                })
                .select("id")
                .single();
              if (cErr || !contactRow) continue;

              if (c.phones && c.phones.length > 0) {
                await supabase.from("lead_contact_phones").insert(
                  c.phones.map((p) => ({
                    contact_id: contactRow.id,
                    phone: p,
                    phone_type: "unknown",
                  })),
                );
              }
              if (c.emails && c.emails.length > 0) {
                await supabase.from("lead_contact_emails").insert(
                  c.emails.map((e) => ({
                    contact_id: contactRow.id,
                    email: e,
                  })),
                );
              }
            }
          }

          inserted++;
        } catch (e) {
          errors.push(
            row.address +
              ": " +
              (e instanceof Error ? e.message : "unknown error"),
          );
        }
      }

      return { inserted, errors };
    } catch (e) {
      console.error("importLeads fatal:", e);
      return {
        inserted: 0,
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
        status: z.enum(["new", "contacted", "qualified", "quoted", "won", "lost"]),
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
