"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatPartnerPeriodMonthLabel,
  isValidPeriodMonth,
} from "@/services/partner-payment.service";
import { formatCurrency } from "@/components/admin/admin-ui";

type AdminPartnerPaymentFormProps = {
  defaultPeriodMonth: string;
  /** Owed amounts keyed by YYYY-MM for soft overpay warnings. */
  owedByMonth?: Record<string, number>;
};

export function AdminPartnerPaymentForm({
  defaultPeriodMonth,
  owedByMonth = {},
}: AdminPartnerPaymentFormProps) {
  const router = useRouter();
  const [periodMonth, setPeriodMonth] = useState(defaultPeriodMonth);
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(format(new Date(), "yyyy-MM-dd"));
  const [method, setMethod] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const periodLabel = useMemo(
    () =>
      isValidPeriodMonth(periodMonth)
        ? formatPartnerPeriodMonthLabel(periodMonth)
        : periodMonth || "selected month",
    [periodMonth],
  );

  const owedForMonth = owedByMonth[periodMonth];
  const parsedAmount = Number.parseFloat(amount);
  const overpayWarning =
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    typeof owedForMonth === "number" &&
    owedForMonth >= 0 &&
    parsedAmount > owedForMonth + 0.01;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!isValidPeriodMonth(periodMonth)) {
      setError("Select a valid settlement month");
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Enter a valid amount greater than 0");
      return;
    }

    const confirmLines = [
      `Record ${formatCurrency(parsedAmount)} for ${periodLabel}?`,
      `Paid date: ${paidAt}`,
    ];
    if (overpayWarning) {
      confirmLines.push(
        `Warning: this is more than currently owed for ${periodLabel} (${formatCurrency(owedForMonth)}).`,
      );
    }
    if (!window.confirm(confirmLines.join("\n"))) {
      return;
    }

    setLoading(true);

    const res = await fetch("/api/v1/admin/partner-payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        periodMonth,
        amount: parsedAmount,
        paidAt,
        method: method.trim() || null,
        note: note.trim() || null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);

    if (!res.ok) {
      setError(data?.error?.message ?? "Unable to record partner payment");
      return;
    }

    setAmount("");
    setMethod("");
    setNote("");
    setSuccess(`Partner payment recorded for ${periodLabel}.`);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-[18px] border border-slate-200/80 bg-white p-5 shadow-sm"
    >
      <div>
        <h2 className="text-base font-semibold text-slate-900">Record partner payment</h2>
        <p className="mt-1 text-sm text-slate-500">
          Log a manual payment toward the 20% partner profit share for a calendar month.
          Defaults to the current month.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {success}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="partner-period-month">Month</Label>
          <Input
            id="partner-period-month"
            type="month"
            required
            value={periodMonth}
            onChange={(e) => setPeriodMonth(e.target.value)}
          />
          <p className="text-sm font-medium text-slate-700">Paying for: {periodLabel}</p>
          {typeof owedForMonth === "number" && (
            <p className="text-xs text-slate-500">
              Currently owed for this month: {formatCurrency(owedForMonth)}
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="partner-amount">Amount (USD)</Label>
          <Input
            id="partner-amount"
            type="number"
            min="0.01"
            step="0.01"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="100.00"
          />
          {overpayWarning && (
            <p className="text-xs text-amber-700">
              Amount exceeds owed ({formatCurrency(owedForMonth)}) — this will mark the month
              overpaid.
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="partner-paid-at">Paid date</Label>
          <Input
            id="partner-paid-at"
            type="date"
            required
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="partner-method">Method (optional)</Label>
          <Input
            id="partner-method"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            placeholder="Bank / Wise / Cash"
            maxLength={80}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="partner-note">Note (optional)</Label>
          <Input
            id="partner-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Reference or memo"
            maxLength={2000}
          />
        </div>
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="h-10 rounded-xl bg-[var(--theme-primary)] hover:opacity-90"
      >
        {loading ? "Saving..." : "Record payment"}
      </Button>
    </form>
  );
}
