import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/clients")({
  component: ClientsPage,
});

function ClientsPage() {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Clients</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everyone you've worked with.
        </p>
      </div>

      <div
        className="rounded-xl border"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
      >
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
                <tr
                  key={c.id}
                  className="cursor-pointer border-t transition-colors hover:bg-[var(--surface-hover)]"
                  style={{ borderColor: "var(--border)" }}
                >
                  <td className="px-6 py-3 font-medium text-foreground">{c.name}</td>
                  <td className="px-6 py-3 text-muted-foreground">{c.email ?? "—"}</td>
                  <td className="px-6 py-3 font-mono-num text-muted-foreground">{c.phone ?? "—"}</td>
                  <td className="px-6 py-3 text-muted-foreground">{c.address ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
