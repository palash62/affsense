"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Banknote, Clock, Loader2 } from "lucide-react";
import { formatCurrency } from "@/components/admin/admin-ui";
import { PageSection } from "@/components/admin/page-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EMPTY_BANK_DETAILS,
  PublisherBankPayoutFields,
} from "@/components/publisher/publisher-bank-payout-fields";
import type { BankPayoutDetails } from "@/lib/payout-payment-details";

type PayoutMethod = "WISE" | "BANK_TRANSFER" | "STRIPE_CONNECT";

export type CpaMinPayoutSettings = {
  wise: number;
  bankTransfer: number;
  stripeConnect: number;
};

function minForMethod(method: PayoutMethod, mins: CpaMinPayoutSettings) {
  if (method === "WISE") return mins.wise;
  if (method === "BANK_TRANSFER") return mins.bankTransfer;
  return mins.stripeConnect;
}

export function lowestCpaMinPayout(mins: CpaMinPayoutSettings) {
  return Math.min(mins.wise, mins.bankTransfer, mins.stripeConnect);
}

export function AdvertiserCpaPayoutRequestForm({
  availableBalance,
  minPayoutSettings,
}: {
  availableBalance: number;
  minPayoutSettings: CpaMinPayoutSettings;
}) {
  const router = useRouter();
  const [method, setMethod] = useState<PayoutMethod>("WISE");
  const minPayoutAmount = minForMethod(method, minPayoutSettings);
  const [amount, setAmount] = useState(
    Math.max(minPayoutAmount, Math.min(availableBalance, minPayoutAmount)),
  );
  const [email, setEmail] = useState("");
  const [bankDetails, setBankDetails] = useState<BankPayoutDetails>(EMPTY_BANK_DETAILS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setAmount((prev) => Math.max(minPayoutAmount, Math.min(availableBalance, prev)));
  }, [minPayoutAmount, availableBalance]);

  const paymentDetails = useMemo(() => {
    if (method === "BANK_TRANSFER") return bankDetails;
    return { email: email.trim() };
  }, [method, email, bankDetails]);

  const canSubmit = availableBalance >= minPayoutAmount && !loading;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/v1/advertiser/cpa-wallet/withdraw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount,
        method,
        paymentDetails,
        idempotencyKey: `cpa-payout-${Date.now()}`,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error?.message ?? "Withdrawal request failed");
      return;
    }

    router.push("/advertiser/cpa-offers/wallet");
    router.refresh();
  }

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[1fr_300px]">
      <PageSection
        title="Payout Details"
        description="Withdraw your available CPA earnings"
        icon={Banknote}
        gradient="revenue"
        contentClassName="p-6"
      >
        <form onSubmit={submit} className="space-y-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
              Available balance
            </p>
            <p className="mt-1 text-2xl font-bold text-emerald-800">
              {formatCurrency(availableBalance)}
            </p>
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="space-y-2">
            <Label>Method</Label>
            <Select value={method} onValueChange={(v) => v && setMethod(v as PayoutMethod)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WISE">Wise</SelectItem>
                <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                <SelectItem value="STRIPE_CONNECT">Stripe</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Amount ($)</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              min={minPayoutAmount}
              max={availableBalance}
              required
              disabled={!canSubmit}
            />
            <p className="text-xs text-muted-foreground">
              Minimum payout for this method: {formatCurrency(minPayoutAmount)}
            </p>
          </div>

          {(method === "WISE" || method === "STRIPE_CONNECT") && (
            <div className="space-y-2">
              <Label>{method === "WISE" ? "Wise email ID" : "Stripe account email"}</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={!canSubmit}
              />
            </div>
          )}

          {method === "BANK_TRANSFER" && (
            <PublisherBankPayoutFields value={bankDetails} onChange={setBankDetails} />
          )}

          <Button
            type="submit"
            className="h-10 w-full rounded-xl bg-[var(--theme-primary)] hover:opacity-90"
            disabled={!canSubmit}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Request Payout"}
          </Button>
        </form>
      </PageSection>

      <div className="premium-card p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--theme-primary-soft)]">
            <Clock className="h-5 w-5 text-[var(--theme-primary)]" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Payout timeline</h3>
            <p className="text-sm text-muted-foreground">What to expect after requesting</p>
          </div>
        </div>
        <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
          <li>1. Your withdrawal request is submitted from your CPA wallet</li>
          <li>2. Our team reviews CPA payouts (1–3 business days)</li>
          <li>3. Approved payouts are processed to your selected method</li>
          <li>4. Track status on your CPA Wallet activity</li>
        </ul>
      </div>
    </div>
  );
}
