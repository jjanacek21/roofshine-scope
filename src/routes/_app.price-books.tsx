import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/brand/StatusBadge";
import { StatCard } from "@/components/brand/StatCard";
import { Library, Upload } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/price-books")({
  component: PriceBooksPage,
});

function PriceBooksPage() {
  const { data: books = [], isLoading } = useQuery({
    queryKey: ["price-books"],
    queryFn: async () => {
      const { data } = await supabase
        .from("price_books")
        .select("id, name, source, region, status, item_count, updated_at")
        .order("updated_at", { ascending: false });
      return data ?? [];
    },
  });

  const totalItems = books.reduce((s, b) => s + (b.item_count ?? 0), 0);
  const activeCount = books.filter((b) => b.status === "active").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Price Books</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pricing libraries powering your catalog.
          </p>
        </div>
        <button
          onClick={() => toast.info("Upload importer coming in next build")}
          className="btn-brand flex h-9 items-center gap-2 rounded-md px-4 text-sm font-semibold"
        >
          <Upload className="h-4 w-4" />
          Upload New Book
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Books" value={books.length} icon={<Library className="h-4 w-4" />} />
        <StatCard label="Active" value={activeCount} />
        <StatCard label="Total Items" value={totalItems.toLocaleString()} />
      </div>

      <div
        className="rounded-xl border"
        style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
      >
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : books.length === 0 ? (
          <p className="p-12 text-center text-sm text-muted-foreground">
            No price books yet. Upload an Xactimate or local trade book.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-3 font-semibold">Name</th>
                <th className="px-6 py-3 font-semibold">Source</th>
                <th className="px-6 py-3 font-semibold">Region</th>
                <th className="px-6 py-3 text-right font-semibold">Items</th>
                <th className="px-6 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {books.map((b) => (
                <tr
                  key={b.id}
                  className="border-t hover:bg-[var(--surface-hover)]"
                  style={{ borderColor: "var(--border)" }}
                >
                  <td className="px-6 py-3 font-medium text-foreground">{b.name}</td>
                  <td className="px-6 py-3 text-muted-foreground">{b.source ?? "—"}</td>
                  <td className="px-6 py-3 text-muted-foreground">{b.region ?? "—"}</td>
                  <td className="px-6 py-3 text-right font-mono-num text-foreground">
                    {Number(b.item_count).toLocaleString()}
                  </td>
                  <td className="px-6 py-3"><StatusBadge status={b.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
