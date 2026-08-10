import { Suspense } from "react";
import { redirect } from "next/navigation";
import { formatUserDateTime } from "@/lib/user-timezone";
import { Phone, UserCheck, UserCog, Users } from "lucide-react";
import type { UserStatus } from "@prisma/client";
import { listPlatformManagers } from "@/services/admin.service";
import { getSession } from "@/lib/session";
import { parseStaffMenuAccess } from "@/lib/admin-portal";
import { NeutralStatCard } from "@/components/admin/gradient-stat-card";
import {
  avatarColors,
  getInitials,
  UserStatusBadge,
} from "@/components/admin/admin-ui";
import { AdminCreateStaffUserDialog } from "@/components/admin/admin-create-staff-user-dialog";
import { AdminEditStaffMenusDialog } from "@/components/admin/admin-edit-staff-menus-dialog";
import { StaffUserStatusActions } from "@/components/admin/staff-user-status-actions";
import { UsersTableFilters } from "@/components/admin/users-table-filters";
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
import { ADMIN_LEGACY_NAV } from "@/components/layout/nav-config";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    q?: string;
    status?: string;
    page?: string;
  }>;
}

function menuLabels(access: string[]) {
  const items = Array.isArray(ADMIN_LEGACY_NAV) ? ADMIN_LEGACY_NAV : [];
  const map = new Map(items.map((n) => [n.href, n.label]));
  return access.map((href) => map.get(href) ?? href);
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/admin");
  }

  const tz = session.user.timezone;
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));

  const [{ data: managers, meta }, { data: allManagers }] = await Promise.all([
    listPlatformManagers({
      search: params.q,
      status: params.status as UserStatus | undefined,
      page,
      limit: 20,
    }),
    listPlatformManagers({ limit: 500 }),
  ]);

  const activeCount = allManagers.filter((u) => u.status === "ACTIVE").length;
  const hasFilters = !!(params.q || params.status);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <NeutralStatCard
          label="Platform Managers"
          value={allManagers.length}
          icon={Users}
          accent="purple"
        />
        <NeutralStatCard
          label="Active"
          value={activeCount}
          icon={UserCheck}
          accent="green"
        />
        <NeutralStatCard
          label="Staff role"
          value="Manager"
          icon={UserCog}
          accent="orange"
        />
      </div>

      <Suspense
        fallback={
          <div className="h-14 animate-pulse rounded-[var(--radius-card,0.875rem)] bg-muted" />
        }
      >
        <UsersTableFilters showDateRange={false} />
      </Suspense>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {hasFilters
            ? `Showing ${managers.length} of ${meta.total} manager${meta.total === 1 ? "" : "s"}`
            : `${meta.total} manager${meta.total === 1 ? "" : "s"}`}
        </p>
        <AdminCreateStaffUserDialog />
      </div>

      {managers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[var(--radius-card,0.875rem)] border border-dashed border-border bg-card px-6 py-16 text-center shadow-[var(--shadow-card)]">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--theme-primary-soft)]">
            <UserCog className="h-6 w-6 text-[var(--theme-primary)]" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-foreground">
            {hasFilters ? "No managers match your filters" : "No platform managers yet"}
          </h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {hasFilters
              ? "Try adjusting search or status filters."
              : "Create a staff login with custom menu access to get started."}
          </p>
          {!hasFilters ? (
            <div className="mt-5">
              <AdminCreateStaffUserDialog />
            </div>
          ) : null}
        </div>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-card,0.875rem)] border border-border bg-card shadow-[var(--shadow-card)]">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent bg-muted/60">
                  <TableHead className="h-11 px-6 text-muted-foreground">User</TableHead>
                  <TableHead className="h-11 px-4 text-muted-foreground">Contact</TableHead>
                  <TableHead className="h-11 px-4 text-muted-foreground">Menus</TableHead>
                  <TableHead className="h-11 px-4 text-muted-foreground">Status</TableHead>
                  <TableHead className="h-11 px-4 text-muted-foreground">Created</TableHead>
                  <TableHead className="h-11 px-6 text-right text-muted-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {managers.map((user, index) => {
                  const menus = parseStaffMenuAccess(user.staffMenuAccess);
                  const labels = menuLabels(menus);
                  return (
                    <TableRow
                      key={user.id}
                      className="border-border transition-colors hover:bg-muted/40"
                    >
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback
                              className={cn(
                                "text-xs font-semibold text-white",
                                avatarColors[index % avatarColors.length],
                              )}
                            >
                              {getInitials(user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-foreground">{user.name}</p>
                            <p className="text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-4 text-sm text-muted-foreground">
                        <div className="space-y-1">
                          {user.phone ? (
                            <p className="flex items-center gap-1.5">
                              <Phone className="h-3.5 w-3.5" />
                              {user.phone}
                            </p>
                          ) : null}
                          {user.country ? <p>{user.country}</p> : null}
                          {!user.phone && !user.country ? (
                            <span className="text-muted-foreground">—</span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[220px] px-4 py-4">
                        {labels.length === 0 ? (
                          <span className="text-sm text-muted-foreground">Dashboard only</span>
                        ) : (
                          <p className="line-clamp-2 text-sm text-muted-foreground">
                            {labels.join(", ")}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        <UserStatusBadge status={user.status} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap px-4 py-4 text-sm text-muted-foreground">
                        {formatUserDateTime(user.createdAt, tz, "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <div className="flex flex-col items-end gap-2">
                          <AdminEditStaffMenusDialog
                            userId={user.id}
                            initialMenus={menus}
                          />
                          <StaffUserStatusActions
                            userId={user.id}
                            currentStatus={user.status}
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
            <UsersTablePagination page={meta.page} totalPages={meta.totalPages} total={meta.total} />
          </Suspense>
        </div>
      )}
    </div>
  );
}
