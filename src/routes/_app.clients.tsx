import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_app/clients")({
  component: ClientsPage,
});

function ClientsPage() {
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "", notes: "" });

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, name, email, phone, address, created_at")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!profile?.company_id) throw new Error("No company");
      if (!form.name.trim()) throw new Error("Name required");
      const { error } = await supabase.from("clients").insert({
        company_id: profile.company_id,
        name: form.name.trim(),
        email: form.email || null,
        phone: form.phone || null,
        address: form.address || null,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Client added");
      setOpen(false);
      setForm({ name: "", email: "", phone: "", address: "", notes: "" });
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Clients</h1>
          <p className="mt-1 text-sm text-muted-foreground">Everyone you've worked with.</p>
        </div>
        <button onClick={() => setOpen(true)} className="btn-brand inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm font-semibold">
          <Plus className="h-4 w-4" /> Add Client
        </button>
      </div>

      <div className="rounded-xl border" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : clients.length === 0 ? (
          <p className="p-12 text-center text-sm text-muted-foreground">No clients yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-3 font-semibold">Name</th>
                <th className="px-6 py-3 font-semibold">Email</th>
                <th className="px-6 py-3 font-semibold">Phone</th>
                <th className="px-6 py-3 font-semibold">Address</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-t transition-colors hover:bg-[var(--surface-hover)]" style={{ borderColor: "var(--border)" }}>
                  <td className="px-6 py-3 font-medium">
                    <Link to="/clients/$id" params={{ id: c.id }} className="text-foreground hover:text-[var(--brand)]">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-6 py-3 text-muted-foreground">{c.email ?? "—"}</td>
                  <td className="px-6 py-3 font-mono-num text-muted-foreground">{c.phone ?? "—"}</td>
                  <td className="px-6 py-3 text-muted-foreground">{c.address ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader><SheetTitle>Add Client</SheetTitle></SheetHeader>
          <div className="mt-6 space-y-4">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} /></div>
            <button
              onClick={() => create.mutate()}
              disabled={!form.name.trim() || create.isPending}
              className="btn-brand h-10 w-full rounded-md text-sm font-semibold disabled:opacity-40"
            >
              {create.isPending ? "Saving…" : "Save Client"}
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
