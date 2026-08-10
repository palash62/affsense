"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, CreditCard, ExternalLink, Landmark, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { WISE_PAYMENT_QR_SRC, WISE_PAYMENT_URL } from "@/lib/wise-payment";
import { WalletStripeCheckout } from "@/components/advertiser/wallet-stripe-checkout";

const QUICK_AMOUNTS = [50, 100, 250, 500, 1000];

type PaymentMethod = "CREDIT_CARD" | "WISE";

type StripeCheckoutState = {
  amount: number;
  clientSecret: string;
  publishableKey: string;
  depositId: string;
};

function CurrencyInput({
  id,
  value,
  onChange,
  min,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
}) {
  return (
    <div
      className={cn(
        "flex h-11 w-full items-stretch overflow-hidden rounded-lg border border-border bg-card shadow-sm",
        "transition-colors focus-within:border-[var(--theme-primary)] focus-within:ring-2 focus-within:ring-[var(--theme-primary)]/15",
      )}
    >
      <span className="flex w-10 shrink-0 items-center justify-center border-r border-border bg-muted text-sm font-semibold text-muted-foreground">
        $
      </span>
      <input
        id={id}
        type="number"
        min={min}
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0.00"
        className="min-w-0 flex-1 border-0 bg-card px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <span className="flex w-12 shrink-0 items-center justify-center border-l border-border bg-muted text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        USD
      </span>
    </div>
  );
}

