"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Banknote, Loader2 } from "lucide-react";
import { formatCurrency } from "@/components/admin/admin-ui";
import { PageSection } from "@/components/admin/page-section";
import {
  EMPTY_BANK_DETAILS,
  PublisherBankPayoutFields,
} from "@/components/publisher/publisher-bank-payout-fields";
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
import { REFERRAL_MIN_PAYOUT } from "@/lib/referral";
import type { BankPayoutDetails } from "@/lib/payout-payment-details";

type PayoutMethod = "WISE" | "BANK_TRANSFER" | "STRIPE_CONNECT";

export function ReferralPayoutRequestForm({
  withdrawableReferral,
  availableBalance,
}: {
  withdrawableReferral: number;
  availableBalance: number;
}) {
  const router = useRouter();
  const [method, setMethod] = useState<PayoutMethod>("WISE");
  const maxAmount = Math.min(withdrawableReferral, availableBalance);
  const [amount, setAmount] = useState(
    Math.max(REFERRAL_MIN_PAYOUT, Math.min(maxAmount, REFERRAL_MIN_PAYOUT)),
  );
  const [email, setEmail] = useState("");
  const [bankDetails, setBankDetails] = useState<BankPayoutDetails>(EMPTY_BANK_DETAILS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setAmount((prev) => Math.max(REFERRAL_MIN_PAYOUT, Math.min(maxAmount, prev)));
  }, [maxAmount]);

  const paymentDetails = useMemo(() => {
    if (method === "BANK_TRANSFER") return bankDetails;
    return { email: email.trim() };
  }, [method, email, bankDetails]);

  const canSubmit = maxAmount >= REFERRAL_MIN_PAYOUT && !loading;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/v1/referral/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount,
        method,
        paymentDetails,
        idempotencyKey: `referral-payout-${Date.now()}`,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error?.message ?? "Request failed");
      return;
    }

    router.refresh();
  }

  return (
    <PageSection
      title="Withdraw Referral Earnings"
      description={`Request a payout when your withdrawable referral balance is at least ${formatCurrency(REFERRAL_MIN_PAYOUT)}`}
      icon={Banknote}
      gradient="approved"
      contentClassName="p-6"
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
              Withdrawable referral
            </p>
            <p className="mt-1 text-2xl font-bold text-emerald-800">
              {formatCurrency(withdrawableReferral)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-muted px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Wallet available
            </p>
            <p className="mt-1 text-2xl font-bold text-foreground">
              {formatCurrency(availableBalance)}
            </p>
          </div>
        </div>

        {maxAmount < REFERRAL_MIN_PAYOUT && (
          <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              You need at least {formatCurrency(REFERRAL_MIN_PAYOUT)} in withdrawable referral
              earnings before requesting a payout.
            </p>
          </div>
        )}

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="space-y-2">
          <Label>Method</Label>
          <Select value={method} onValueChange={(value) => value && setMethod(value as PayoutMethod)}>
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
            min={REFERRAL_MIN_PAYOUT}
            max={maxAmount}
            required
            disabled={!canSubmit}
          />
          <p className="text-xs text-muted-foreground">
            Minimum payout: {formatCurrency(REFERRAL_MIN_PAYOUT)}
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
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Request Referral Payout"}
        </Button>
      </form>
    </PageSection>
  );
}
