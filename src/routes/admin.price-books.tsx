import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Library, Upload } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/admin/price-books")({
  component: AdminPriceBooks,
});

function AdminPriceBooks() {
  const { data: books = [], isLoading } = useQuery({
    queryKey: ["admin-master-pricebooks"],
    queryFn: async () => {
      const { data } = await supabase
        .from("price_books")
        .select("id, name, jurisdiction, zip_codes, effective_month, item_count, status, is_active, created_at, pricing_type")
        .eq("is_default", true)
        .is("company_id", null)
        .order("effective_month", { ascending: false, nullsFirst: false });
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Master Price Books</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Global default pricing libraries available to every company as a fallback.
          </p>
        </div>
        <Link
          to="/admin/price-books/new"
          className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-semibold hover:bg-accent"
        >
          <Upload className="h-4 w-4" />
          Upload master book
        </Link>
      </div>

      <div className="rounded-xl border border-border bg-card">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : books.length === 0 ? (
          <div className="p-12 text-center">
            <Library className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No master price books yet.</p>
            <Link to="/admin/price-books/new" className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">
              Upload your first master book →
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-3 font-semibold">Name</th>
                <th className="px-6 py-3 font-semibold">Type</th>
                <th className="px-6 py-3 font-semibold">Jurisdiction</th>
                <th className="px-6 py-3 font-semibold">Zips</th>
                <th className="px-6 py-3 font-semibold">Effective</th>
                <th className="px-6 py-3 text-right font-semibold">Items</th>
              </tr>
            </thead>
            <tbody>
              {books.map((b) => (
                <tr key={b.id} className="border-t border-border">
                  <td className="px-6 py-3 font-medium text-foreground">★ {b.name}</td>
                  <td className="px-6 py-3 capitalize text-muted-foreground">{b.pricing_type}</td>
                  <td className="px-6 py-3 text-muted-foreground">{b.jurisdiction ?? "—"}</td>
                  <td className="px-6 py-3 font-mono text-[11px] text-muted-foreground">
                    {(b.zip_codes ?? []).slice(0, 3).join(", ")}
                    {(b.zip_codes?.length ?? 0) > 3 ? ` +${b.zip_codes!.length - 3}` : ""}
                  </td>
                  <td className="px-6 py-3 text-muted-foreground">
                    {b.effective_month ? format(new Date(b.effective_month + "T00:00:00"), "MMM yyyy") : "—"}
                  </td>
                  <td className="px-6 py-3 text-right font-mono text-foreground">
                    {Number(b.item_count).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
