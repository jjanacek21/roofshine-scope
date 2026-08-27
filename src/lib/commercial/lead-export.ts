import { supabase } from "@/integrations/supabase/client";
import { leadStatusLabel, type LeadRow } from "@/lib/leads";

/**
 * Lead CSV export, shaped for a CRM import or an AI follow-up agent.
 *
 * One row per contact rather than per property: a dialer or sequencer works
 * through people, not buildings, and a property with three owners needs three
 * rows. Properties with no contact still export once so nothing is silently
 * dropped from the list.
 */

const COLUMNS = [
  "Property Address",
  "City",
  "State",
  "ZIP",
  "Owner",
  "Status",
  "Contact Name",
  "Contact Title",
  "Phone 1",
  "Phone 2",
  "Phone 3",
  "Email 1",
  "Email 2",
  "Roof Type",
  "Property Type",
  "Sq Ft",
  "Year Built",
  "Estimated Value",
  "Added",
] as const;

type ContactRow = {
  id: string;
  lead_id: string;
  name: string;
  title: string | null;
  sort_order: number;
};

/** RFC 4180 escaping. A stray quote or comma in an owner name breaks every downstream import. */
function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Excel reads a bare UTF-8 CSV as Windows-1252 and mangles accented owner
 * names. The BOM is what stops that.
 */
const BOM = "﻿";

export async function buildLeadCsv(leads: LeadRow[]): Promise<string> {
  const ids = leads.map((l) => l.id);

  const contactsByLead = new Map<string, ContactRow[]>();
  const phonesByContact = new Map<string, string[]>();
  const emailsByContact = new Map<string, string[]>();

  // Chunked so a large export doesn't blow past the URL length limit on .in()
  const CHUNK = 200;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    const { data: contacts } = await supabase
      .from("lead_contacts")
      .select("id, lead_id, name, title, sort_order")
      .in("lead_id", slice)
      .order("sort_order");

    const rows = (contacts ?? []) as ContactRow[];
    for (const c of rows) {
      const list = contactsByLead.get(c.lead_id) ?? [];
      list.push(c);
      contactsByLead.set(c.lead_id, list);
    }

    const contactIds = rows.map((c) => c.id);
    for (let j = 0; j < contactIds.length; j += CHUNK) {
      const cslice = contactIds.slice(j, j + CHUNK);
      if (cslice.length === 0) continue;
      const [{ data: phones }, { data: emails }] = await Promise.all([
        supabase.from("lead_contact_phones").select("contact_id, phone").in("contact_id", cslice),
        supabase.from("lead_contact_emails").select("contact_id, email").in("contact_id", cslice),
      ]);
      for (const p of phones ?? []) {
        const list = phonesByContact.get(p.contact_id) ?? [];
        list.push(p.phone);
        phonesByContact.set(p.contact_id, list);
      }
      for (const e of emails ?? []) {
        const list = emailsByContact.get(e.contact_id) ?? [];
        list.push(e.email);
        emailsByContact.set(e.contact_id, list);
      }
    }
  }

  const lines: string[] = [COLUMNS.join(",")];

  for (const l of leads) {
    const base = [l.address, l.city, l.state, l.zip, l.owner, leadStatusLabel(l.status)];
    const tail = [
      l.roof_type,
      l.property_type,
      l.sqft,
      l.year_built,
      l.estimated_value,
      l.created_at ? new Date(l.created_at).toISOString().slice(0, 10) : "",
    ];

    const contacts = contactsByLead.get(l.id) ?? [];

    if (contacts.length === 0) {
      lines.push([...base, "", "", "", "", "", "", "", ...tail].map(cell).join(","));
      continue;
    }

    for (const c of contacts) {
      const phones = phonesByContact.get(c.id) ?? [];
      const emails = emailsByContact.get(c.id) ?? [];
      lines.push(
        [
          ...base,
          c.name,
          c.title,
          phones[0] ?? "",
          phones[1] ?? "",
          phones[2] ?? "",
          emails[0] ?? "",
          emails[1] ?? "",
          ...tail,
        ]
          .map(cell)
          .join(","),
      );
    }
  }

  return BOM + lines.join("\r\n");
}

/** Trigger a browser download of the given CSV text. */
export function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportFilename(prefix: string): string {
  return `${prefix}-${new Date().toISOString().slice(0, 10)}.csv`;
}
