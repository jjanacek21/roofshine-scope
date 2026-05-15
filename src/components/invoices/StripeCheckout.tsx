import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { useServerFn } from "@tanstack/react-start";
import { createPublicInvoiceCheckout } from "@/lib/payments.functions";
import { useCallback } from "react";

export function PublicStripeCheckout({
  payToken,
  amount,
  returnUrl,
}: {
  payToken: string;
  amount: number;
  returnUrl: string;
}) {
  const createFn = useServerFn(createPublicInvoiceCheckout);

  const fetchClientSecret = useCallback(async () => {
    const res = await createFn({
      data: { pay_token: payToken, amount, return_url: returnUrl, environment: getStripeEnvironment() },
    });
    return res.client_secret as string;
  }, [createFn, payToken, amount, returnUrl]);

  return (
    <div id="checkout">
      <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
