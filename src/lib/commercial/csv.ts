import type { RKAccount, RKProperty, RKTicket } from "./types";

const BOM = "\uFEFF";

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "string" ? value : typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowsToCsv(headers: string[], rows: (string | number | null | undefined | object)[][]): string {
  const lines = [headers.join(",")];
  for (const r of rows) lines.push(r.map(csvEscape).join(","));
  return BOM + lines.join("\r\n");
}

export function download(filename: string, content: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 0);
}

const acctId = (id: string) => `ACCT-${id}`;
const propId = (id: string) => `PROP-${id}`;
const tktId = (id: string) => `TKT-${id}`;

export function contactsCsv(
  accounts: RKAccount[],
  properties: RKProperty[],
  tickets: RKTicket[],
): string {
  const buildingsByAccount = new Map<string, number>();
  for (const p of properties) buildingsByAccount.set(p.account_id, (buildingsByAccount.get(p.account_id) ?? 0) + 1);
  const ticketsByAccount = new Map<string, number>();
  for (const t of tickets) ticketsByAccount.set(t.account_id, (ticketsByAccount.get(t.account_id) ?? 0) + 1);

  return rowsToCsv(
    ["contact_id", "account_name", "primary_contact", "phone", "email", "city", "building_count", "ticket_count"],
    accounts.map((a) => [
      acctId(a.id),
      a.name,
      a.primary_contact,
      a.phone,
      a.email,
      a.city,
      buildingsByAccount.get(a.id) ?? 0,
      ticketsByAccount.get(a.id) ?? 0,
    ]),
  );
}

export function propertiesCsv(
  accounts: RKAccount[],
  properties: RKProperty[],
  tickets: RKTicket[],
): string {
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const ticketsByProp = new Map<string, number>();
  for (const t of tickets) ticketsByProp.set(t.property_id, (ticketsByProp.get(t.property_id) ?? 0) + 1);

  return rowsToCsv(
    [
      "property_id",
      "contact_id",
      "account_name",
      "property_name",
      "address",
      "city",
      "state",
      "zip",
      "roof_type",
      "ticket_count",
    ],
    properties.map((p) => [
      propId(p.id),
      acctId(p.account_id),
      accountById.get(p.account_id)?.name ?? "",
      p.name,
      p.address,
      p.city,
      p.state,
      p.zip,
      p.roof_type,
      ticketsByProp.get(p.id) ?? 0,
    ]),
  );
}

export function ticketsCsv(
  accounts: RKAccount[],
  properties: RKProperty[],
  tickets: RKTicket[],
): string {
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const propById = new Map(properties.map((p) => [p.id, p]));

  return rowsToCsv(
    [
      "ticket_id",
      "work_order",
      "property_id",
      "contact_id",
      "account_name",
      "property_name",
      "contact",
      "phone",
      "address",
      "city",
      "state",
      "zip",
      "roof_type",
      "service_date",
      "status",
      "purpose",
      "reported_concern",
      "field_notes_raw",
      "report_polished",
      "materials",
      "labor",
      "price",
      "last_updated",
    ],
    tickets.map((t) => {
      const p = propById.get(t.property_id);
      const a = accountById.get(t.account_id);
      return [
        tktId(t.id),
        t.wo_number ?? "",
        propId(t.property_id),
        acctId(t.account_id),
        a?.name ?? "",
        p?.name ?? "",
        t.contact,
        t.phone,
        p?.address ?? "",
        p?.city ?? "",
        p?.state ?? "",
        p?.zip ?? "",
        t.roof_type,
        t.service_date,
        t.status,
        (t.purpose ?? []).join("|"),
        t.reported_concern,
        t.field_notes_raw,
        t.report_polished,
        JSON.stringify(t.materials ?? []),
        JSON.stringify(t.labor ?? []),
        t.price ?? "",
        t.updated_at,
      ];
    }),
  );
}

export function fullJsonBackup(
  accounts: RKAccount[],
  properties: RKProperty[],
  tickets: RKTicket[],
): string {
  return JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      accounts,
      properties,
      tickets,
    },
    null,
    2,
  );
}
