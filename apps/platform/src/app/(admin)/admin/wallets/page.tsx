import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { DollarSign, TrendingUp, Users, Wallet } from "lucide-react";
import { PageHero } from "@/components/admin/page-hero";
import { PageSection } from "@/components/admin/page-section";
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
    <div className="space-y-7">
      <PageHero
        eyebrow="Finance"
        title="Wallets"
        description="View wallet balances across all users"
        badge={`${total} wallet${total === 1 ? "" : "s"}`}
      />

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

      <PageSection title="All Wallets" description="Balances by user account" icon={Wallet} gradient="revenue">
        {total === 0 ? (
          <div className="px-6 py-16 text-center text-slate-500">No wallets found</div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow
                  className="border-none hover:bg-transparent"
                  style={{ background: "var(--theme-primary-soft)" }}
                >
                  <TableHead className="h-11 px-6 text-slate-600">User</TableHead>
                  <TableHead className="h-11 px-4 text-slate-600">Role</TableHead>
                  <TableHead className="h-11 px-4 text-right text-slate-600">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wallets.map((w, index) => (
                  <TableRow
                    key={w.id}
                    className="border-slate-100 transition-colors hover:bg-blue-50/40"
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
                          <p className="font-medium text-slate-900">{w.user.name}</p>
                          <p className="text-xs text-slate-500">{w.user.email}</p>
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
                          Number(w.balance) > 0 ? "text-emerald-600" : "text-slate-400",
                        )}
                      >
                        {formatCurrency(Number(w.balance))}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Suspense fallback={null}>
              <UsersTablePagination page={page} totalPages={totalPages} total={total} />
            </Suspense>
          </>
        )}
      </PageSection>
    </div>
  );
}
