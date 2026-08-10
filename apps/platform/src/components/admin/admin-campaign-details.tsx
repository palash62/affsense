import { formatUserDateTime } from "@/lib/user-timezone";
import Link from "next/link";
import {
  Building2,
  CalendarClock,
  Crosshair,
  FileText,
  Globe,
  Megaphone,
  Target,
  Users,
} from "lucide-react";
import type { CampaignCategory, CampaignStatus } from "@prisma/client";
import { PageSection } from "@/components/admin/page-section";
import { formatCurrency } from "@/components/admin/admin-ui";
import { CampaignStatusWithPauseReason } from "@/components/advertiser/campaign-status-with-pause-reason";
import { Badge } from "@/components/ui/badge";
import { CampaignTrackingPixelPanel } from "@/components/advertiser/campaign-tracking-pixel-panel";
import { SHOW_CAMPAIGN_TRACKING_PIXEL_UI } from "@/lib/campaign-pixel-ui";
import {
  formatCampaignScheduling,
  formatCountryList,
  formatListOrAll,
  parseCampaignTargeting,
} from "@/lib/campaign-targeting";

type CampaignField = {
  fieldName: string;
  label: string;
  fieldType: string;
  required: boolean;
};

type PublisherJoin = {
  status: string;
  approvedAt: Date | null;
  publisher: { id: string; name: string; email: string };
};

export type AdminCampaignDetailsProps = {
  campaign: {
    id: string;
    name: string;
    description: string | null;
    category: CampaignCategory;
    cpl: number;
    budget: number | null;
    spent: number;
    dailyCap: number | null;
    monthlyCap: number | null;
    status: CampaignStatus;
    pausedReason?: string | null;
    targeting: unknown;
    pixelToken: string | null;
    rejectionReason: string | null;
    rejectedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    advertiser: { id: string; name: string; email: string };
    fields: CampaignField[];
    publisherCampaigns?: PublisherJoin[];
    leadCount: number;
  };
};

