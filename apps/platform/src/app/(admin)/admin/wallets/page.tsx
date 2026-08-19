import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { DollarSign, TrendingUp, Users, Wallet } from "lucide-react";
import { GradientStatCard, NeutralStatCard } from "@/components/admin/gradient-stat-card";
import { UsersTablePagination } from "@/components/admin/users-table-pagination";
import { avatarColors, formatCurrency, getInitials } from "@/components/admin/admin-ui";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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

const PAGE_SIZE = 20;

const roleColors: Record<string, string> = {
  ADMIN: "border-violet-200 bg-violet-50 text-violet-700",
  ADVERTISER: "border-blue-200 bg-blue-50 text-blue-700",
  PUBLISHER: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

type PageProps = {
  searchParams: Promise<{ page?: string }>;
};

export default async function AdminWalletsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const [aggregate, advertiserWallets, publisherWallets, total] = await Promise.all([
    prisma.wallet.aggregate({ _sum: { balance: true } }),
    prisma.wallet.count({ where: { user: { role: "ADVERTISER" } } }),
    prisma.wallet.count({ where: { user: { role: "PUBLISHER" } } }),
    prisma.wallet.count(),
  ]);

  const totalBalance = Number(aggregate._sum.balance ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const requestedPage = Number.parseInt(params.page ?? "1", 10);
  const page =
    Number.isFinite(requestedPage) && requestedPage >= 1
      ? Math.min(requestedPage, totalPages)
      : 1;
  const skip = (page - 1) * PAGE_SIZE;

  const wallets = await prisma.wallet.findMany({
    include: { user: { select: { name: true, email: true, role: true } } },
    orderBy: { balance: "desc" },
    skip,
    take: PAGE_SIZE,
  });

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <GradientStatCard
          variant="revenue"
          label="Total Platform Balance"
          value={formatCurrency(totalBalance)}
          icon={DollarSign}
        />
        <NeutralStatCard
          label="Advertiser Wallets"
          value={advertiserWallets}
          icon={Users}
          accent="purple"
        />
        <NeutralStatCard
          label="Publisher Wallets"
          value={publisherWallets}
          icon={TrendingUp}
          accent="green"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {total} wallet{total === 1 ? "" : "s"} · balances by user account
        </p>
      </div>

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[var(--radius-card,0.875rem)] border border-dashed border-border bg-card px-6 py-16 text-center shadow-[var(--shadow-card)]">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--theme-primary-soft)]">
            <Wallet className="h-6 w-6 text-[var(--theme-primary)]" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-foreground">No wallets found</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Wallet balances will appear here once users have active accounts.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-card,0.875rem)] border border-border bg-card shadow-[var(--shadow-card)]">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent bg-muted/60">
                  <TableHead className="h-11 px-6 text-muted-foreground">User</TableHead>
                  <TableHead className="h-11 px-4 text-muted-foreground">Role</TableHead>
                  <TableHead className="h-11 px-4 text-right text-muted-foreground">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wallets.map((w, index) => (
                  <TableRow
                    key={w.id}
                    className="border-border transition-colors hover:bg-muted/40"
                  >
                    <TableCell className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar size="lg">
                          <AvatarFallback
                            className={cn(
                              "text-sm font-semibold",
                              avatarColors[(skip + index) % avatarColors.length],
                            )}
                          >
                            {getInitials(w.user.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-foreground">{w.user.name}</p>
                          <p className="text-xs text-muted-foreground">{w.user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <Badge
                        variant="outline"
                        className={cn("capitalize", roleColors[w.user.role] ?? "")}
                      >
                        {w.user.role.toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-4 py-4 text-right">
                      <span
                        className={cn(
                          "text-sm font-bold tabular-nums",
                          Number(w.balance) > 0 ? "text-emerald-600" : "text-muted-foreground",
                        )}
                      >
                        {formatCurrency(Number(w.balance))}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Suspense fallback={null}>
            <UsersTablePagination page={page} totalPages={totalPages} total={total} />
          </Suspense>
        </div>
      )}
    </div>
  );
}
