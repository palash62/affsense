import { notFound } from "next/navigation";
import { formatUserDateTime } from "@/lib/user-timezone";
import { getSession } from "@/lib/session";
import { ArrowLeft, Globe, Mail, MapPin, Share2, ShieldAlert, Wallet } from "lucide-react";
import { getPublisherDetail } from "@/services/admin.service";
import { getPublisherSpamScoresByIds } from "@/modules/fraud/repositories/quality.repo";
import { TIER_PAYOUT_ROWS } from "@/lib/platform-settings";
import { PageHero } from "@/components/admin/page-hero";
import { PageSection } from "@/components/admin/page-section";
import {
  formatCurrency,
  KycStatusBadge,
  SpamScoreBadge,
  UserStatusBadge,
} from "@/components/admin/admin-ui";
import { AdminLoginAsButton } from "@/components/admin/admin-login-as-button";
import { AdminPublisherSpecialPayoutDialog } from "@/components/admin/admin-publisher-special-payout-dialog";
import { UserStatusActions } from "@/components/admin/user-status-actions";
import { ButtonLink } from "@/components/ui/button-link";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminPublisherDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getSession();
  const tz = session?.user?.timezone;
  const publisher = await getPublisherDetail(id);

  if (!publisher) {
    notFound();
  }

  const spamScores = await getPublisherSpamScoresByIds([publisher.id]);
  const spamScore =
    spamScores.get(publisher.id) ?? publisher.publisherProfile?.spamScore ?? null;
  const profile = publisher.publisherProfile;
  const balance = Number(publisher.wallet?.balance ?? 0);

  const payoutSettings = {
    useSpecialTierPayouts: profile?.useSpecialTierPayouts ?? false,
    tier1SpecialPayout: profile?.tier1SpecialPayout ?? null,
    tier2SpecialPayout: profile?.tier2SpecialPayout ?? null,
    tier3SpecialPayout: profile?.tier3SpecialPayout ?? null,
  };

  const tierRows = [
    { label: TIER_PAYOUT_ROWS[0].label, value: payoutSettings.tier1SpecialPayout },
    { label: TIER_PAYOUT_ROWS[1].label, value: payoutSettings.tier2SpecialPayout },
    { label: TIER_PAYOUT_ROWS[2].label, value: payoutSettings.tier3SpecialPayout },
  ];

  return (
    <div className="space-y-7">
      <ButtonLink href="/admin/publishers" variant="outline" size="sm" className="h-9 gap-1">
        <ArrowLeft className="h-4 w-4" />
        Back to publishers
      </ButtonLink>

      <PageHero
        eyebrow="Publisher Account"
        title={publisher.name}
        description={publisher.email}
        badge={profile?.kycStatus?.replace(/_/g, " ") ?? "Publisher"}
      />

      <div className="flex flex-wrap items-center justify-end gap-2">
        <AdminPublisherSpecialPayoutDialog
          publisherId={publisher.id}
          publisherName={publisher.name}
          settings={payoutSettings}
        />
        <AdminLoginAsButton
          userId={publisher.id}
          userName={publisher.name}
          disabled={publisher.status === "SUSPENDED"}
        />
        <UserStatusActions userId={publisher.id} currentStatus={publisher.status} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[18px] border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Wallet balance</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{formatCurrency(balance)}</p>
        </div>
        <div className="rounded-[18px] border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Leads</p>
          <p className="mt-2 text-2xl font-bold text-foreground">{publisher._count.leads}</p>
        </div>
        <div className="rounded-[18px] border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</p>
          <div className="mt-2">
            <UserStatusBadge status={publisher.status} />
          </div>
        </div>
        <div className="rounded-[18px] border border-border bg-card p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Joined</p>
          <p className="mt-2 text-sm font-semibold text-foreground">
            {formatUserDateTime(publisher.createdAt, tz, "MMM d, yyyy")}
          </p>
        </div>
      </div>

      <PageSection title="Profile" description="Publisher account details" icon={Share2} gradient="leads">
        <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm font-medium text-foreground">{publisher.email}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">KYC status</p>
              <div className="mt-1">
                {profile ? <KycStatusBadge status={profile.kycStatus} /> : <span>—</span>}
              </div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Spam score</p>
              <div className="mt-1">
                <SpamScoreBadge score={spamScore} />
              </div>
            </div>
          </div>
          {profile?.website && (
            <div className="flex items-start gap-3">
              <Globe className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Website</p>
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-[var(--theme-primary)] hover:underline"
                >
                  {profile.website}
                </a>
              </div>
            </div>
          )}
          {profile?.trafficSource && (
            <div className="flex items-start gap-3">
              <Share2 className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Traffic source</p>
                <p className="text-sm font-medium text-foreground">{profile.trafficSource}</p>
              </div>
            </div>
          )}
          {profile?.country && (
            <div className="flex items-start gap-3">
              <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Country</p>
                <p className="text-sm font-medium text-foreground">{profile.country}</p>
              </div>
            </div>
          )}
        </div>
      </PageSection>

      <PageSection
        title="Special tier payouts"
        description="Minimum publisher payout per country tier for Smart Link rotation"
        icon={Wallet}
        gradient="revenue"
      >
        <div className="px-6 py-5">
          {payoutSettings.useSpecialTierPayouts ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {tierRows.map((row) => (
                <div
                  key={row.label}
                  className="rounded-xl border border-border bg-muted/60 px-4 py-3"
                >
                  <p className="text-xs text-muted-foreground">{row.label}</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    {row.value != null ? formatCurrency(row.value) : "—"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Min per lead</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No special tier payouts. All eligible active campaigns can rotate in Smart Link.
            </p>
          )}
        </div>
      </PageSection>
    </div>
  );
}
