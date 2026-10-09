import { loadSoloAdsConfig } from "@cpl/tracking-core";
import { SoloAdminShell } from "@/components/solo-ads/admin/solo-admin-shell";
import { SoloSettingsForm } from "@/components/solo-ads/admin/solo-settings-form";
import { SoloSetupStatus } from "@/components/solo-ads/admin/solo-setup-status";
import { listBetaPublishers } from "@/services/solo-admin.service";
import { getSoloJobsLastRun } from "@/services/solo-jobs.service";
import { getAdminWiseReceiveId } from "@/services/solo-wallet.service";
import { getResolvedStripeConfig } from "@/services/stripe-settings.service";

export const dynamic = "force-dynamic";

export default async function AdminSoloAdsSettingsPage() {
  const [config, stripe, lastRun, wiseId] = await Promise.all([
    loadSoloAdsConfig(),
    getResolvedStripeConfig(),
    getSoloJobsLastRun(),
    getAdminWiseReceiveId(),
  ]);
  const betaPublishers = await listBetaPublishers(config.betaPublisherIds);
  return (
    <SoloAdminShell title="Settings" description="Pricing, budgets, targeting and traffic quality rules for Solo Ads.">
      <div className="space-y-6">
        <SoloSetupStatus
          stripeConfigured={stripe.enabled}
          webhookConfigured={Boolean(stripe.webhookSecret)}
          wiseConfigured={Boolean(wiseId)}
          transferEnabled={config.transferEnabled}
          lastRun={lastRun}
        />
        <SoloSettingsForm initial={config} betaPublishers={betaPublishers} />
      </div>
    </SoloAdminShell>
  );
}
