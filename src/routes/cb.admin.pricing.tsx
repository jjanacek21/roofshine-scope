import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CbAdminShell } from "@/components/cb/CbAdminShell";
import { CbCard, CbButton, CbSkeleton, CbBadge } from "@/components/cb/primitives";
import { CbField, CbSegmentedCards } from "@/components/cb/forms";
import { useCbSession } from "@/components/auth/CbSessionProvider";

export const Route = createFileRoute("/cb/admin/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — Claim Buddy admin" },
      {
        name: "description",
        content:
          "Choose the default estimate mode, set your price per square, and pick the price book used for full line-item estimates.",
      },
      { property: "og:title", content: "Pricing — Claim Buddy admin" },
      { property: "og:description", content: "Estimate defaults for every new inspection." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CbAdminPricingPage,
});

type Mode = "per_square" | "line_item";

function CbAdminPricingPage() {
  const { workspace, refresh } = useCbSession();
  const [mode, setMode] = useState<Mode>("per_square");
  const [perSquare, setPerSquare] = useState("450");
  const [bookId, setBookId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const wsQuery = useQuery({
    queryKey: ["cb-ws-pricing", workspace?.id],
    enabled: !!workspace?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cb_workspaces")
        .select("id, default_price_per_square, default_price_book_id, measure_credits, plan")
        .eq("id", workspace!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const booksQuery = useQuery({
    queryKey: ["cb-price-books"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_books")
        .select("id, name, region, status")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const ws = wsQuery.data;
    if (!ws) return;
    if (ws.default_price_per_square != null) setPerSquare(String(ws.default_price_per_square));
    setBookId(ws.default_price_book_id ?? "");
    setMode(ws.default_price_book_id ? "line_item" : "per_square");
  }, [wsQuery.data?.id]);

  async function save() {
    if (!workspace) return;
    const value = Number(perSquare);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Give a price per square greater than zero.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("cb_workspaces")
      .update({
        default_price_per_square: value,
        default_price_book_id: mode === "line_item" ? bookId || null : null,
      })
      .eq("id", workspace.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    void refresh();
    void wsQuery.refetch();
    toast.success("Estimate defaults saved.");
  }

  return (
    <CbAdminShell title="Pricing" subtitle="What every new estimate starts from.">
      {wsQuery.isLoading ? (
        <CbSkeleton height={220} radius={18} />
      ) : (
        <div className="space-y-5">
          <CbCard elevation="raised" style={{ padding: 18 }}>
            <CbSegmentedCards<Mode>
              label="Default estimate mode"
              value={mode}
              onChange={setMode}
              options={[
                {
                  value: "per_square",
                  title: "Price per square",
                  body: "One number, fast. True squares plus waste × your rate.",
                },
                {
                  value: "line_item",
                  title: "Full line item",
                  body: "Carrier-style scope built from the takeoff and a price book.",
                },
              ]}
            />
          </CbCard>

          <CbCard elevation="card" style={{ padding: 18 }}>
            <CbField
              label="Price per square ($)"
              inputMode="decimal"
              value={perSquare}
              onChange={(e) => setPerSquare(e.target.value)}
              hint="Used for Mode A quotes and as the fallback everywhere else."
            />
          </CbCard>

          {mode === "line_item" ? (
            <CbCard elevation="card" style={{ padding: 18 }}>
              <p className="cb-microlabel">Price book</p>
              <p className="mt-1 text-[12.5px]" style={{ color: "var(--cb-text-muted)" }}>
                Leave empty to let Claim Buddy pick the market book from the property's state and ZIP.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="cb-chip"
                  onClick={() => setBookId("")}
                  aria-pressed={bookId === ""}
                  style={bookId === "" ? { background: "var(--cb-accent)", color: "#fff", borderColor: "transparent" } : undefined}
                >
                  Automatic by market
                </button>
                {(booksQuery.data ?? []).map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    className="cb-chip"
                    onClick={() => setBookId(b.id)}
                    aria-pressed={bookId === b.id}
                    style={bookId === b.id ? { background: "var(--cb-accent)", color: "#fff", borderColor: "transparent" } : undefined}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            </CbCard>
          ) : null}

          <CbCard elevation="card" style={{ padding: 18 }}>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="cb-microlabel">Measurement credits</p>
                <p className="mt-1 text-[15px]">
                  <span className="cb-num">{wsQuery.data?.measure_credits ?? 0}</span> remaining
                </p>
              </div>
              <CbBadge tone="accent">{wsQuery.data?.plan ?? "starter"}</CbBadge>
            </div>
          </CbCard>

          <CbButton block loading={saving} loadingText="Saving…" onClick={save}>
            Save pricing defaults
          </CbButton>
        </div>
      )}
    </CbAdminShell>
  );
}
