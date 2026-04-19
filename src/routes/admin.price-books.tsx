import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Library, Upload, Layers, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import AdminMacrosPage from "@/routes/admin.macros";

export const Route = createFileRoute("/admin/price-books")({
  component: AdminPricing,
});

function AdminPricing() {
  const [tab, setTab] = useState<"insurance" | "macros">("insurance");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Master Pricing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Insurance pricing libraries from Xactimate uploads, plus reusable Master Macros for retail pricing.
        </p>
      </div>

      <div className="flex gap-1 border-b" style={{ borderColor: "var(--border)" }}>
        <button
          onClick={() => setTab("insurance")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors",
            tab === "insurance"
              ? "border-[var(--brand)] text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <Layers className="h-4 w-4" /> Insurance Pricing
        </button>
        <button
          onClick={() => setTab("macros")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors",
            tab === "macros"
              ? "border-[var(--brand)] text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <DollarSign className="h-4 w-4" /> Master Macros (Retail)
        </button>
      </div>

      {tab === "insurance" ? <InsuranceList /> : <AdminMacrosPage />}
    </div>
  );
}

function InsuranceList() {
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Master insurance libraries are available to every company as a fallback when their own pricing isn't set.
        </p>
        <Link
          to="/admin/price-books/new"
          className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-semibold hover:bg-accent"
        >
          <Upload className="h-4 w-4" />
          Upload estimate file
        </Link>
      </div>

      <div className="rounded-xl border border-border bg-card">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading…</p>
        ) : books.length === 0 ? (
          <div className="p-12 text-center">
            <Library className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No master pricing libraries yet.</p>
            <Link to="/admin/price-books/new" className="mt-3 inline-block text-sm font-semibold text-primary hover:underline">
              Upload your first Xactimate estimate →
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
