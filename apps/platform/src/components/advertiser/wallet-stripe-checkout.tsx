"use client";

import { useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackPurchase } from "@/lib/tracking/public-page-tracking";

type CheckoutProps = {
  amount: number;
  clientSecret: string;
  publishableKey: string;
  depositId: string;
  onSuccess: (balance: {
    balance: number;
    holdBalance: number;
    availableBalance: number;
    currency: string;
  }) => void;
  onCancel: () => void;
};

function StripeCheckoutForm({
  amount,
  depositId,
  onSuccess,
  onCancel,
}: Omit<CheckoutProps, "clientSecret" | "publishableKey">) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setError(null);

    const { error: stripeError } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
    });

    if (stripeError) {
      setError(stripeError.message ?? "Card payment failed");
      setSubmitting(false);
      return;
    }

    const res = await fetch("/api/v1/wallet/stripe/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ depositId }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(data?.error?.message ?? "Unable to confirm payment");
      return;
    }

    trackPurchase({
      value: amount,
      currency: "USD",
      eventID: depositId,
    });

    onSuccess(data.balance);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">
        Pay <strong>${amount.toFixed(2)}</strong> securely with your credit or debit card.
      </p>
      <PaymentElement />
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={!stripe || submitting}>
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            `Pay $${amount.toFixed(2)}`
          )}
        </Button>
        <Button type="button" variant="outline" disabled={submitting} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function WalletStripeCheckout(props: CheckoutProps) {
  const [stripePromise] = useState(() => loadStripe(props.publishableKey));

  return (
    <Elements stripe={stripePromise} options={{ clientSecret: props.clientSecret }}>
      <StripeCheckoutForm
        amount={props.amount}
        depositId={props.depositId}
        onSuccess={props.onSuccess}
        onCancel={props.onCancel}
      />
    </Elements>
  );
}
