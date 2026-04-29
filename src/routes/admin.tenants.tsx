import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, Link2, FileSignature } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lookupUserByEmail } from "@/server/tenant-admin.functions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/tenants")({
  component: AdminTenantsPage,
});

type Tenant = {
  id: string;
  slug: string;
  company_name: string;
  company_address: string | null;
  company_phone: string | null;
  company_email: string | null;
  company_web: string | null;
  legal_addendum_url: string | null;
  accent_color: string;
  accent_color_dark: string;
  jurisdiction_state: string;
  is_active: boolean;
  sign_base_url: string | null;
};

type TenantUser = {
  id: string;
  tenant_id: string;
  user_id: string;
  rep_slug: string;
  rep_name: string;
  rep_title: string | null;
  rep_phone: string | null;
  rep_email: string | null;
  is_active: boolean;
};

type ProfileLite = {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
};

function AdminTenantsPage() {
  const qc = useQueryClient();
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [editTenant, setEditTenant] = useState<Tenant | "new" | null>(null);
  const [editRep, setEditRep] = useState<TenantUser | "new" | null>(null);

  const { data: tenants = [], isLoading } = useQuery({
    queryKey: ["admin-tenants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("*")
        .order("company_name");
      if (error) throw error;
      return (data ?? []) as Tenant[];
    },
  });

  useEffect(() => {
    if (!selectedTenantId && tenants.length > 0) setSelectedTenantId(tenants[0].id);
  }, [tenants, selectedTenantId]);

  const selectedTenant = tenants.find((t) => t.id === selectedTenantId) ?? null;

  const { data: reps = [] } = useQuery({
    queryKey: ["admin-tenant-reps", selectedTenantId],
    enabled: !!selectedTenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_users")
        .select("*")
        .eq("tenant_id", selectedTenantId!)
        .order("rep_name");
      if (error) throw error;
      return (data ?? []) as TenantUser[];
    },
  });

  // Resolve rep user emails for display
  const repUserIds = reps.map((r) => r.user_id);
  const { data: repProfiles = [] } = useQuery({
    queryKey: ["admin-tenant-rep-profiles", repUserIds.sort().join(",")],
    enabled: repUserIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name")
        .in("id", repUserIds);
      if (error) throw error;
      return (data ?? []) as ProfileLite[];
    },
  });
  const profileById = useMemo(() => {
    const m = new Map<string, ProfileLite>();
    repProfiles.forEach((p) => m.set(p.id, p));
    return m;
  }, [repProfiles]);

  const deleteRep = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tenant_users").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rep removed");
      qc.invalidateQueries({ queryKey: ["admin-tenant-reps", selectedTenantId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleRepActive = useMutation({
    mutationFn: async (rep: TenantUser) => {
      const { error } = await supabase
        .from("tenant_users")
        .update({ is_active: !rep.is_active })
        .eq("id", rep.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-tenant-reps", selectedTenantId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <FileSignature className="h-5 w-5" /> Contracting Tenants
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage white-label contracting tenants and which user accounts can sign contracts as a rep.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditTenant("new")}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-[13px] font-semibold text-primary-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> New tenant
        </button>
      </div>

      {/* Tenants list */}
      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Tenants
        </div>
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : tenants.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No tenants yet.</div>
        ) : (
          <ul className="divide-y divide-border">
            {tenants.map((t) => {
              const selected = t.id === selectedTenantId;
              return (
                <li
                  key={t.id}
                  className={`flex items-center justify-between gap-3 px-4 py-3 transition ${
                    selected ? "bg-accent" : "hover:bg-accent/40"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedTenantId(t.id)}
                    className="flex flex-1 items-center gap-3 text-left"
                  >
                    <span
                      className="h-6 w-6 rounded-md border border-border"
                      style={{
                        background: `linear-gradient(135deg, ${t.accent_color}, ${t.accent_color_dark})`,
                      }}
                    />
                    <div>
                      <div className="text-sm font-semibold text-foreground">
                        {t.company_name}{" "}
                        <span className="ml-1 text-xs text-muted-foreground">/{t.slug}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t.jurisdiction_state} ·{" "}
                        {t.is_active ? "Active" : <span className="text-red-500">Disabled</span>}
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditTenant(t)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2 text-[12px] hover:bg-card"
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Reps for selected tenant */}
      {selectedTenant && (
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Reps for {selectedTenant.company_name}
              </div>
              <div className="text-xs text-muted-foreground">
                Each rep must be linked to a real user account by email so signing works.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEditRep("new")}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-[13px] font-semibold text-primary-foreground"
            >
              <Plus className="h-3.5 w-3.5" /> Add rep
            </button>
          </div>

          {reps.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">
              No reps yet. Click "Add rep" to link a user.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {reps.map((r) => {
                const p = profileById.get(r.user_id);
                return (
                  <li key={r.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold text-foreground">
                        {r.rep_name}{" "}
                        <span className="text-xs text-muted-foreground">/{r.rep_slug}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {r.rep_title ?? "—"} · linked to:{" "}
                        <span className="text-foreground">{p?.email ?? r.user_id}</span> ·{" "}
                        {r.is_active ? "Active" : <span className="text-red-500">Disabled</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => setEditRep(r)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2 text-[12px] hover:bg-accent"
                      >
                        <Link2 className="h-3 w-3" /> Edit / re-link
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleRepActive.mutate(r)}
                        className="inline-flex h-8 items-center rounded-md border border-border px-2 text-[12px] hover:bg-accent"
                      >
                        {r.is_active ? "Disable" : "Enable"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Remove ${r.rep_name}?`)) deleteRep.mutate(r.id);
                        }}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2 text-[12px] text-red-500 hover:bg-accent"
                      >
                        <Trash2 className="h-3 w-3" /> Delete
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {editTenant && (
        <TenantDialog
          tenant={editTenant === "new" ? null : editTenant}
          onClose={() => setEditTenant(null)}
          onSaved={(id) => {
            qc.invalidateQueries({ queryKey: ["admin-tenants"] });
            if (id) setSelectedTenantId(id);
            setEditTenant(null);
          }}
        />
      )}

      {editRep && selectedTenant && (
        <RepDialog
          tenant={selectedTenant}
          rep={editRep === "new" ? null : editRep}
          onClose={() => setEditRep(null)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["admin-tenant-reps", selectedTenant.id] });
            setEditRep(null);
          }}
        />
      )}
    </div>
  );
}

/* ---------- Tenant edit dialog ---------- */

function TenantDialog({
  tenant,
  onClose,
  onSaved,
}: {
  tenant: Tenant | null;
  onClose: () => void;
  onSaved: (id?: string) => void;
}) {
  const isNew = !tenant;
  const [form, setForm] = useState({
    slug: tenant?.slug ?? "",
    company_name: tenant?.company_name ?? "",
    company_address: tenant?.company_address ?? "",
    company_phone: tenant?.company_phone ?? "",
    company_email: tenant?.company_email ?? "",
    company_web: tenant?.company_web ?? "",
    legal_addendum_url: tenant?.legal_addendum_url ?? "",
    accent_color: tenant?.accent_color ?? "#C9A227",
    accent_color_dark: tenant?.accent_color_dark ?? "#8E6F18",
    jurisdiction_state: tenant?.jurisdiction_state ?? "FL",
    is_active: tenant?.is_active ?? true,
    sign_base_url: tenant?.sign_base_url ?? "",
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.slug || !form.company_name) {
      toast.error("Slug and company name are required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        sign_base_url: form.sign_base_url.trim() || null,
      };
      if (isNew) {
        const { data, error } = await supabase
          .from("tenants")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        toast.success("Tenant created");
        onSaved(data.id);
      } else {
        const { error } = await supabase.from("tenants").update(payload).eq("id", tenant!.id);
        if (error) throw error;
        toast.success("Tenant saved");
        onSaved(tenant!.id);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isNew ? "New tenant" : `Edit ${tenant?.company_name}`}</DialogTitle>
          <DialogDescription>White-label branding and metadata for the contract signer.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Slug *" value={form.slug} onChange={(v) => setForm({ ...form, slug: v })} />
          <Field
            label="Company name *"
            value={form.company_name}
            onChange={(v) => setForm({ ...form, company_name: v })}
          />
          <Field
            label="State (e.g. FL)"
            value={form.jurisdiction_state}
            onChange={(v) => setForm({ ...form, jurisdiction_state: v })}
          />
          <Field
            label="Active"
            value={form.is_active ? "true" : "false"}
            onChange={(v) => setForm({ ...form, is_active: v === "true" })}
          />
          <Field
            label="Address"
            value={form.company_address}
            onChange={(v) => setForm({ ...form, company_address: v })}
          />
          <Field
            label="Phone"
            value={form.company_phone}
            onChange={(v) => setForm({ ...form, company_phone: v })}
          />
          <Field
            label="Email"
            value={form.company_email}
            onChange={(v) => setForm({ ...form, company_email: v })}
          />
          <Field
            label="Website"
            value={form.company_web}
            onChange={(v) => setForm({ ...form, company_web: v })}
          />
          <Field
            label="Accent color"
            value={form.accent_color}
            onChange={(v) => setForm({ ...form, accent_color: v })}
          />
          <Field
            label="Accent color (dark)"
            value={form.accent_color_dark}
            onChange={(v) => setForm({ ...form, accent_color_dark: v })}
          />
          <Field
            label="Legal addendum URL"
            value={form.legal_addendum_url}
            onChange={(v) => setForm({ ...form, legal_addendum_url: v })}
          />
        </div>
        <div className="flex justify-end gap-2 pt-4">
          <button onClick={onClose} className="h-9 rounded-md border border-border px-3 text-[13px]">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Rep edit dialog ---------- */

function RepDialog({
  tenant,
  rep,
  onClose,
  onSaved,
}: {
  tenant: Tenant;
  rep: TenantUser | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !rep;
  const lookupFn = useServerFn(lookupUserByEmail);

  const [emailInput, setEmailInput] = useState("");
  const [linkedProfile, setLinkedProfile] = useState<ProfileLite | null>(null);
  const [emailLookupErr, setEmailLookupErr] = useState<string | null>(null);
  const [looking, setLooking] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    rep_slug: rep?.rep_slug ?? "",
    rep_name: rep?.rep_name ?? "",
    rep_title: rep?.rep_title ?? "",
    rep_phone: rep?.rep_phone ?? "",
    rep_email: rep?.rep_email ?? "",
    is_active: rep?.is_active ?? true,
  });

  // Pre-load existing linked profile so the user knows who's currently linked
  useEffect(() => {
    if (!rep) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name")
        .eq("id", rep.user_id)
        .maybeSingle();
      if (data) {
        setLinkedProfile(data as ProfileLite);
        setEmailInput((data as ProfileLite).email ?? "");
      }
    })();
  }, [rep]);

  const lookup = async () => {
    setLooking(true);
    setEmailLookupErr(null);
    try {
      const result = await lookupFn({ data: { email: emailInput.trim() } });
      if (!result) {
        setLinkedProfile(null);
        setEmailLookupErr("No user found with that email. They must sign up first.");
      } else {
        setLinkedProfile(result);
        if (!form.rep_email) setForm((f) => ({ ...f, rep_email: result.email ?? "" }));
        if (!form.rep_name)
          setForm((f) => ({
            ...f,
            rep_name: [result.first_name, result.last_name].filter(Boolean).join(" ") || f.rep_name,
          }));
      }
    } catch (e) {
      setEmailLookupErr((e as Error).message);
    } finally {
      setLooking(false);
    }
  };

  const save = async () => {
    if (!linkedProfile) {
      toast.error("Look up a valid user email first");
      return;
    }
    if (!form.rep_slug || !form.rep_name) {
      toast.error("Rep slug and name are required");
      return;
    }
    setSaving(true);
    try {
      if (isNew) {
        const { error } = await supabase.from("tenant_users").insert({
          tenant_id: tenant.id,
          user_id: linkedProfile.id,
          ...form,
        });
        if (error) throw error;
        toast.success("Rep added");
      } else {
        const { error } = await supabase
          .from("tenant_users")
          .update({ user_id: linkedProfile.id, ...form })
          .eq("id", rep!.id);
        if (error) throw error;
        toast.success("Rep updated");
      }
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isNew ? `Add rep to ${tenant.company_name}` : `Edit rep ${rep?.rep_name}`}</DialogTitle>
          <DialogDescription>
            Enter the user's account email, click "Look up", then fill in their rep details.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-muted-foreground">
              User account email
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="user@example.com"
                className="h-9 flex-1 rounded-md border border-border bg-background px-3 text-sm"
              />
              <button
                type="button"
                onClick={lookup}
                disabled={!emailInput || looking}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-[13px] font-semibold disabled:opacity-50"
              >
                {looking && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Look up
              </button>
            </div>
            {linkedProfile && (
              <div className="mt-2 rounded-md border border-border bg-accent/40 p-2 text-[12px]">
                Linking to:{" "}
                <span className="font-semibold">{linkedProfile.email}</span> (
                {[linkedProfile.first_name, linkedProfile.last_name].filter(Boolean).join(" ") ||
                  "no name"}
                )
              </div>
            )}
            {emailLookupErr && (
              <p className="mt-2 text-[12px] text-red-500">{emailLookupErr}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label="Rep slug *"
              value={form.rep_slug}
              onChange={(v) => setForm({ ...form, rep_slug: v })}
            />
            <Field
              label="Rep name *"
              value={form.rep_name}
              onChange={(v) => setForm({ ...form, rep_name: v })}
            />
            <Field
              label="Title"
              value={form.rep_title}
              onChange={(v) => setForm({ ...form, rep_title: v })}
            />
            <Field
              label="Rep phone"
              value={form.rep_phone}
              onChange={(v) => setForm({ ...form, rep_phone: v })}
            />
            <Field
              label="Rep email (display)"
              value={form.rep_email}
              onChange={(v) => setForm({ ...form, rep_email: v })}
            />
            <Field
              label="Active"
              value={form.is_active ? "true" : "false"}
              onChange={(v) => setForm({ ...form, is_active: v === "true" })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="h-9 rounded-md border border-border px-3 text-[13px]">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving || !linkedProfile}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-semibold text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
      />
    </label>
  );
}
