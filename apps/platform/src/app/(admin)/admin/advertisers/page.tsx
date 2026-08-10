import { Suspense } from "react";
import { formatUserDateTime } from "@/lib/user-timezone";
import { Building2, Mail, Megaphone, UserCheck, Users, Wallet } from "lucide-react";
import type { UserStatus } from "@prisma/client";
import { listUsers, getUserDeleteEligibility } from "@/services/admin.service";
import { getSession } from "@/lib/session";
import { PageHero } from "@/components/admin/page-hero";
import { PageSection } from "@/components/admin/page-section";
import { GradientStatCard, NeutralStatCard } from "@/components/admin/gradient-stat-card";
import {
  avatarColors,
  EmailVerifiedBadge,
  formatCurrency,
  getInitials,
  UserStatusBadge,
} from "@/components/admin/admin-ui";
import { UsersTableFilters } from "@/components/admin/users-table-filters";
import { UserStatusActions } from "@/components/admin/user-status-actions";
import { AdminLoginAsButton } from "@/components/admin/admin-login-as-button";
import { AdminCreateAdvertiserDialog } from "@/components/admin/admin-create-advertiser-dialog";
import { AdminDeleteUserDialog } from "@/components/admin/admin-delete-user-dialog";
import { AdminResendVerificationButton } from "@/components/admin/admin-resend-verification-button";
import { ButtonLink } from "@/components/ui/button-link";
import { Eye } from "lucide-react";
import { UsersTablePagination } from "@/components/admin/users-table-pagination";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    status?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}

