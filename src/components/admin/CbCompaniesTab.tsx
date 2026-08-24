import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Building2, UserPlus, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import {
  CB_FEATURES,
  CB_FEATURE_LABEL,
  CB_TIERS,
  CB_TIER_LABEL,
  cbResolveFeatures,
  cbTierDefaults,
  type CbFeature,
  type CbTier,
} from "@/lib/cbFeatures";
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
  cbAdminSetPlan,
  cbAdminDeleteCompany,
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

  const tier = (company.tier as CbTier) ?? "basic";
  const effective = cbResolveFeatures({
    tier,
    is_comp: company.is_comp,
    features: company.features,
  });
  const defaults = cbTierDefaults(tier);

  async function setPlan(patch: {
    tier?: CbTier;
    status?: "active" | "suspended" | "archived";
    isComp?: boolean;
    features?: Partial<Record<CbFeature, boolean | null>>;
  }) {
    setBusy(true);
    try {
      await cbAdminSetPlan({ data: { workspaceId: company.workspace_id, ...patch } });
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't update the plan");
    } finally {
      setBusy(false);
    }
  }

  async function removeCompany(purge: boolean) {
    const msg = purge
      ? `Permanently delete ${company.name} and all of its members? This cannot be undone.`
      : `Archive ${company.name}? Members lose access until you restore it.`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    try {
      await cbAdminDeleteCompany({ data: { workspaceId: company.workspace_id, purge } });
      toast.success(purge ? "Company deleted." : "Company archived.");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't remove the company");
    } finally {
      setBusy(false);
    }
  }

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
            {company.origin} · {CB_TIER_LABEL[(company.tier as CbTier) ?? "basic"]}
            {company.is_comp ? " (comp)" : ""} · {company.status} ·{" "}
            {company.seats_used}/{company.seats_purchased} seats
            {company.seats_pending ? ` · ${company.seats_pending} invited` : ""} · {company.job_count} inspections
          </p>
        </div>
        <Badge variant="secondary">{open ? "Hide" : "Manage"}</Badge>
      </button>

      {open ? (
        <div className="space-y-4 border-t border-border p-4">
          {/* Plan, status and per-feature access */}
          <div className="rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="w-40">
                <label className="text-xs text-muted-foreground">Plan tier</label>
                <Select value={tier} onValueChange={(v) => void setPlan({ tier: v as CbTier })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CB_TIERS.map((t) => (
                      <SelectItem key={t} value={t}>{CB_TIER_LABEL[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-40">
                <label className="text-xs text-muted-foreground">Account status</label>
                <Select
                  value={company.status ?? "active"}
                  onValueChange={(v) =>
                    void setPlan({ status: v as "active" | "suspended" | "archived" })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 pb-2 text-sm">
                <Switch
                  checked={!!company.is_comp}
                  onCheckedChange={(v) => void setPlan({ isComp: v })}
                  disabled={busy}
                />
                Free / comp access
              </label>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {CB_FEATURES.map((f) => (
                <label key={f} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                  <span>
                    {CB_FEATURE_LABEL[f]}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {company.is_comp
                        ? "comp"
                        : company.features?.[f] === undefined
                          ? `${CB_TIER_LABEL[tier]} default`
                          : "override"}
                    </span>
                  </span>
                  <Switch
                    checked={effective[f]}
                    disabled={busy || !!company.is_comp}
                    onCheckedChange={(v) =>
                      void setPlan({ features: { [f]: v === defaults[f] ? null : v } })
                    }
                  />
                </label>
              ))}
            </div>
          </div>

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
  industry: string | null;
  team_size: string | null;
  current_tools: string | null;
  primary_goal: string | null;
  features_wanted: string[] | null;
  questions: string | null;
  preferred_time: string | null;
  status: string | null;
  notes: string | null;
}

const DEMO_STATUSES = ["new", "contacted", "scheduled", "won", "lost"] as const;

export function useCbUnhandledDemoCount() {
  return useQuery({
    queryKey: ["cb-demo-unhandled"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("cb_demo_requests")
        .select("id", { count: "exact", head: true })
        .is("handled_at", null);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

export function CbDemoRequestsTab() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<string>("");

  const { data = [], isLoading } = useQuery({
    queryKey: ["cb-demo-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cb_demo_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as unknown as DemoRow[];
    },
  });

  function refresh() {
    void qc.invalidateQueries({ queryKey: ["cb-demo-requests"] });
    void qc.invalidateQueries({ queryKey: ["cb-demo-unhandled"] });
  }

  async function patch(id: string, values: Record<string, unknown>) {
    const { error } = await supabase.from("cb_demo_requests").update(values as never).eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    refresh();
  }

  const counts = DEMO_STATUSES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = data.filter((r) => (r.status ?? "new") === s).length;
    return acc;
  }, {});

  const rows = filter === "all" ? data : data.filter((r) => (r.status ?? "new") === filter);
  const open = data.find((r) => r.id === openId) ?? null;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading requests…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={filter === "all" ? "default" : "outline"}
          onClick={() => setFilter("all")}
        >
          All <span className="ml-1 opacity-70">{data.length}</span>
        </Button>
        {DEMO_STATUSES.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={filter === s ? "default" : "outline"}
            className="capitalize"
            onClick={() => setFilter(s)}
          >
            {s} <span className="ml-1 opacity-70">{counts[s] ?? 0}</span>
          </Button>
        ))}
      </div>

      {!rows.length ? (
        <p className="text-sm text-muted-foreground">No requests in this view.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="p-2 text-left">Created</th>
                <th className="p-2 text-left">Name</th>
                <th className="p-2 text-left">Company</th>
                <th className="p-2 text-left">Industry</th>
                <th className="p-2 text-left">Team size</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Q</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className={`cursor-pointer border-t border-border hover:bg-muted/40 ${openId === r.id ? "bg-muted/60" : ""}`}
                  onClick={() => {
                    setOpenId(r.id === openId ? null : r.id);
                    setNoteDraft(r.notes ?? "");
                  }}
                >
                  <td className="p-2 whitespace-nowrap">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="p-2">{r.name}</td>
                  <td className="p-2">{r.company ?? "—"}</td>
                  <td className="p-2">{r.industry ?? "—"}</td>
                  <td className="p-2">{r.team_size ?? "—"}</td>
                  <td className="p-2">
                    <Badge variant={r.handled_at ? "secondary" : "default"} className="capitalize">
                      {r.status ?? "new"}
                    </Badge>
                  </td>
                  <td className="p-2">
                    {r.questions ? <span className="inline-block h-2 w-2 rounded-full bg-primary" /> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open ? (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-base font-semibold">{open.company || open.name}</p>
              <p className="text-xs text-muted-foreground">
                {open.name} · {open.email}
                {open.phone ? ` · ${open.phone}` : ""} · {new Date(open.created_at).toLocaleString()}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setOpenId(null)}>Close</Button>
          </div>

          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div><span className="text-muted-foreground">Industry:</span> {open.industry ?? "—"}</div>
            <div><span className="text-muted-foreground">Team size:</span> {open.team_size ?? "—"}</div>
            <div><span className="text-muted-foreground">Current tools:</span> {open.current_tools ?? "—"}</div>
            <div><span className="text-muted-foreground">Preferred time:</span> {open.preferred_time ?? "—"}</div>
          </div>

          <div>
            <p className="text-xs uppercase text-muted-foreground">Primary goal</p>
            <p className="whitespace-pre-wrap text-sm">{open.primary_goal ?? "—"}</p>
          </div>

          <div>
            <p className="text-xs uppercase text-muted-foreground">Features wanted</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {(open.features_wanted ?? []).length
                ? (open.features_wanted ?? []).map((f) => (
                    <Badge key={f} variant="secondary">{f}</Badge>
                  ))
                : <span className="text-sm">—</span>}
            </div>
          </div>

          <div>
            <p className="text-xs uppercase text-muted-foreground">Their questions</p>
            <p className="whitespace-pre-wrap text-sm">{open.questions ?? "—"}</p>
          </div>

          {open.message ? (
            <div>
              <p className="text-xs uppercase text-muted-foreground">Message</p>
              <p className="whitespace-pre-wrap text-sm">{open.message}</p>
            </div>
          ) : null}

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <p className="mb-1 text-xs uppercase text-muted-foreground">Status</p>
              <Select
                value={open.status ?? "new"}
                onValueChange={(v) => void patch(open.id, { status: v })}
              >
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEMO_STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant={open.handled_at ? "ghost" : "default"}
              onClick={() =>
                void patch(open.id, { handled_at: open.handled_at ? null : new Date().toISOString() })
              }
            >
              <Check className="mr-1 h-4 w-4" />
              {open.handled_at ? "Handled — undo" : "Mark handled"}
            </Button>
          </div>

          <div>
            <p className="mb-1 text-xs uppercase text-muted-foreground">Internal notes</p>
            <textarea
              className="min-h-[90px] w-full rounded-lg border border-border bg-background p-2 text-sm"
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              onBlur={() => {
                if (noteDraft !== (open.notes ?? "")) void patch(open.id, { notes: noteDraft || null });
              }}
              placeholder="Only super admins see this."
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