export function WalletRechargePanel({
  initialBalance,
}: {
  initialBalance: { balance: number; availableBalance: number; currency: string };
}) {
  const router = useRouter();
  const [balance, setBalance] = useState(initialBalance);
  const [method, setMethod] = useState<PaymentMethod>("CREDIT_CARD");
  const [amount, setAmount] = useState("100");
  const [wiseReference, setWiseReference] = useState("");
  const [payerName, setPayerName] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [stripeEnabled, setStripeEnabled] = useState<boolean | null>(null);
  const [stripeCheckout, setStripeCheckout] = useState<StripeCheckoutState | null>(null);
  const [copiedWiseLink, setCopiedWiseLink] = useState(false);

  const numericAmount = Number(amount);
  const canSubmit =
    !loading &&
    !stripeCheckout &&
    numericAmount >= 10 &&
    (method === "WISE" ? wiseReference.trim().length > 0 : stripeEnabled === true);

  useEffect(() => {
    fetch("/api/v1/wallet/stripe/config")
      .then((r) => r.json())
      .then((d) => setStripeEnabled(Boolean(d?.data?.enabled && d?.data?.publishableKey)))
      .catch(() => setStripeEnabled(false));
  }, []);

  async function deposit() {
    if (!canSubmit) {
      if (method === "WISE") {
        setError("Enter amount (min $10) and Wise transfer reference");
      } else if (stripeEnabled === false) {
        setError("Credit card payments are not configured yet. Use Wise or contact support.");
      } else {
        setError("Minimum deposit is $10.00");
      }
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    if (method === "WISE") {
      const res = await fetch("/api/v1/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: numericAmount,
          method: "WISE",
          wiseReference: wiseReference.trim(),
          ...(payerName.trim() ? { payerName: payerName.trim() } : {}),
          ...(note.trim() ? { note: note.trim() } : {}),
        }),
      });
      const data = await res.json();

      if (res.ok) {
        setBalance(data.balance);
        setSuccess(`Wise deposit submitted for $${numericAmount.toFixed(2)}. Pending admin approval.`);
        setWiseReference("");
        setPayerName("");
        setNote("");
        router.refresh();
      } else {
        setError(data?.error?.message ?? "Unable to add funds. Please try again.");
      }

      setLoading(false);
      return;
    }

    const res = await fetch("/api/v1/wallet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: numericAmount, method: "CREDIT_CARD" }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data?.error?.message ?? "Unable to start card payment. Please try again.");
      return;
    }

    setStripeCheckout({
      amount: numericAmount,
      clientSecret: data.clientSecret,
      publishableKey: data.publishableKey,
      depositId: data.depositId,
    });
  }

  function handleStripeSuccess(nextBalance: {
    balance: number;
    holdBalance: number;
    availableBalance: number;
    currency: string;
  }) {
    setBalance({
      balance: nextBalance.balance,
      availableBalance: nextBalance.availableBalance,
      currency: nextBalance.currency,
    });
    setStripeCheckout(null);
    setSuccess(`$${numericAmount.toFixed(2)} added and approved instantly.`);
    router.refresh();
  }

  return (
    <div id="add-funds" className="scroll-mt-24 space-y-5">
      <div
        className="rounded-xl border px-4 py-4"
        style={{
          borderColor: "color-mix(in srgb, var(--theme-primary) 20%, transparent)",
          background: "var(--theme-primary-soft)",
        }}
      >
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Available balance</p>
        <p className="mt-1 text-3xl font-bold tracking-tight text-[var(--theme-primary)]">
          ${balance.availableBalance.toFixed(2)}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Total: ${balance.balance.toFixed(2)} {balance.currency}
        </p>
      </div>

      <div className="space-y-2">
        <Label>Payment method</Label>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              setMethod("CREDIT_CARD");
              setStripeCheckout(null);
            }}
            className={cn(
              "flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
              method === "CREDIT_CARD"
                ? "border-[var(--theme-primary)] bg-[var(--theme-primary-soft)]"
                : "border-border bg-white hover:border-border",
            )}
          >
            <CreditCard className="h-5 w-5 text-[var(--theme-primary)]" />
            <div>
              <p className="text-sm font-semibold text-foreground">Credit Card</p>
              <p className="text-xs text-muted-foreground">
                {stripeEnabled === false ? "Not configured" : "Stripe checkout"}
              </p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => {
              setMethod("WISE");
              setStripeCheckout(null);
            }}
            className={cn(
              "flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
              method === "WISE"
                ? "border-[var(--theme-primary)] bg-[var(--theme-primary-soft)]"
                : "border-border bg-white hover:border-border",
            )}
          >
            <Landmark className="h-5 w-5 text-[var(--theme-primary)]" />
            <div>
              <p className="text-sm font-semibold text-foreground">Wise</p>
              <p className="text-xs text-muted-foreground">Admin reviews transfer</p>
            </div>
          </button>
        </div>
      </div>

      {!stripeCheckout && (
        <div className="space-y-2">
          <Label htmlFor="add-funds-amount">Amount</Label>
          <CurrencyInput id="add-funds-amount" value={amount} onChange={setAmount} min={10} />
          <div className="flex flex-wrap gap-2 pt-1">
            {QUICK_AMOUNTS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmount(String(preset))}
                className={cn(
                  "rounded-lg border px-3 py-1 text-xs font-medium transition-colors",
                  Number(amount) === preset
                    ? "border-[var(--theme-primary)] bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]"
                    : "border-border bg-card text-muted-foreground hover:bg-muted",
                )}
              >
                ${preset}
              </button>
            ))}
          </div>
        </div>
      )}

      {method === "WISE" && !stripeCheckout && (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
            <p className="text-sm font-medium text-foreground">Choose how to pay</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Pay first with the QR code or payment link, then submit your transfer reference below.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-card p-4 text-center shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Scan QR
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={WISE_PAYMENT_QR_SRC}
                  alt="Wise payment QR code"
                  className="mx-auto mt-3 h-40 w-40 rounded-lg object-contain"
                />
              </div>
              <div className="flex flex-col justify-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Pay online
                </p>
                <a
                  href={WISE_PAYMENT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#163300] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0f2400]"
                >
                  Open Wise payment page
                  <ExternalLink className="h-4 w-4" />
                </a>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 border-border"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(WISE_PAYMENT_URL);
                      setCopiedWiseLink(true);
                      toast.success("Wise payment link copied");
                      window.setTimeout(() => setCopiedWiseLink(false), 2000);
                    } catch {
                      toast.error("Could not copy link");
                    }
                  }}
                >
                  {copiedWiseLink ? (
                    <>
                      <Check className="mr-2 h-4 w-4 text-emerald-600" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy link
                    </>
                  )}
                </Button>
                <p className="break-all text-[11px] leading-relaxed text-muted-foreground">
                  {WISE_PAYMENT_URL}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-border bg-muted/60 p-4">
            <p className="text-sm text-muted-foreground">
              After paying via Wise, enter the reference and payer details below. Funds are credited
              after admin approval.
            </p>
            <div className="space-y-2">
              <Label htmlFor="wise-reference">Wise transfer reference *</Label>
              <input
                id="wise-reference"
                value={wiseReference}
                onChange={(e) => setWiseReference(e.target.value)}
                placeholder="e.g. WISE-123456789"
                className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-[var(--theme-primary)] focus:ring-2 focus:ring-[var(--theme-primary)]/15"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wise-payer">Payer / company name</Label>
              <input
                id="wise-payer"
                value={payerName}
                onChange={(e) => setPayerName(e.target.value)}
                placeholder="Name on the Wise transfer"
                className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-[var(--theme-primary)] focus:ring-2 focus:ring-[var(--theme-primary)]/15"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wise-note">Note (optional)</Label>
              <textarea
                id="wise-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Any extra details for admin review"
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-[var(--theme-primary)] focus:ring-2 focus:ring-[var(--theme-primary)]/15"
              />
            </div>
          </div>
        </div>
      )}

      {method === "CREDIT_CARD" && stripeEnabled === false && !stripeCheckout && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Credit card payments are not enabled yet. Ask your platform admin to add Stripe keys in
          Admin → Settings → Payments (Stripe).
        </p>
      )}

      {stripeCheckout && (
        <WalletStripeCheckout
          amount={stripeCheckout.amount}
          clientSecret={stripeCheckout.clientSecret}
          publishableKey={stripeCheckout.publishableKey}
          depositId={stripeCheckout.depositId}
          onSuccess={handleStripeSuccess}
          onCancel={() => setStripeCheckout(null)}
        />
      )}

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {success && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {success}
        </p>
      )}

      {!stripeCheckout && (
        <Button
          type="button"
          onClick={deposit}
          disabled={!canSubmit}
          size="lg"
          className="h-12 w-full rounded-xl bg-[var(--theme-primary)] text-base font-semibold text-white shadow-md hover:opacity-90 sm:w-auto sm:min-w-[200px]"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Plus className="mr-2 h-5 w-5" />
              {method === "CREDIT_CARD" ? "Continue to Card Payment" : "Submit Wise Deposit"}
            </>
          )}
        </Button>
      )}
    </div>
  );
}
