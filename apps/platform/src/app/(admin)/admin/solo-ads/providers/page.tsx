import { SoloAdminShell } from "@/components/solo-ads/admin/solo-admin-shell";
import { SoloProvidersManager, type AdminSoloProvider } from "@/components/solo-ads/admin/solo-providers-manager";
import { listSoloProviders, soloRouterUrl } from "@/services/solo-admin.service";

export const dynamic = "force-dynamic";

export default async function AdminSoloAdsProvidersPage() {
  const providers = await listSoloProviders();
  const rows: AdminSoloProvider[] = providers.map((p) => ({
    id: p.id,
    publicCode: p.publicCode,
    realName: p.realName,
    contact: p.contact,
    trafficClass: p.trafficClass,
    status: p.status,
    geoRules: Array.isArray(p.geoRules) ? (p.geoRules as string[]) : [],
    dailyCapacity: p.dailyCapacity,
    notes: p.notes,
    clicksToday: p.clicksToday,
    last30: p.last30,
    tokens: p.tokens.map((t) => ({
      id: t.id,
      prefix: t.prefix,
      trafficType: t.trafficType,
      status: t.status,
      createdAt: t.createdAt.toISOString(),
      lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
    })),
  }));
  return (
    <SoloAdminShell
      title="Providers"
      description="Traffic providers, their capacity and secret delivery links. Affiliates only ever see the provider number."
    >
      <SoloProvidersManager
        providers={rows}
        masterUrls={{ regular: soloRouterUrl("REGULAR"), warm: soloRouterUrl("WARM") }}
      />
    </SoloAdminShell>
  );
}
