"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleAlert, CircleDashed, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { soloRequest } from "@/components/solo-ads/solo-ui";
import type { SoloJobsLastRun } from "@/services/solo-jobs.service";

type Status = "ok" | "missing" | "optional";

const ICONS: Record<Status, React.ReactNode> = {
  ok: <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />,
  missing: <CircleAlert className="h-4 w-4 shrink-0 text-red-600" />,
  optional: <CircleDashed className="h-4 w-4 shrink-0 text-amber-600" />,
};

function Row({ status, label, detail }: { status: Status; label: string; detail: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 py-3">
      <span className="mt-0.5">{ICONS[status]}</span>
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium">{label}</p>
        <div className="text-xs text-muted-foreground">{detail}</div>
      </div>
    </li>
  );
}

function summarize(results: Record<string, unknown> | undefined) {
  if (!results) return null;
  const parts: string[] = [];
  const finalize = results["finalize-clicks"] as { processed?: number; billed?: number; invalid?: number } | undefined;
  if (finalize) parts.push(`${finalize.billed ?? 0} click(s) billed, ${finalize.invalid ?? 0} invalid`);
  const sweep = results["status-sweep"] as Record<string, number> | undefined;
  if (sweep) {
    const changed = Object.values(sweep).reduce((sum, n) => sum + n, 0);
    parts.push(`${changed} campaign status change(s)`);
  }
  const approved = results["approve-conversions"];
  if (typeof approved === "number") parts.push(`${approved} conversion(s) approved`);
  const low = results["low-balance"] as { sent?: number } | undefined;
  if (low) parts.push(`${low.sent ?? 0} low-balance alert(s)`);
  const reconcile = results.reconcile as { walletMismatches?: number; campaignMismatches?: number } | undefined;
  if (reconcile) parts.push(`${(reconcile.walletMismatches ?? 0) + (reconcile.campaignMismatches ?? 0)} ledger mismatch(es)`);
  return parts.join(" · ");
}

export function SoloSetupStatus({
  stripeConfigured,
  webhookConfigured,
  wiseConfigured,
  transferEnabled,
  lastRun: initialLastRun,
}: {
  stripeConfigured: boolean;
  webhookConfigured: boolean;
  wiseConfigured: boolean;
  transferEnabled: boolean;
  lastRun: SoloJobsLastRun | null;
}) {
  const router = useRouter();
  const [lastRun, setLastRun] = useState(initialLastRun);
  const [running, setRunning] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  async function runJobs() {
    setRunning(true);
    try {
      const data = await soloRequest<{ lastRun: SoloJobsLastRun | null }>("/api/v1/admin/solo-ads/jobs", { method: "POST" });
      setLastRun(data.lastRun);
      toast.success(summarize(data.lastRun?.results) || "Solo Ads jobs finished");
      router.refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setRunning(false);
    }
  }

  const jobsStatus: Status = !lastRun ? "optional" : lastRun.ok ? "ok" : "missing";

  return (
    <section className="premium-card space-y-2 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Setup status</h2>
          <p className="text-sm text-muted-foreground">What Solo Ads needs to take payments and bill clicks.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/admin/settings?section=payments" variant="outline" size="sm">
            Open payment settings
          </ButtonLink>
          <Button type="button" size="sm" onClick={runJobs} disabled={running}>
            <Play className="mr-2 h-4 w-4" />
            {running ? "Running..." : "Run jobs now"}
          </Button>
        </div>
      </div>

      <ul className="divide-y divide-border">
        <Row
          status={stripeConfigured ? "ok" : "missing"}
          label={stripeConfigured ? "Stripe keys configured" : "Stripe keys missing"}
          detail={
            stripeConfigured
              ? "Affiliates can fund their Ad Wallet by card."
              : "Card funding is off until publishable and secret keys are saved in payment settings."
          }
        />
        <Row
          status={webhookConfigured ? "ok" : "optional"}
          label={webhookConfigured ? "Stripe webhook secret configured" : "Stripe webhook secret not set (optional)"}
          detail="Deposits work without it. It is needed to record refunds, disputes and payments where the buyer closed the browser early."
        />
        <Row
          status={wiseConfigured ? "ok" : "optional"}
          label={wiseConfigured ? "Wise payments enabled" : "Wise ID not set (optional)"}
          detail={
            <>
              {wiseConfigured
                ? "Affiliates can send money to your Wise ID and submit the reference; you approve it under Wallets."
                : "Add your Wise ID under Settings → Withdraw → Receive payment details to let affiliates pay by Wise."}{" "}
              <Link href="/admin/settings?section=withdraw" className="font-medium text-[var(--theme-primary)] hover:underline">
                Edit Wise ID
              </Link>
            </>
          }
        />
        <Row
          status={transferEnabled ? "ok" : "optional"}
          label={transferEnabled ? "Transfers from earnings enabled" : "Transfers from earnings disabled"}
          detail="Affiliates can move their approved earnings into the ad wallet. Change this under Availability below."
        />
        <Row
          status={jobsStatus}
          label="Scheduled jobs"
          detail={
            <div className="space-y-1">
              {lastRun ? (
                <p suppressHydrationWarning>
                  Last run {new Date(lastRun.at).toLocaleString()} ({lastRun.trigger === "admin" ? "manual" : "cron"}
                  {lastRun.ok ? "" : ", failed"}){lastRun.ok ? ` · ${summarize(lastRun.results) || "nothing to do"}` : ` · ${lastRun.error ?? ""}`}
                </p>
              ) : (
                <p>Never run. Pending clicks are billed only when jobs run.</p>
              )}
              <p>
                For automatic runs, schedule a POST to{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono">{origin}/api/internal/v1/solo-ads/all</code> with the{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono">X-Service-Token</code> header every few minutes.
              </p>
            </div>
          }
        />
      </ul>
    </section>
  );
}
