import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Building2, UserPlus, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  cbAdminCreateCompany,
  cbAdminListCompanies,
  cbAdminSetMember,
  cbAdminSetSeats,
  cbAdminUpsertUser,
  type CbAdminCompanyRow,
} from "@/lib/cb-admin.functions";

type Role = "owner" | "admin" | "rep";
const ROLE_LABEL: Record<Role, string> = { owner: "Owner", admin: "Admin", rep: "Rep" };

/* ------------------------------------------------------------------ */
/* Companies & users                                                   */
/* ------------------------------------------------------------------ */

export function CbCompaniesTab() {
  const qc = useQueryClient();
  const { data: companies = [], isLoading } = useQuery({
    queryKey: ["cb-admin-companies"],
    queryFn: () => cbAdminListCompanies(),
  });

  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    ownerEmail: "",
    seats: "3",
    plan: "pro" as "free" | "pro" | "team",
    phone: "",
    email: "",
    website: "",
    address: "",
    city: "",
    state: "",
    zip: "",
  });

  const refresh = () => void qc.invalidateQueries({ queryKey: ["cb-admin-companies"] });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Give the company a name");
      return cbAdminCreateCompany({
        data: {
          name: form.name.trim(),
          seats: Math.max(1, Number(form.seats) || 3),
          plan: form.plan,
          ...(form.ownerEmail.trim() ? { ownerEmail: form.ownerEmail.trim() } : {}),
          ...(form.phone ? { phone: form.phone } : {}),
          ...(form.email ? { email: form.email } : {}),
          ...(form.website ? { website: form.website } : {}),
          ...(form.address ? { address: form.address } : {}),
          ...(form.city ? { city: form.city } : {}),
          ...(form.state ? { state: form.state } : {}),
          ...(form.zip ? { zip: form.zip } : {}),
        },
      });
    },
    onSuccess: () => {
      toast.success("Company created — the owner has been emailed.");
      setForm({ ...form, name: "", ownerEmail: "", phone: "", email: "", website: "", address: "", city: "", state: "", zip: "" });
      setCreating(false);
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't create the company"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading companies…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Claim Buddy companies</h2>
            <p className="text-sm text-muted-foreground">
              Add a company, seat its owner, set how many seats they've bought, and manage every user.
            </p>
          </div>
          <Button onClick={() => setCreating((v) => !v)}>
            <Building2 className="mr-2 h-4 w-4" />
            {creating ? "Cancel" : "New company"}
          </Button>
        </div>

        {creating ? (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Input placeholder="Company name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input placeholder="Owner email" value={form.ownerEmail} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })} />
            <Input placeholder="Seats" type="number" value={form.seats} onChange={(e) => setForm({ ...form, seats: e.target.value })} />
            <Select value={form.plan} onValueChange={(v) => setForm({ ...form, plan: v as "free" | "pro" | "team" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free</SelectItem>
                <SelectItem value="pro">Pro</SelectItem>
                <SelectItem value="team">Team</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input placeholder="Company email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input placeholder="Website" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
            <Input placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <Input placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <Input placeholder="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
            <Input placeholder="ZIP" value={form.zip} onChange={(e) => setForm({ ...form, zip: e.target.value })} />
            <Button onClick={() => create.mutate()} disabled={create.isPending}>
              {create.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create company
            </Button>
          </div>
        ) : null}
      </div>

      <div className="space-y-3">
        {companies.map((c) => (
          <CompanyCard
            key={c.workspace_id}
            company={c}
            open={openId === c.workspace_id}
            onToggle={() => setOpenId(openId === c.workspace_id ? null : c.workspace_id)}
            onChanged={refresh}
          />
        ))}
        {companies.length === 0 ? (
          <p className="text-sm text-muted-foreground">No Claim Buddy companies yet.</p>
        ) : null}
      </div>
    </div>
  );
}

function CompanyCard({
  company,
  open,
  onToggle,
  onChanged,
}: {
  company: CbAdminCompanyRow;
  open: boolean;
  onToggle: () => void;
  onChanged: () => void;
}) {
  const [seats, setSeats] = useState(String(company.seats_purchased));
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("rep");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function saveSeats() {
    setBusy(true);
    try {
      await cbAdminSetSeats({ data: { workspaceId: company.workspace_id, seats: Number(seats) || 0 } });
      toast.success("Seats updated.");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update seats");
    } finally {
      setBusy(false);
    }
  }

  async function addUser() {
    if (!email.includes("@")) {
      toast.error("Enter a valid email");
      return;
    }
    setBusy(true);
    try {
      const res = await cbAdminUpsertUser({
        data: {
          workspaceId: company.workspace_id,
          email: email.trim(),
          role,
          ...(password ? { password } : {}),
        },
      });
      toast.success(res.seated ? "User added and emailed." : "Invite emailed.");
      setEmail("");
      setPassword("");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't add the user");
    } finally {
      setBusy(false);
    }
  }

  async function setMember(userId: string, patch: { role?: Role; isActive?: boolean; remove?: boolean }) {
    setBusy(true);
    try {
      await cbAdminSetMember({ data: { workspaceId: company.workspace_id, userId, ...patch } });
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update the user");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-3 p-4 text-left">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{company.name}</p>
          <p className="text-xs text-muted-foreground">
            {company.origin} · {company.plan} · {company.seats_used}/{company.seats_purchased} seats
            {company.seats_pending ? ` · ${company.seats_pending} invited` : ""} · {company.job_count} inspections
          </p>
        </div>
        <Badge variant="secondary">{open ? "Hide" : "Manage"}</Badge>
      </button>

      {open ? (
        <div className="space-y-4 border-t border-border p-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-28">
              <label className="text-xs text-muted-foreground">Seats purchased</label>
              <Input type="number" value={seats} onChange={(e) => setSeats(e.target.value)} />
            </div>
            <Button variant="outline" onClick={() => void saveSeats()} disabled={busy}>
              <Check className="mr-2 h-4 w-4" /> Save seats
            </Button>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <Input
              className="w-64"
              placeholder="Add user email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Select value={role} onValueChange={(v) => setRole(v as Role)}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="rep">Rep</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="owner">Owner</SelectItem>
              </SelectContent>
            </Select>
            <Input
              className="w-52"
              placeholder="Temp password (optional)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button onClick={() => void addUser()} disabled={busy}>
              <UserPlus className="mr-2 h-4 w-4" /> Add user
            </Button>
          </div>

          <div className="space-y-2">
            {company.members.map((m) => (
              <div key={m.user_id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.name || m.email || "User"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {m.email} · {m.job_count} inspections
                    {m.last_active_at ? ` · active ${new Date(m.last_active_at).toLocaleDateString()}` : ""}
                  </p>
                </div>
                {!m.is_active ? <Badge variant="destructive">Deactivated</Badge> : null}
                <Select value={m.role} onValueChange={(v) => void setMember(m.user_id, { role: v as Role })}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rep">Rep</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="owner">Owner</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void setMember(m.user_id, { isActive: !m.is_active })}
                >
                  {m.is_active ? "Deactivate" : "Reactivate"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => void setMember(m.user_id, { remove: true })}>
                  Remove
                </Button>
              </div>
            ))}
            {company.members.length === 0 ? (
              <p className="text-sm text-muted-foreground">No users seated yet.</p>
            ) : null}
          </div>

          {company.invites.length ? (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Pending invites</p>
              {company.invites.map((i) => (
                <p key={i.id} className="text-sm">
                  {i.email} — {ROLE_LABEL[i.role as Role] ?? i.role}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Demo requests                                                       */
/* ------------------------------------------------------------------ */

interface DemoRow {
  id: string;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  seats: number | null;
  message: string | null;
  kind: string;
  handled_at: string | null;
  created_at: string;
}

export function CbDemoRequestsTab() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["cb-demo-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cb_demo_requests")
        .select("id, name, email, company, phone, seats, message, kind, handled_at, created_at")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as DemoRow[];
    },
  });

  async function markHandled(id: string, handled: boolean) {
    const { error } = await supabase
      .from("cb_demo_requests")
      .update({ handled_at: handled ? new Date().toISOString() : null })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    void qc.invalidateQueries({ queryKey: ["cb-demo-requests"] });
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading requests…
      </div>
    );
  }

  if (!data.length) {
    return <p className="text-sm text-muted-foreground">No demo or signup requests yet.</p>;
  }

  return (
    <div className="space-y-2">
      {data.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {r.company || r.name} <Badge variant="secondary" className="ml-2">{r.kind}</Badge>
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {r.name} · {r.email}
              {r.phone ? ` · ${r.phone}` : ""}
              {r.seats ? ` · ${r.seats} seats` : ""} · {new Date(r.created_at).toLocaleDateString()}
            </p>
            {r.message ? <p className="mt-1 text-xs">{r.message}</p> : null}
          </div>
          <Button
            variant={r.handled_at ? "ghost" : "outline"}
            size="sm"
            onClick={() => void markHandled(r.id, !r.handled_at)}
          >
            {r.handled_at ? "Handled" : "Mark handled"}
          </Button>
        </div>
      ))}
    </div>
  );
}
