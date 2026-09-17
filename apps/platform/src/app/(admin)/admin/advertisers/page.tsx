import { Suspense } from "react";
import { Building2, Clock, Mail, UserCheck, Users } from "lucide-react";
import type { UserStatus } from "@prisma/client";
import { formatUserDateTime } from "@/lib/user-timezone";
import { listUsers, getUserDeleteEligibility } from "@/services/admin.service";
import { getSession } from "@/lib/session";
import { AdminCreateAdvertiserDialog } from "@/components/admin/admin-create-advertiser-dialog";
import { AdminLoginAsButton } from "@/components/admin/admin-login-as-button";
import { AdvertiserActionsMenu } from "@/components/admin/advertiser-actions-menu";
import {
  avatarColors,
  EmailVerifiedBadge,
  formatCurrency,
  getInitials,
  UserStatusBadge,
} from "@/components/admin/admin-ui";
import { AffsenseStatCard } from "@/components/dashboard/affsense-stat-card";
import { UsersTableFilters } from "@/components/admin/users-table-filters";
import { UsersTablePagination } from "@/components/admin/users-table-pagination";
import { PageHeader } from "@/components/layout/page-header";
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
  const pendingCount = allAdvertisers.filter((u) => u.status === "PENDING").length;

  const hasFilters = !!(params.q || params.status || params.from || params.to);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Advertisers"
        description="Manage advertiser accounts, wallets, and access."
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Advertisers" },
        ]}
      >
        <AdminCreateAdvertiserDialog />
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <AffsenseStatCard
          label="Total Advertisers"
          value={allAdvertisers.length}
          icon={Users}
          accent="coral"
        />
        <AffsenseStatCard
          label="Active"
          value={activeCount}
          icon={UserCheck}
          accent="emerald"
        />
        <AffsenseStatCard
          label="Pending"
          value={pendingCount}
          icon={Clock}
          accent="navy"
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Suspense
          fallback={
            <div className="h-14 w-full max-w-xl animate-pulse rounded-[var(--radius-card,0.875rem)] bg-muted" />
          }
        >
          <UsersTableFilters />
        </Suspense>
      </div>

      {advertisers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[var(--radius-card,0.875rem)] border border-dashed border-border bg-card px-6 py-16 text-center shadow-[var(--shadow-card)]">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--theme-primary-soft)]">
            <Building2 className="h-6 w-6 text-[var(--theme-primary)]" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-foreground">
            {hasFilters ? "No matching advertisers" : "No advertisers yet"}
          </h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {hasFilters
              ? "Try adjusting your search or filter criteria."
              : "Advertiser accounts will appear here once users register."}
          </p>
          {!hasFilters ? (
            <div className="mt-5">
              <AdminCreateAdvertiserDialog />
            </div>
          ) : null}
        </div>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-card,0.875rem)] border border-border bg-card shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between border-b border-border px-5 py-2.5">
            <p className="text-sm text-muted-foreground">
              {hasFilters
                ? `Showing ${advertisers.length} of ${meta.total} advertiser${meta.total === 1 ? "" : "s"}`
                : `${meta.total} advertiser${meta.total === 1 ? "" : "s"}`}
            </p>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border bg-muted/40 hover:bg-transparent">
                  <TableHead className="h-10 px-6 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Advertiser
                  </TableHead>
                  <TableHead className="h-10 px-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Company
                  </TableHead>
                  <TableHead className="h-10 px-4 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Campaigns
                  </TableHead>
                  <TableHead className="h-10 px-4 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Wallet
                  </TableHead>
                  <TableHead className="h-10 px-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead className="h-10 px-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Joined
                  </TableHead>
                  <TableHead className="h-10 px-6 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Actions
                  </TableHead>
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
                    <TableRow
                      key={advertiser.id}
                      className="border-border/80 transition-colors hover:bg-muted/30"
                    >
                      <TableCell className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar size="lg">
                            <AvatarFallback
                              className={cn(
                                "text-sm font-semibold",
                                avatarColors[index % avatarColors.length],
                              )}
                            >
                              {getInitials(advertiser.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {advertiser.name}
                            </p>
                            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                              <Mail className="h-3 w-3 shrink-0 text-[var(--theme-primary)]" />
                              {advertiser.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                        {advertiser.advertiserProfile?.company ?? "—"}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-center">
                        <span className="text-sm font-semibold tabular-nums text-foreground">
                          {advertiser._count.campaigns}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right">
                        <span
                          className={cn(
                            "text-sm font-semibold tabular-nums",
                            balance > 0
                              ? "text-[var(--theme-success)]"
                              : "text-muted-foreground",
                          )}
                        >
                          {formatCurrency(balance)}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="flex flex-col gap-1.5">
                          <UserStatusBadge status={advertiser.status} />
                          <EmailVerifiedBadge verified={!!advertiser.emailVerified} />
                          {advertiser.status === "PENDING" && !advertiser.emailVerified ? (
                            <span className="text-xs text-[var(--warning)]">
                              Awaiting email verification
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-muted-foreground">
                        {formatUserDateTime(advertiser.createdAt, tz, "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="px-6 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <AdminLoginAsButton
                            userId={advertiser.id}
                            userName={advertiser.name}
                            disabled={advertiser.status !== "ACTIVE"}
                          />
                          <AdvertiserActionsMenu
                            advertiser={advertiser}
                            deleteDisabledReason={deleteEligibility.reason}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <Suspense>
            <UsersTablePagination
              page={meta.page}
              totalPages={meta.totalPages}
              total={meta.total}
            />
          </Suspense>
        </div>
      )}
    </div>
  );
}
