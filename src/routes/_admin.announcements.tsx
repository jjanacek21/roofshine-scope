import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export const Route = createFileRoute("/_admin/announcements")({
  component: AdminAnnouncements,
});

type Announcement = {
  id: string;
  title: string;
  body: string;
  severity: string;
  created_at: string;
  expires_at: string | null;
};

function AdminAnnouncements() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Announcement[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [severity, setSeverity] = useState("info");
  const [expires, setExpires] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("announcements")
      .select("id, title, body, severity, created_at, expires_at")
      .order("created_at", { ascending: false });
    setRows((data as Announcement[]) ?? []);
  };

  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("announcements").insert({
      title,
      body,
      severity,
      created_by: user.id,
      expires_at: expires ? new Date(expires).toISOString() : null,
      audience_company_id: null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Announcement posted to all dashboards");
    setTitle(""); setBody(""); setExpires("");
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setRows((r) => r.filter((x) => x.id !== id));
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Announcements</h1>
        <p className="text-sm text-muted-foreground">Post messages that show up at the top of every user's dashboard.</p>
      </header>

      <form onSubmit={create} className="space-y-4 rounded-xl border border-border bg-card p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-muted-foreground">Title</span>
            <input
              required value={title} onChange={(e) => setTitle(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted-foreground">Severity</span>
            <select
              value={severity} onChange={(e) => setSeverity(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            >
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </label>
        </div>
        <label className="block text-sm">
          <span className="text-muted-foreground">Body</span>
          <textarea
            required value={body} onChange={(e) => setBody(e.target.value)} rows={3}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="text-muted-foreground">Expires (optional)</span>
          <input
            type="datetime-local" value={expires} onChange={(e) => setExpires(e.target.value)}
            className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm sm:w-72"
          />
        </label>
        <button
          type="submit" disabled={saving}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {saving ? "Posting…" : "Post announcement"}
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left">Title</th>
              <th className="px-4 py-3 text-left">Severity</th>
              <th className="px-4 py-3 text-left">Posted</th>
              <th className="px-4 py-3 text-left">Expires</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No announcements.</td></tr>
            ) : (
              rows.map((a) => (
                <tr key={a.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{a.title}</td>
                  <td className="px-4 py-3 capitalize">{a.severity}</td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(a.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-muted-foreground">{a.expires_at ? new Date(a.expires_at).toLocaleString() : "Never"}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => remove(a.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
