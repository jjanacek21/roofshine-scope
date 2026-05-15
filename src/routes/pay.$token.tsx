import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getPublicInvoice } from "@/lib/invoices-public.functions";
import { InvoicePreview } from "@/components/invoices/InvoicePreview";
import { PublicStripeCheckout } from "@/components/invoices/StripeCheckout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CreditCard, Building2, Download } from "lucide-react";
import { downloadInvoicePdf } from "@/lib/invoice-pdf";
import { toast } from "sonner";

export const Route = createFileRoute("/pay/$token")({
  component: PublicPayPage,
});

function money(n: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);
}

function PublicPayPage() {
  const { token } = Route.useParams();
  const fetchFn = useServerFn(getPublicInvoice);

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-invoice", token],
    queryFn: () => fetchFn({ data: { token } }),
  });

  const [showCheckout, setShowCheckout] = useState(false);
  const [amount, setAmount] = useState<string>("");

  if (isLoading) return <div className="p-12 text-center text-muted-foreground">Loading…</div>;
  if (error || !data) return <div className="p-12 text-center">Invoice not found.</div>;

  const inv = data.invoice as any;
  const due = Number(inv.amount_due);
  const isPaid = inv.status === "paid";
  const isVoid = inv.status === "void";
  const payAmount = Number(amount) || due;

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <InvoicePreview
            invoice={inv}
            lines={data.lines as any}
            company={data.company as any}
            layout={(data.template as any)?.layout}
          />
        </div>

        {!isVoid && !isPaid && (
          <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
            <h2 className="text-xl font-bold">Pay this invoice</h2>
            <p className="text-sm text-muted-foreground">
              Balance due: <strong className="font-mono-num text-foreground">{money(due)}</strong>
            </p>

            {!showCheckout ? (
              <>
                <div>
                  <Label>Amount to pay</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder={due.toFixed(2)}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Pay full balance or any partial amount.</p>
                </div>
                <Button size="lg" className="w-full" onClick={() => setShowCheckout(true)} disabled={payAmount <= 0 || payAmount > due + 0.01}>
                  <CreditCard className="h-4 w-4 mr-2" /> Pay {money(payAmount)} with card, Link, or bank
                </Button>

                {data.company?.bank_instructions && Object.keys(data.company.bank_instructions as any).length > 0 && (
                  <div className="border-t pt-4">
                    <h3 className="text-sm font-semibold flex items-center gap-2"><Building2 className="h-4 w-4" /> Wire / check instructions</h3>
                    <pre className="mt-2 text-xs whitespace-pre-wrap text-muted-foreground">
                      {JSON.stringify(data.company.bank_instructions, null, 2)}
                    </pre>
                  </div>
                )}
              </>
            ) : (
              <div>
                <Button variant="ghost" size="sm" onClick={() => setShowCheckout(false)} className="mb-3">← Change amount</Button>
                <PublicStripeCheckout
                  payToken={token}
                  amount={payAmount}
                  returnUrl={`${window.location.origin}/pay/${token}?paid=1`}
                />
              </div>
            )}
          </div>
        )}

        {isPaid && <div className="bg-emerald-50 text-emerald-800 rounded-xl p-6 text-center font-semibold">✓ This invoice has been paid in full. Thank you!</div>}
        {isVoid && <div className="bg-zinc-100 text-zinc-600 rounded-xl p-6 text-center">This invoice has been voided.</div>}
      </div>
    </div>
  );
}
