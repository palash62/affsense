import { loadSoloAdsConfig } from "@cpl/tracking-core";
import { SoloAdminShell } from "@/components/solo-ads/admin/solo-admin-shell";
import { SoloSettingsForm } from "@/components/solo-ads/admin/solo-settings-form";
import { listBetaPublishers } from "@/services/solo-admin.service";

export const dynamic = "force-dynamic";

export default async function AdminSoloAdsSettingsPage() {
  const config = await loadSoloAdsConfig();
  const betaPublishers = await listBetaPublishers(config.betaPublisherIds);
  return (
    <SoloAdminShell title="Settings" description="Pricing, budgets, targeting and traffic quality rules for Solo Ads.">
      <SoloSettingsForm initial={config} betaPublishers={betaPublishers} />
    </SoloAdminShell>
  );
}