export default async function AdminAdvertisersPage({ searchParams }: PageProps) {
  const session = await getSession();
  const tz = session?.user?.timezone;
  const adminId = session?.user?.id ?? "";
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));

  const [{ data: advertisers, meta }, { data: allAdvertisers }] = await Promise.all([
    listUsers({
      role: "ADVERTISER",
      search: params.q,
      status: params.status as UserStatus | undefined,
      dateFrom: params.from ? new Date(params.from) : undefined,
      dateTo: params.to ? new Date(params.to) : undefined,
      page,
      limit: 20,
    }),
    listUsers({ role: "ADVERTISER", limit: 500 }),
  ]);

  const activeCount = allAdvertisers.filter((u) => u.status === "ACTIVE").length;
  const totalBalance = allAdvertisers.reduce(
    (sum, u) => sum + Number(u.wallet?.balance ?? 0),
    0,
  );
  const totalCampaigns = allAdvertisers.reduce((sum, u) => sum + u._count.campaigns, 0);

  const hasFilters = !!(params.q || params.status || params.from || params.to);

  return (
    <div className="space-y-7">
      <PageHero
        eyebrow="User Management"
        title="Advertisers"
        description="Manage advertiser accounts, wallet balances, and account status"
        badge={`${meta.total} total account${meta.total === 1 ? "" : "s"}`}
      />

      <div className="flex flex-wrap items-center justify-end gap-3">
        <AdminCreateAdvertiserDialog />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <GradientStatCard variant="revenue" label="Combined Wallet Balance" value={formatCurrency(totalBalance)} icon={Wallet} />
        <NeutralStatCard label="Total Advertisers" value={allAdvertisers.length} icon={Users} accent="purple" />
        <NeutralStatCard label="Active Accounts" value={activeCount} icon={UserCheck} accent="green" />
        <NeutralStatCard label="Total Campaigns" value={totalCampaigns} icon={Megaphone} accent="orange" />
      </div>

      <PageSection
        title="Advertiser Accounts"
        description={
          hasFilters
            ? `Showing ${advertisers.length} filtered result${advertisers.length === 1 ? "" : "s"}`
            : "View and manage advertiser accounts. New signups activate automatically after email verification."
        }
        icon={Building2}
        gradient="revenue"
      >
        <Suspense fallback={<div className="px-6 py-4 text-sm text-muted-foreground">Loading filters...</div>}>
          <UsersTableFilters />
        </Suspense>

        {advertisers.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "var(--theme-primary-soft)" }}>
              <Building2 className="h-7 w-7 text-[var(--theme-primary)]" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              {hasFilters ? "No matching advertisers" : "No advertisers yet"}
            </h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {hasFilters
                ? "Try adjusting your search or filter criteria."
                : "Advertiser accounts will appear here once users register with the advertiser role."}
            </p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="border-none hover:bg-transparent" style={{ background: "var(--theme-primary-soft)" }}>
                  <TableHead className="h-11 px-6 text-muted-foreground">Advertiser</TableHead>
                  <TableHead className="h-11 px-4 text-muted-foreground">Company</TableHead>
                  <TableHead className="h-11 px-4 text-center text-muted-foreground">Campaigns</TableHead>
                  <TableHead className="h-11 px-4 text-right text-muted-foreground">Wallet</TableHead>
                  <TableHead className="h-11 px-4 text-muted-foreground">Status</TableHead>
                  <TableHead className="h-11 px-4 text-muted-foreground">Joined</TableHead>
                  <TableHead className="h-11 px-6 text-right text-muted-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {advertisers.map((advertiser, index) => {
                  const balance = Number(advertiser.wallet?.balance ?? 0);
                  const deleteEligibility = getUserDeleteEligibility(
                    {
                      id: advertiser.id,
                      role: advertiser.role,
                      wallet: advertiser.wallet,
                      _count: advertiser._count,
                    },
                    adminId,
                  );
                  return (
                    <TableRow key={advertiser.id} className="border-border transition-colors hover:bg-blue-50/40">
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar size="lg">
                            <AvatarFallback className={cn("text-sm font-semibold", avatarColors[index % avatarColors.length])}>
                              {getInitials(advertiser.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{advertiser.name}</p>
                            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                              <Mail className="h-3 w-3 shrink-0 text-[var(--theme-primary)]" />
                              {advertiser.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
                          <span className="text-sm text-foreground">
                            {advertiser.advertiserProfile?.company ?? "—"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-4 text-center">
                        <span className="inline-flex min-w-8 items-center justify-center rounded-md bg-indigo-50 px-2.5 py-1 text-sm font-semibold text-indigo-700">
                          {advertiser._count.campaigns}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-4 text-right">
                        <span className={cn("text-sm font-semibold tabular-nums", balance > 0 ? "text-emerald-600" : "text-muted-foreground")}>
                          {formatCurrency(balance)}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col gap-1.5">
                            <UserStatusBadge status={advertiser.status} />
                            <EmailVerifiedBadge verified={!!advertiser.emailVerified} />
                            {advertiser.status === "PENDING" && !advertiser.emailVerified && (
                              <span className="text-xs text-amber-700">Awaiting email verification</span>
                            )}
                          </div>
                          {!advertiser.emailVerified && advertiser.status !== "SUSPENDED" && (
                            <AdminResendVerificationButton
                              userId={advertiser.id}
                              userEmail={advertiser.email}
                              emailVerified={!!advertiser.emailVerified}
                            />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-4 text-sm text-muted-foreground">
                        {formatUserDateTime(advertiser.createdAt, tz, "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <ButtonLink
                            href={`/admin/advertisers/${advertiser.id}`}
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </ButtonLink>
                          <AdminLoginAsButton
                            userId={advertiser.id}
                            userName={advertiser.name}
                            disabled={advertiser.status !== "ACTIVE"}
                          />
                          {!(advertiser.status === "PENDING" && !advertiser.emailVerified) && (
                            <UserStatusActions userId={advertiser.id} currentStatus={advertiser.status} />
                          )}
                          <AdminDeleteUserDialog
                            userId={advertiser.id}
                            userName={advertiser.name}
                            role="ADVERTISER"
                            disabledReason={deleteEligibility.reason}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <Suspense>
              <UsersTablePagination page={meta.page} totalPages={meta.totalPages} total={meta.total} />
            </Suspense>
          </>
        )}
      </PageSection>
    </div>
  );
}
