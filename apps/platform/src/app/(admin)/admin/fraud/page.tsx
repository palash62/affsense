import { formatUserDateTime } from "@/lib/user-timezone";
import { getSession } from "@/lib/session";
import { ShieldAlert, Ban, Settings } from "lucide-react";
import { getFraudDashboardMetrics, listHighRiskLeads } from "@/modules/fraud";
import { PageHero } from "@/components/admin/page-hero";
import { PageSection } from "@/components/admin/page-section";
import { GradientStatCard, NeutralStatCard } from "@/components/admin/gradient-stat-card";
import { FraudSettingsForm } from "@/components/fraud/fraud-settings-form";
import { BlocklistManager } from "@/components/fraud/blocklist-manager";
import { FraudLeadActions } from "@/components/fraud/fraud-lead-actions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function AdminFraudPage() {
  const session = await getSession();
  const tz = session?.user?.timezone;
  const [metrics, leadsResult] = await Promise.all([
    getFraudDashboardMetrics(),
    listHighRiskLeads(1, 25),
  ]);

  const leads = leadsResult.data.map((lead) => ({
    ...lead,
    createdAt: lead.createdAt.toISOString(),
    validationResults: lead.validationResults.map((r) => ({
      ...r,
      riskDelta: r.riskDelta ?? null,
      details: r.details ?? null,
    })),
  }));

  return (
    <div className="space-y-7">
      <PageHero
        eyebrow="Fraud Center"
        title="Lead Fraud Detection"
        description="Monitor risk signals, manage blocklists, and tune fraud thresholds"
        badge={`${metrics.blockedIps} blocked IPs`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <GradientStatCard variant="leads" label="Duplicate Flags" value={metrics.duplicateLeads} icon={ShieldAlert} />
        <NeutralStatCard label="VPN / Proxy" value={metrics.vpnLeads} icon={ShieldAlert} accent="orange" />
        <NeutralStatCard label="Disposable Emails" value={metrics.disposableEmails} icon={ShieldAlert} accent="red" />
        <NeutralStatCard label="Avg Risk Score" value={`${metrics.spamScoreAvg}%`} icon={ShieldAlert} accent="orange" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <NeutralStatCard label="High Risk Leads" value={metrics.highRiskDevices} icon={ShieldAlert} accent="red" />
        <NeutralStatCard label="Suspicious Publishers" value={metrics.suspiciousPublishers} icon={ShieldAlert} accent="orange" />
        <NeutralStatCard label="Rejected Leads" value={metrics.rejectedLeads} icon={Ban} accent="red" />
      </div>

      <PageSection
        title="High-Risk Lead Queue"
        description="Leads with risk score ≥ 21 — review validation breakdown and approve or reject"
        icon={ShieldAlert}
        gradient="leads"
      >
        {leads.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No high-risk leads in the queue.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-none hover:bg-transparent" style={{ background: "var(--theme-primary-soft)" }}>
                <TableHead className="h-11 px-6 text-muted-foreground">Submitted</TableHead>
                <TableHead className="h-11 px-4 text-muted-foreground">Campaign</TableHead>
                <TableHead className="h-11 px-4 text-muted-foreground">Publisher</TableHead>
                <TableHead className="h-11 px-4 text-muted-foreground">Review</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => (
                <TableRow key={lead.id} className="border-border align-top hover:bg-violet-50/40">
                  <TableCell className="px-6 py-4 text-sm text-muted-foreground">
                    {formatUserDateTime(lead.createdAt, tz, "MMM d, yyyy HH:mm")}
                  </TableCell>
                  <TableCell className="px-4 py-4 text-sm font-medium text-foreground">
                    {lead.campaign.name}
                  </TableCell>
                  <TableCell className="px-4 py-4 text-sm text-foreground">
                    {lead.publisher.name}
                  </TableCell>
                  <TableCell className="px-4 py-4">
                    <FraudLeadActions lead={lead} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </PageSection>

      <PageSection
        title="IP Blocklist"
        description="Block known bad IPs before leads are accepted"
        icon={Ban}
        gradient="revenue"
      >
        <div className="p-6">
          <BlocklistManager />
        </div>
      </PageSection>

      <PageSection
        title="Fraud Settings"
        description="Thresholds, shadow mode, and provider status"
        icon={Settings}
        gradient="revenue"
      >
        <div className="p-6">
          <FraudSettingsForm />
        </div>
      </PageSection>
    </div>
  );
}
