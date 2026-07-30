export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { formatUserDateTime } from "@/lib/user-timezone";
import { History, Plus, Wallet } from "lucide-react";
import { getSession } from "@/lib/session";
import { getWalletBalance, listUserDeposits } from "@/services/wallet.service";
import { GradientStatCard } from "@/components/admin/gradient-stat-card";
import { PageSection } from "@/components/admin/page-section";
import { DepositStatusBadge, formatCurrency } from "@/components/admin/admin-ui";
import { WalletRechargePanel } from "@/components/advertiser/wallet-recharge-panel";
import { RoleHero } from "@/components/layout/role-hero";
import { AdvertiserLeadsTableFooter } from "@/components/advertiser/advertiser-leads-table-footer";
import { formatDepositMethod } from "@/lib/deposit";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

function shortDepositId(id: string) {
  return id.slice(-8).toUpperCase();
}

export default async function WalletPage({ searchParams }: PageProps) {
  const session = await getSession();
  const tz = session!.user.timezone;
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10));
  const limit = 10;

  const [balance, deposits] = await Promise.all([
    getWalletBalance(session!.user.id),
    listUserDeposits(session!.user.id, { page, limit }),
  ]);

  const wallet = balance ?? {
    balance: 0,
    holdBalance: 0,
    availableBalance: 0,
    currency: "USD",
  };

  return (
    <div className="space-y-7">
      <RoleHero
        eyebrow="Advertiser Portal"
        title="Wallet"
        description="Add funds via credit card or Wise, then review your deposit history."
        action={{ label: "Add Funds", href: "#add-funds", icon: Plus }}
      />

      <GradientStatCard
        variant="revenue"
        label="Available Balance"
        value={formatCurrency(wallet.availableBalance)}
        icon={Wallet}
      />

      <PageSection
        title="Add Funds"
        description="Credit card is approved instantly. Wise deposits need admin approval."
        icon={Plus}
        gradient="revenue"
        contentClassName="p-6"
      >
        <WalletRechargePanel
          initialBalance={{
            balance: wallet.balance,
            availableBalance: wallet.availableBalance,
            currency: wallet.currency,
          }}
        />
      </PageSection>

      <PageSection
        title="Deposit History"
        description="Your wallet top-ups and approval status"
        icon={History}
        gradient="revenue"
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow
                className="border-none hover:bg-transparent"
                style={{ background: "var(--theme-primary-soft)" }}
              >
                <TableHead className="h-11 px-6 text-slate-600">Date</TableHead>
                <TableHead className="h-11 px-4 text-slate-600">ID</TableHead>
                <TableHead className="h-11 px-4 text-slate-600">Method</TableHead>
                <TableHead className="h-11 px-4 text-right text-slate-600">Amount</TableHead>
                <TableHead className="h-11 px-4 text-right text-slate-600">Balance After</TableHead>
                <TableHead className="h-11 px-4 text-slate-600">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deposits.data.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="px-6 py-16 text-center text-slate-500">
                    No deposits yet. Use <strong>Add Funds</strong> above to make your first deposit.
                  </TableCell>
                </TableRow>
              ) : (
                deposits.data.map((deposit) => (
                  <TableRow
                    key={deposit.id}
                    className="border-slate-100 transition-colors hover:bg-blue-50/40"
                  >
                    <TableCell className="px-6 py-4 text-sm text-slate-700">
                      {formatUserDateTime(deposit.createdAt, tz, "MMM d, yyyy HH:mm")}
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <span className="font-mono text-xs font-medium text-slate-600">
                        {shortDepositId(deposit.id)}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-4 text-sm text-slate-600">
                      {formatDepositMethod(deposit.method)}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-right text-sm font-semibold tabular-nums text-emerald-600">
                      +{formatCurrency(deposit.amount)}
                    </TableCell>
                    <TableCell className="px-4 py-4 text-right text-sm font-medium tabular-nums text-slate-700">
                      {deposit.balanceAfter !== null
                        ? formatCurrency(deposit.balanceAfter)
                        : "—"}
                    </TableCell>
                    <TableCell className="px-4 py-4">
                      <DepositStatusBadge status={deposit.status} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {deposits.meta.total > 0 && (
          <Suspense fallback={null}>
            <AdvertiserLeadsTableFooter
              page={deposits.meta.page}
              totalPages={deposits.meta.totalPages}
              total={deposits.meta.total}
              perPage={deposits.meta.limit}
            />
          </Suspense>
        )}
      </PageSection>
    </div>
  );
}
