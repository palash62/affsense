import { notFound } from "next/navigation";
import Link from "next/link";
import { formatUserDateTime } from "@/lib/user-timezone";
import {
  ArrowLeft,
  Building2,
  Calendar,
  Gift,
  Mail,
  Megaphone,
  Users,
  Wallet,
} from "lucide-react";
import { getAdvertiserDetail, getUserDeleteEligibility } from "@/services/admin.service";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHero } from "@/components/admin/page-hero";
import { PageSection } from "@/components/admin/page-section";
import {
  CampaignStatusBadge,
  EmailVerifiedBadge,
  formatCurrency,
  UserStatusBadge,
} from "@/components/admin/admin-ui";
import { UserStatusActions } from "@/components/admin/user-status-actions";
import { AdminLoginAsButton } from "@/components/admin/admin-login-as-button";
import { AdminManualDepositDialog } from "@/components/admin/admin-manual-deposit-dialog";
import { AdminDeleteUserDialog } from "@/components/admin/admin-delete-user-dialog";
import { AdminResendVerificationButton } from "@/components/admin/admin-resend-verification-button";
import { ButtonLink } from "@/components/ui/button-link";
import { formatDepositMethod } from "@/lib/deposit";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminAdvertiserDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getSession();
  const tz = session?.user?.timezone;
  const adminId = session?.user?.id ?? "";

  const [advertiser, activityCounts] = await Promise.all([
    getAdvertiserDetail(id),
    prisma.user.findUnique({
      where: { id },
      select: {
        role: true,
        _count: { select: { campaigns: true, deposits: true } },
      },
    }),
  ]);

  if (!advertiser) {
    notFound();
  }

  const deleteEligibility = getUserDeleteEligibility(
    {
      id: advertiser.id,
      role: activityCounts?.role ?? "ADVERTISER",
      wallet: advertiser.wallet
        ? {
            balance: advertiser.wallet.balance,
            holdBalance: advertiser.wallet.holdBalance,
          }
        : null,
      _count: {
        campaigns: activityCounts?._count.campaigns ?? advertiser._count.campaigns,
        deposits: activityCounts?._count.deposits ?? 0,
      },
    },
    adminId,
  );

  const balance = Number(advertiser.wallet?.balance ?? 0);
  const company = advertiser.advertiserProfile?.company ?? "—";

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center gap-3">
        <ButtonLink href="/admin/advertisers" variant="outline" size="sm" className="h-9 gap-1">
          <ArrowLeft className="h-4 w-4" />
          Back
        </ButtonLink>
      </div>

      <PageHero
        eyebrow="Advertiser Account"
        title={advertiser.name}
        description={advertiser.email}
        badge={company}
      />

      <div className="flex flex-wrap items-center justify-end gap-2">
        {!advertiser.emailVerified && advertiser.status !== "SUSPENDED" && (
          <AdminResendVerificationButton
            userId={advertiser.id}
            userEmail={advertiser.email}
            emailVerified={!!advertiser.emailVerified}
          />
        )}
        <AdminLoginAsButton
          userId={advertiser.id}
          userName={advertiser.name}
          disabled={advertiser.status === "SUSPENDED"}
        />
        <UserStatusActions userId={advertiser.id} currentStatus={advertiser.status} />
        <AdminDeleteUserDialog
          userId={advertiser.id}
          userName={advertiser.name}
          role="ADVERTISER"
          disabledReason={deleteEligibility.reason}
        />
        <AdminManualDepositDialog userId={advertiser.id} userName={advertiser.name} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Wallet balance</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{formatCurrency(balance)}</p>
        </div>
        <div className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Campaigns</p>
          <p className="mt-2 text-2xl font-bold text-slate-900">{advertiser._count.campaigns}</p>
        </div>
        <div className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Status</p>
          <div className="mt-2 flex flex-col gap-1.5">
            <UserStatusBadge status={advertiser.status} />
            <EmailVerifiedBadge verified={!!advertiser.emailVerified} />
          </div>
        </div>
        <div className="rounded-[18px] border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Joined</p>
          <p className="mt-2 text-sm font-semibold text-slate-900">
            {formatUserDateTime(advertiser.createdAt, tz, "MMM d, yyyy")}
          </p>
        </div>
      </div>

      <PageSection title="Profile" description="Advertiser account details" icon={Building2} gradient="revenue">
        <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
          <div className="flex items-start gap-3">
            <Mail className="mt-0.5 h-4 w-4 text-slate-400" />
            <div>
              <p className="text-xs text-slate-500">Email</p>
              <p className="text-sm font-medium text-slate-900">{advertiser.email}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Building2 className="mt-0.5 h-4 w-4 text-slate-400" />
            <div>
              <p className="text-xs text-slate-500">Company</p>
              <p className="text-sm font-medium text-slate-900">{company}</p>
            </div>
          </div>
          {advertiser.advertiserProfile?.industry && (
            <div className="flex items-start gap-3">
              <Calendar className="mt-0.5 h-4 w-4 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Industry</p>
                <p className="text-sm font-medium text-slate-900">
                  {advertiser.advertiserProfile.industry}
                </p>
              </div>
            </div>
          )}
          <div className="flex items-start gap-3">
            <Gift className="mt-0.5 h-4 w-4 text-slate-400" />
            <div>
              <p className="text-xs text-slate-500">Referral code</p>
              <p className="text-sm font-medium text-slate-900">
                {advertiser.referralCode ?? "—"}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Users className="mt-0.5 h-4 w-4 text-slate-400" />
            <div>
              <p className="text-xs text-slate-500">Referred by</p>
              {advertiser.referredBy ? (
                <div>
                  <Link
                    href={`/admin/advertisers/${advertiser.referredBy.id}`}
                    className="text-sm font-medium text-slate-900 hover:underline"
                  >
                    {advertiser.referredBy.name}
                  </Link>
                  <p className="text-xs text-slate-500">{advertiser.referredBy.email}</p>
                  {advertiser.referredBy.referralCode && (
                    <p className="text-xs text-slate-400">
                      Code: {advertiser.referredBy.referralCode}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm font-medium text-slate-900">—</p>
              )}
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Megaphone className="mt-0.5 h-4 w-4 text-slate-400" />
            <div>
              <p className="text-xs text-slate-500">UTM</p>
              <div className="mt-0.5 space-y-0.5 text-sm text-slate-600">
                <p>source: {advertiser.signupUtmSource ?? "—"}</p>
                <p>medium: {advertiser.signupUtmMedium ?? "—"}</p>
                <p>campaign: {advertiser.signupUtmCampaign ?? "—"}</p>
                <p>content: {advertiser.signupUtmContent ?? "—"}</p>
                <p>term: {advertiser.signupUtmTerm ?? "—"}</p>
              </div>
            </div>
          </div>
        </div>
      </PageSection>

      <Tabs defaultValue="campaigns">
        <TabsList>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="wallet">Wallet & deposits</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="mt-4">
          <PageSection
            title="Campaigns"
            description={`${advertiser.campaigns.length} recent campaign(s)`}
            icon={Megaphone}
            gradient="approved"
          >
            {advertiser.campaigns.length === 0 ? (
              <p className="px-6 py-8 text-sm text-slate-500">No campaigns yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-6">Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">CPL</TableHead>
                    <TableHead className="text-center">Leads</TableHead>
                    <TableHead className="text-right">Spent</TableHead>
                    <TableHead className="px-6 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {advertiser.campaigns.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="px-6 font-medium">{c.name}</TableCell>
                      <TableCell>
                        <CampaignStatusBadge status={c.status} />
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(c.cpl))}</TableCell>
                      <TableCell className="text-center">{c._count.leads}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(c.spent))}</TableCell>
                      <TableCell className="px-6 text-right">
                        <ButtonLink
                          href={`/admin/campaigns/${c.id}`}
                          variant="outline"
                          size="sm"
                          className="h-8"
                        >
                          View
                        </ButtonLink>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </PageSection>
        </TabsContent>

        <TabsContent value="wallet" className="mt-4">
          <PageSection
            title="Deposit history"
            description="Wise, card, and manual admin deposits"
            icon={Wallet}
            gradient="revenue"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <p className="text-sm text-slate-600">
                Current balance:{" "}
                <span className="font-semibold text-emerald-600">{formatCurrency(balance)}</span>
              </p>
              <AdminManualDepositDialog userId={advertiser.id} userName={advertiser.name} />
            </div>
            {advertiser.deposits.length === 0 ? (
              <p className="px-6 py-8 text-sm text-slate-500">No deposits recorded.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-6">Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {advertiser.deposits.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="px-6 text-sm text-slate-600">
                        {formatUserDateTime(d.createdAt, tz, "MMM d, yyyy HH:mm")}
                      </TableCell>
                      <TableCell>{formatDepositMethod(d.method)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(Number(d.amount))}
                      </TableCell>
                      <TableCell className="capitalize text-sm">{d.status.toLowerCase()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </PageSection>
        </TabsContent>
      </Tabs>
    </div>
  );
}
