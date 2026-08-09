import { redirect } from "next/navigation";
import { formatUserDateTime } from "@/lib/user-timezone";
import { Phone, UserCheck, UserCog, Users } from "lucide-react";
import type { UserStatus } from "@prisma/client";
import { listPlatformManagers } from "@/services/admin.service";
import { getSession } from "@/lib/session";
import { parseStaffMenuAccess } from "@/lib/admin-portal";
import { PageHero } from "@/components/admin/page-hero";
import { PageSection } from "@/components/admin/page-section";
import { NeutralStatCard } from "@/components/admin/gradient-stat-card";
import {
  avatarColors,
  getInitials,
  UserStatusBadge,
} from "@/components/admin/admin-ui";
import { AdminCreateStaffUserDialog } from "@/components/admin/admin-create-staff-user-dialog";
import { AdminEditStaffMenusDialog } from "@/components/admin/admin-edit-staff-menus-dialog";
import { StaffUserStatusActions } from "@/components/admin/staff-user-status-actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ADMIN_NAV } from "@/components/layout/nav-config";
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
  const map = new Map(ADMIN_NAV.map((n) => [n.href, n.label]));
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

  return (
    <div className="space-y-7">
      <PageHero
        eyebrow="User Management"
        title="Users"
        description="Create Platform Managers, grant menu access, and deactivate staff logins."
        badge={`${meta.total} platform manager${meta.total === 1 ? "" : "s"}`}
      />

      <div className="flex flex-wrap items-center justify-end gap-3">
        <AdminCreateStaffUserDialog />
      </div>

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

      <PageSection
        title="Platform Managers"
        description="Staff accounts with custom admin menu access"
        icon={UserCog}
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Menus</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {managers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-28 text-center text-slate-500">
                    No platform managers yet.
                  </TableCell>
                </TableRow>
              ) : (
                managers.map((user, index) => {
                  const menus = parseStaffMenuAccess(user.staffMenuAccess);
                  const labels = menuLabels(menus);
                  return (
                    <TableRow key={user.id}>
                      <TableCell>
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
                            <p className="font-medium text-slate-900">{user.name}</p>
                            <p className="text-xs text-slate-500">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        <div className="space-y-1">
                          {user.phone ? (
                            <p className="flex items-center gap-1.5">
                              <Phone className="h-3.5 w-3.5" />
                              {user.phone}
                            </p>
                          ) : null}
                          {user.country ? <p>{user.country}</p> : null}
                          {!user.phone && !user.country ? (
                            <span className="text-slate-400">—</span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[220px]">
                        {labels.length === 0 ? (
                          <span className="text-sm text-slate-400">Dashboard only</span>
                        ) : (
                          <p className="line-clamp-2 text-sm text-slate-600">
                            {labels.join(", ")}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <UserStatusBadge status={user.status} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm text-slate-500">
                        {formatUserDateTime(user.createdAt, tz, "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
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
                })
              )}
            </TableBody>
          </Table>
        </div>
      </PageSection>
    </div>
  );
}
