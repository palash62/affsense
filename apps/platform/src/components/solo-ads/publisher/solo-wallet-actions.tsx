"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { ArrowRightLeft, Check, Copy, CreditCard, Loader2, Send, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatUsdCents, soloRequest } from "@/components/solo-ads/solo-ui";

type Intent = { depositId: string; clientSecret: string; publishableKey: string; amountCents: number };

function CardForm({ intent, onDone, onCancel }: { intent: Intent; onDone: () => void; onCancel: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);
    const { error: stripeError } = await stripe.confirmPayment({ elements, redirect: "if_required" });
    if (stripeError) {
      setError(stripeError.message ?? "Card payment failed");
      setBusy(false);
      return;
    }
    try {
      const deposit = await soloRequest<{ status: string }>(`/api/v1/publisher/solo-ads/wallet/deposits/${intent.depositId}/refresh`, {
        method: "POST",
      });
      if (deposit.status === "SUCCEEDED") toast.success(`${formatUsdCents(intent.amountCents)} added to your ad wallet`);
      else toast.message("Payment received. Funds will appear as soon as your bank confirms it.");
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <PaymentElement />
      {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={!stripe || busy}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Pay {formatUsdCents(intent.amountCents)}
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function StripeCard({ intent, onDone, onCancel }: { intent: Intent; onDone: () => void; onCancel: () => void }) {
  const [stripePromise] = useState(() => loadStripe(intent.publishableKey));
  return (
    <Elements stripe={stripePromise} options={{ clientSecret: intent.clientSecret }}>
      <CardForm intent={intent} onDone={onDone} onCancel={onCancel} />
    </Elements>
  );
}

function WiseDepositForm({ receiveId, minDepositCents, onDone }: { receiveId: string; minDepositCents: number; onDone: () => void }) {
  const [amount, setAmount] = useState((Math.max(minDepositCents, 5000) / 100).toFixed(2));
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  function copyId() {
    navigator.clipboard
      .writeText(receiveId)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => setCopied(false));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await soloRequest("/api/v1/publisher/solo-ads/wallet/deposits/wise", {
        body: { amount: Number(amount), reference, note },
      });
      toast.success("Wise payment submitted. Funds are added once an admin confirms it.");
      setReference("");
      setNote("");
      onDone();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
        <li>Send the amount in USD from your Wise account to the Wise ID below.</li>
        <li>Enter the amount you sent and the Wise transfer reference, then submit.</li>
        <li>Funds are added to your ad wallet once an admin confirms the payment.</li>
      </ol>
      <div className="space-y-1.5">
        <Label htmlFor="solo-wise-id">Pay to (Wise)</Label>
        <div className="flex gap-2">
          <Input id="solo-wise-id" value={receiveId} readOnly className="font-mono text-sm" />
          <Button type="button" variant="outline" onClick={copyId}>
            {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="solo-wise-amount">Amount sent (USD)</Label>
          <Input
            id="solo-wise-amount"
            type="number"
            step="0.01"
            min={(minDepositCents / 100).toFixed(2)}
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="solo-wise-reference">Wise transfer reference</Label>
          <Input
            id="solo-wise-reference"
            required
            minLength={3}
            maxLength={120}
            placeholder="e.g. #123456789"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="solo-wise-note">Note (optional)</Label>
        <Input id="solo-wise-note" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <p className="text-xs text-muted-foreground">Minimum {formatUsdCents(minDepositCents)}. Funds can only be used for Solo Ads.</p>
      <Button type="submit" disabled={busy}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        Submit Wise payment
      </Button>
    </form>
  );
}

export function SoloWalletActions({
  minDepositCents,
  earningsAvailableCents,
  transferEnabled,
  cardEnabled,
  wiseReceiveId,
  readOnly,
}: {
  minDepositCents: number;
  earningsAvailableCents: number;
  transferEnabled: boolean;
  cardEnabled: boolean;
  wiseReceiveId: string | null;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [method, setMethod] = useState<"card" | "wise">(cardEnabled || !wiseReceiveId ? "card" : "wise");
  const [amount, setAmount] = useState((Math.max(minDepositCents, 5000) / 100).toFixed(2));
  const [intent, setIntent] = useState<Intent | null>(null);
  const [starting, setStarting] = useState(false);
  const [transferAmount, setTransferAmount] = useState("");
  const [transferKey, setTransferKey] = useState(() => crypto.randomUUID());
  const [transferring, setTransferring] = useState(false);

  async function startDeposit(e: React.FormEvent) {
    e.preventDefault();
    setStarting(true);
    try {
      const data = await soloRequest<Omit<Intent, "amountCents">>("/api/v1/publisher/solo-ads/wallet/deposits", {
        body: { amount: Number(amount) },
      });
      setIntent({ ...data, amountCents: Math.round(Number(amount) * 100) });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setStarting(false);
    }
  }

  async function transfer(e: React.FormEvent) {
    e.preventDefault();
    if (!window.confirm(`Move $${Number(transferAmount).toFixed(2)} from your earnings to your ad wallet? This cannot be undone.`)) return;
    setTransferring(true);
    try {
      await soloRequest("/api/v1/publisher/solo-ads/wallet/transfer", {
        body: { amount: Number(transferAmount), requestKey: transferKey },
      });
      toast.success("Transfer complete");
      setTransferAmount("");
      setTransferKey(crypto.randomUUID());
      router.refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setTransferring(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="premium-card space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-[var(--theme-primary)]" />
            <h2 className="text-base font-semibold">Add funds</h2>
          </div>
          {cardEnabled && wiseReceiveId && !intent ? (
            <div role="tablist" className="inline-flex rounded-lg bg-muted p-0.5 text-sm">
              {(["card", "wise"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={method === m}
                  onClick={() => setMethod(m)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 font-medium ${
                    method === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m === "card" ? <CreditCard className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                  {m === "card" ? "Card" : "Wise"}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {readOnly ? (
          <p className="text-sm text-muted-foreground">Deposits are disabled while viewing as this affiliate.</p>
        ) : !cardEnabled && !wiseReceiveId ? (
          <p className="text-sm text-muted-foreground">
            Adding funds is not available right now.{transferEnabled ? " You can still move your earnings into the ad wallet." : ""}
          </p>
        ) : method === "wise" && wiseReceiveId ? (
          <WiseDepositForm receiveId={wiseReceiveId} minDepositCents={minDepositCents} onDone={() => router.refresh()} />
        ) : intent ? (
          <StripeCard
            intent={intent}
            onCancel={() => setIntent(null)}
            onDone={() => {
              setIntent(null);
              router.refresh();
            }}
          />
        ) : (
          <form onSubmit={startDeposit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="solo-deposit">Amount (USD)</Label>
              <Input
                id="solo-deposit"
                type="number"
                step="0.01"
                min={(minDepositCents / 100).toFixed(2)}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Minimum {formatUsdCents(minDepositCents)}. Funds can only be used for Solo Ads.</p>
            </div>
            <Button type="submit" disabled={starting}>
              {starting ? "Preparing..." : "Continue to payment"}
            </Button>
          </form>
        )}
      </section>

      {transferEnabled ? (
        <section className="premium-card space-y-4 p-6">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-[var(--theme-primary)]" />
            <h2 className="text-base font-semibold">Use your earnings</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Available earnings: <strong>{formatUsdCents(earningsAvailableCents)}</strong>. Moved funds are deducted from your
            earnings balance and cannot be moved back.
          </p>
          {readOnly ? null : (
            <form onSubmit={transfer} className="flex flex-wrap items-end gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="solo-transfer">Amount (USD)</Label>
                <Input
                  id="solo-transfer"
                  type="number"
                  step="0.01"
                  min="1"
                  max={(earningsAvailableCents / 100).toFixed(2)}
                  required
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  className="w-40"
                />
              </div>
              <Button type="submit" variant="outline" disabled={transferring || earningsAvailableCents <= 0}>
                {transferring ? "Moving..." : "Move to ad wallet"}
              </Button>
            </form>
          )}
        </section>
      ) : null}
    </div>
  );
}
