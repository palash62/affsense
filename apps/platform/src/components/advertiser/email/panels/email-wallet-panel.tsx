"use client";

import { useCallback, useEffect, useState } from "react";
import { Mail, Wallet } from "lucide-react";
import { toast } from "sonner";
import { EmailModuleShell } from "../email-module-shell";
import { formatCurrency } from "@/components/admin/admin-ui";
import {
  GradientStatCard,
  NeutralStatCard,
} from "@/components/admin/gradient-stat-card";
import { PageSection } from "@/components/admin/page-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EmailWalletSnapshot } from "@/modules/email-marketing/services/email-wallet.service";

export function EmailWalletPanel() {
  const [snapshot, setSnapshot] = useState<EmailWalletSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("10");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/advertiser/email/wallet");
      const body = await res.json().catch(() => ({}));
      setSnapshot(body.data ?? null);
    } catch {
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function topUp() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/advertiser/email/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body?.error?.message ?? "Top-up failed");
        return;
      }
      setSnapshot(body.data);
      toast.success("Autoresponder wallet topped up");
    } catch {
      toast.error("Top-up failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <EmailModuleShell
      title="Wallet"
      description="Top up from your main wallet to pay for autoresponder emails."
      breadcrumbs={[
        { label: "Autoresponder", href: "/advertiser/email" },
        { label: "Wallet" },
      ]}
      showToolbar={false}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <GradientStatCard
          label="Autoresponder balance"
          value={loading || !snapshot ? "…" : formatCurrency(snapshot.balance)}
          icon={Wallet}
          variant="revenue"
        />
        <NeutralStatCard
          label="Emails you can send"
          value={
            loading || !snapshot ? "…" : snapshot.emailsRemaining.toLocaleString()
          }
          icon={Mail}
          accent="green"
        />
        <NeutralStatCard
          label="Emails per $1"
          value={loading || !snapshot ? "…" : snapshot.emailsPerDollar.toLocaleString()}
          icon={Mail}
          accent="purple"
        />
        <NeutralStatCard
          label="Main wallet available"
          value={
            loading || !snapshot
              ? "…"
              : formatCurrency(snapshot.mainAvailableBalance)
          }
          icon={Wallet}
          accent="orange"
        />
      </div>

      <PageSection
        title="Top up from main wallet"
        description="Funds move from your CPL wallet into Autoresponder. Cost is charged when each email is sent."
        icon={Wallet}
        gradient="revenue"
        contentClassName="p-6"
      >
        <div className="flex max-w-md flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="topup-amount">Amount (USD)</Label>
            <Input
              id="topup-amount"
              type="number"
              min={1}
              step={0.01}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={submitting}
              className="bg-white"
            />
            {snapshot ? (
              <p className="text-xs text-slate-500">
                ≈{" "}
                {Math.floor(Number(amount || 0) * snapshot.emailsPerDollar).toLocaleString()}{" "}
                emails at current rate · ${snapshot.emailCostUsd.toFixed(4)} / email
              </p>
            ) : null}
          </div>
          <Button
            type="button"
            onClick={() => void topUp()}
            disabled={submitting || loading}
          >
            {submitting ? "Transferring…" : "Top up"}
          </Button>
        </div>
      </PageSection>
    </EmailModuleShell>
  );
}