function DetailCell({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-0.5 text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

export function AdminCampaignDetails({
  campaign,
  timezone,
}: AdminCampaignDetailsProps & { timezone?: string }) {
  const targeting = parseCampaignTargeting(campaign.targeting);
  const optinHref = targeting.optinSlug ? `/o/${targeting.optinSlug}` : null;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[18px] border border-border bg-card p-5 shadow-sm">
          <p className="text-xs text-muted-foreground">CPL bid</p>
          <p className="mt-1 text-xl font-bold text-[var(--theme-primary)]">
            {formatCurrency(campaign.cpl)}
          </p>
        </div>
        <div className="rounded-[18px] border border-border bg-card p-5 shadow-sm">
          <p className="text-xs text-muted-foreground">Budget / spent</p>
          <p className="mt-1 text-xl font-bold text-foreground">
            {formatCurrency(campaign.spent)} /{" "}
            {campaign.budget == null ? "Unlimited" : formatCurrency(campaign.budget)}
          </p>
        </div>
        <div className="rounded-[18px] border border-border bg-card p-5 shadow-sm">
          <p className="text-xs text-muted-foreground">Leads</p>
          <p className="mt-1 text-xl font-bold text-foreground">{campaign.leadCount}</p>
        </div>
        <div className="rounded-[18px] border border-border bg-card p-5 shadow-sm">
          <p className="text-xs text-muted-foreground">Status</p>
          <div className="mt-2">
            <CampaignStatusWithPauseReason
              status={campaign.status}
              pausedReason={campaign.pausedReason}
            />
          </div>
        </div>
      </div>

      <PageSection title="Basic campaign settings" icon={Megaphone} gradient="approved">
        <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
          <DetailCell label="Campaign name" value={campaign.name} className="sm:col-span-2" />
          <DetailCell label="Advertiser" value={campaign.advertiser.name} />
          <DetailCell label="Advertiser email" value={campaign.advertiser.email} />
          <DetailCell
            label="Advertiser profile"
            value={
              <Link
                href={`/admin/advertisers/${campaign.advertiser.id}`}
                className="text-[var(--theme-primary)] hover:underline"
              >
                View advertiser
              </Link>
            }
          />
          <DetailCell label="Category" value={campaign.category.replace(/_/g, " ")} />
          <DetailCell
            label="Created"
            value={formatUserDateTime(campaign.createdAt, timezone, "MMM d, yyyy 'at' h:mm a")}
          />
          <DetailCell
            label="Last updated"
            value={formatUserDateTime(campaign.updatedAt, timezone, "MMM d, yyyy 'at' h:mm a")}
          />
          {campaign.description && (
            <DetailCell
              label="Description"
              value={<span className="font-normal text-foreground">{campaign.description}</span>}
              className="sm:col-span-2"
            />
          )}
        </div>
      </PageSection>

      <PageSection title="Budget & caps" icon={Building2} gradient="revenue">
        <div className="grid gap-4 px-6 py-5 sm:grid-cols-2 lg:grid-cols-4">
          <DetailCell label="CPL bid" value={formatCurrency(campaign.cpl)} />
          <DetailCell
            label="Total budget"
            value={campaign.budget == null ? "Unlimited" : formatCurrency(campaign.budget)}
          />
          <DetailCell label="Spent" value={formatCurrency(campaign.spent)} />
          <DetailCell
            label="Remaining"
            value={
              campaign.budget == null
                ? "—"
                : formatCurrency(Math.max(0, campaign.budget - campaign.spent))
            }
          />
          <DetailCell label="Daily budget" value={campaign.dailyCap ?? "Unlimited"} />
          <DetailCell label="Monthly cap" value={campaign.monthlyCap ?? "Unlimited"} />
        </div>
      </PageSection>

      <PageSection title="Publisher settings" icon={Users} gradient="leads">
        <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
          <DetailCell
            label="Status"
            value={
              <CampaignStatusWithPauseReason
                status={campaign.status}
                pausedReason={campaign.pausedReason}
              />
            }
          />
          <DetailCell
            label="Blacklisted publishers"
            value={
              targeting.excludeBlockedPublishers
                ? "Don't allow blacklisted publishers"
                : "Allow all publishers"
            }
          />
        </div>
      </PageSection>

      <PageSection title="Targeting & scheduling" icon={Target} gradient="approved">
        <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
          <DetailCell label="Vertical" value={targeting.vertical ?? "—"} />
          <DetailCell
            label="Traffic mode"
            value={targeting.trafficMode === "block" ? "Block list" : "Allow list"}
          />
          <DetailCell
            label="Schedule"
            value={formatCampaignScheduling(targeting)}
            className="sm:col-span-2"
          />
          {targeting.trafficMode === "allow" ? (
            <>
              <DetailCell
                label="Countries"
                value={formatCountryList(targeting.countries)}
                className="sm:col-span-2"
              />
              <DetailCell
                label="Devices"
                value={formatListOrAll(targeting.devices, "All devices")}
              />
              <DetailCell
                label="Operating systems"
                value={formatListOrAll(targeting.operatingSystems, "All OS")}
              />
            </>
          ) : (
            <>
              <DetailCell
                label="Blocked countries"
                value={formatCountryList(targeting.blacklistedCountries)}
                className="sm:col-span-2"
              />
              <DetailCell
                label="Blocked devices"
                value={formatListOrAll(targeting.blacklistedDevices, "None")}
              />
              <DetailCell
                label="Blocked operating systems"
                value={formatListOrAll(targeting.blacklistedOperatingSystems, "None")}
              />
            </>
          )}
        </div>
      </PageSection>

      <PageSection title="Optin & destination" icon={Globe} gradient="revenue">
        <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
          <DetailCell
            label="Optin page"
            value={
              optinHref ? (
                <a
                  href={optinHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--theme-primary)] hover:underline"
                >
                  {targeting.optinSlug ? `/o/${targeting.optinSlug}` : "View page"}
                </a>
              ) : (
                "—"
              )
            }
          />
          <DetailCell
            label="Destination URL"
            value={
              targeting.destinationUrl ? (
                <a
                  href={targeting.destinationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all font-normal text-[var(--theme-primary)] hover:underline"
                >
                  {targeting.destinationUrl}
                </a>
              ) : (
                "—"
              )
            }
            className="sm:col-span-2"
          />
        </div>
      </PageSection>

      {campaign.fields.length > 0 && (
        <PageSection title="Lead fields" icon={FileText} gradient="leads">
          <div className="px-6 py-5">
            <div className="flex flex-wrap gap-2">
              {campaign.fields.map((field) => (
                <Badge key={field.fieldName} variant="outline" className="gap-1.5 py-1.5">
                  <span>{field.label}</span>
                  {field.required && <span className="text-red-500">*</span>}
                  <span className="text-xs font-normal text-muted-foreground">({field.fieldType})</span>
                </Badge>
              ))}
            </div>
          </div>
        </PageSection>
      )}

      {SHOW_CAMPAIGN_TRACKING_PIXEL_UI && campaign.pixelToken && (
        <PageSection title="Tracking pixel" icon={Crosshair} gradient="approved">
          <div className="px-6 py-5">
            <CampaignTrackingPixelPanel pixelToken={campaign.pixelToken} />
          </div>
        </PageSection>
      )}

      {campaign.publisherCampaigns && campaign.publisherCampaigns.length > 0 && (
        <PageSection title="Publishers" icon={Users} gradient="revenue">
          <div className="divide-y divide-slate-100 px-6">
            {campaign.publisherCampaigns.map((join) => (
              <div
                key={join.publisher.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{join.publisher.name}</p>
                  <p className="text-xs text-muted-foreground">{join.publisher.email}</p>
                </div>
                <div className="text-right">
                  <Badge variant="outline" className="capitalize">
                    {join.status.toLowerCase()}
                  </Badge>
                  {join.approvedAt && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Approved {formatUserDateTime(join.approvedAt, timezone, "MMM d, yyyy")}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </PageSection>
      )}

      {campaign.rejectionReason && (
        <PageSection title="Rejection" icon={CalendarClock} gradient="leads">
          <div className="px-6 py-5">
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {campaign.rejectionReason}
              {campaign.rejectedAt && (
                <span className="mt-2 block text-xs text-red-600/80">
                  Rejected {formatUserDateTime(campaign.rejectedAt, timezone, "MMM d, yyyy 'at' h:mm a")}
                </span>
              )}
            </p>
          </div>
        </PageSection>
      )}
    </>
  );
}
