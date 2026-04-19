import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/brand/StatusBadge";
import { StatCard } from "@/components/brand/StatCard";
import { Library, Upload } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/_app/price-books")({
  component: PriceBooksPage,
});

function PriceBooksPage() {
  const { data: books = [], isLoading } = useQuery({
    queryKey: ["price-books"],
    queryFn: async () => {
      const { data } = await supabase
        .from("price_books")
        .select("id, name, jurisdiction, zip_codes, effective_month, item_count, status, is_active, created_at, source_file_url")
        .order("effective_month", { ascending: false, nullsFirst: false });
      return data ?? [];
    },
  });

  const totalItems = books.reduce((s, b) => s + (b.item_count ?? 0), 0);
  const activeCount = books.filter((b) => b.is_active).length;
  const lastReprice = books[0];
  const lastReDays = lastReprice?.created_at
    ? Math.floor((Date.now() - new Date(lastReprice.created_at).getTime()) / 86400000)
    : null;

  async function downloadSource(path: string) {
    const { data } = await supabase.storage.from("xactimate-uploads").createSignedUrl(path, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Price Books</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pricing libraries powering your catalog.
          </p>
        </div>
        <Link
          to="/price-books/new"
          className="btn-chrome flex h-9 items-center gap-2 rounded-md px-4 text-sm font-semibold"
        >
          <Upload className="h-4 w-4" />
          Upload New Book
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Active Books" value={activeCount} icon={<Library className="h-4 w-4" />} />
        <StatCard
          label="Last Reprice"
          value={lastReDays != null ? `${lastReDays}d ago` : "—"}
          delta={lastReprice?.name ?? undefined}
          deltaDirection="neutral"
        />
        <StatCard label="Total Items Priced" value={totalItems.toLocaleString()} />
      </div>

      <div className="rounded-xl border" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : books.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-muted-foreground">No price books yet.</p>
            <Link to="/price-books/new" className="mt-3 inline-block text-sm font-semibold text-[var(--brand)] hover:underline">
              Upload your first Xactimate export →
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-3 font-semibold">Name</th>
                <th className="px-6 py-3 font-semibold">Jurisdiction</th>
                <th className="px-6 py-3 font-semibold">Zips</th>
                <th className="px-6 py-3 font-semibold">Effective</th>
                <th className="px-6 py-3 text-right font-semibold">Items</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold">Source</th>
              </tr>
            </thead>
            <tbody>
              {books.map((b) => (
                <tr key={b.id} className="border-t hover:bg-[var(--surface-hover)]" style={{ borderColor: "var(--border)" }}>
                  <td className="px-6 py-3 font-medium text-foreground">{b.name}</td>
                  <td className="px-6 py-3">
                    {b.jurisdiction ? (
                      <span className="rounded-md border px-2 py-0.5 text-xs text-foreground" style={{ borderColor: "var(--border)", backgroundColor: "var(--bg-card)" }}>
                        {b.jurisdiction}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(b.zip_codes ?? []).slice(0, 3).map((z) => (
                        <span key={z} className="font-mono-num text-[11px] text-muted-foreground">{z}</span>
                      ))}
                      {(b.zip_codes?.length ?? 0) > 3 && (
                        <span className="text-[11px] text-muted-foreground">+{(b.zip_codes!.length - 3)} more</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-3 text-muted-foreground">
                    {b.effective_month ? format(new Date(b.effective_month + "T00:00:00"), "MMM yyyy") : "—"}
                  </td>
                  <td className="px-6 py-3 text-right font-mono-num text-foreground">
                    {Number(b.item_count).toLocaleString()}
                  </td>
                  <td className="px-6 py-3">
                    <StatusBadge status={b.is_active ? "active" : "archived"} />
                  </td>
                  <td className="px-6 py-3">
                    {b.source_file_url ? (
                      <button onClick={() => downloadSource(b.source_file_url!)} className="text-xs text-[var(--brand)] hover:underline">
                        Download
                      </button>
                    ) : "—"}
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
