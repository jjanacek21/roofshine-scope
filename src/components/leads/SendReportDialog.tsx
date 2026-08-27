import { useEffect, useState } from "react";
import { Mail, Send, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLeadContacts } from "@/hooks/useLeads";
import type { DeliveryMethod } from "@/lib/leads/report-delivery";

export type SendReportRecipient = {
  name: string | null;
  email: string | null;
  contactId: string | null;
  method: DeliveryMethod;
  /** Open the rep's mail client with a draft once the PDF is ready. */
  draftEmail: boolean;
  subject: string;
  body: string;
};

const METHODS: { value: DeliveryMethod; label: string }[] = [
  { value: "email", label: "Email" },
  { value: "text", label: "Text" },
  { value: "hand", label: "Hand delivered" },
  { value: "download", label: "Just downloading" },
];

/**
 * Captures who a report is going to before it is generated.
 *
 * This is what turns "I made a PDF" into a tracked send: the recipient chosen
 * here is what the Leads tab later shows as who received the report and when.
 * Contacts already on the lead are one click; anyone else can be typed in.
 */
export function SendReportDialog({
  open,
  onOpenChange,
  leadId,
  propertyAddress,
  companyName,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leadId: string | null;
  propertyAddress: string;
  companyName: string;
  busy?: boolean;
  onConfirm: (r: SendReportRecipient) => void;
}) {
  const { data: contacts = [] } = useLeadContacts(open ? leadId : null);

  const [contactId, setContactId] = useState<string>("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [method, setMethod] = useState<DeliveryMethod>("email");
  const [draftEmail, setDraftEmail] = useState(true);

  const subject = `Roof condition & savings report — ${propertyAddress}`;
  const body =
    `Hi${name ? ` ${name.split(" ")[0]}` : ""},\n\n` +
    `Attached is the roof condition and savings report we put together for ${propertyAddress}. ` +
    `It covers the current roof, what it is likely costing you as-is, and the options with the numbers behind each.\n\n` +
    `Happy to walk through it whenever suits you.\n\n` +
    `${companyName}`;

  // Picking a contact fills the fields; typing over them afterwards still wins.
  useEffect(() => {
    if (!contactId) return;
    const c = contacts.find((x) => x.id === contactId);
    if (!c) return;
    setName(c.name);
    setEmail(c.emails?.[0]?.email ?? "");
  }, [contactId, contacts]);

  useEffect(() => {
    if (!open) return;
    setContactId("");
    setName("");
    setEmail("");
    setMethod("email");
    setDraftEmail(true);
  }, [open]);

  const needsEmail = method === "email" && draftEmail;
  const canSend = !busy && (!needsEmail || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Send the report</DialogTitle>
          <DialogDescription>
            The PDF is saved to this lead's documents and logged as sent, so you can see later who
            got it and when.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {contacts.length > 0 && (
            <div>
              <label className="text-xs font-medium text-muted-foreground" htmlFor="rpt-contact">
                Contact on this property
              </label>
              <select
                id="rpt-contact"
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border px-3 text-sm"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
              >
                <option value="">Someone else…</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.title ? ` — ${c.title}` : ""}
                    {c.emails?.[0]?.email ? ` (${c.emails[0].email})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground" htmlFor="rpt-name">
                Recipient name
              </label>
              <input
                id="rpt-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Owner or property manager"
                className="mt-1 h-10 w-full rounded-md border px-3 text-sm"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground" htmlFor="rpt-email">
                Email
              </label>
              <input
                id="rpt-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="owner@example.com"
                className="mt-1 h-10 w-full rounded-md border px-3 text-sm"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground" htmlFor="rpt-method">
              How it is going out
            </label>
            <select
              id="rpt-method"
              value={method}
              onChange={(e) => setMethod(e.target.value as DeliveryMethod)}
              className="mt-1 h-10 w-full rounded-md border px-3 text-sm"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}
            >
              {METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {method === "email" && (
            <label className="flex items-start gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={draftEmail}
                onChange={(e) => setDraftEmail(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Open a draft in my mail app with the message written. The PDF downloads at the same
                time — attach it before you hit send.
              </span>
            </label>
          )}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium"
            style={{ borderColor: "var(--border)" }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSend}
            onClick={() =>
              onConfirm({
                name: name.trim() || null,
                email: email.trim() || null,
                contactId: contactId || null,
                method,
                draftEmail: method === "email" && draftEmail,
                subject,
                body,
              })
            }
            className="inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: "var(--brand)" }}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : method === "email" ? (
              <Mail className="h-4 w-4" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {busy ? "Generating…" : "Generate & log"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
