import { Landmark, Lock, Wallet } from "lucide-react";
import { GradientStatCard, NeutralStatCard } from "@/components/admin/gradient-stat-card";
import { SoloAdminShell } from "@/components/solo-ads/admin/solo-admin-shell";
import { SoloWalletAdjustDialog } from "@/components/solo-ads/admin/solo-wallet-adjust-dialog";
import { formatUsdCents } from "@/components/solo-ads/solo-shared";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminSoloAdsWalletsPage() {
  const [totals, wallets, byType] = await Promise.all([
    prisma.soloWallet.aggregate({ _sum: { balanceCents: true, reservedCents: true }, _count: { _all: true } }),
    prisma.soloWallet.findMany({
      orderBy: { balanceCents: "desc" },
      take: 200,
      include: { publisher: { select: { id: true, name: true, email: true } } },
    }),
    prisma.soloWalletLedger.groupBy({ by: ["walletId", "type"], _sum: { amountCents: true } }),
  ]);
  const sumFor = (walletId: string, types: string[]) =>
    byType
      .filter((r) => r.walletId === walletId && types.includes(r.type))
      .reduce((s, r) => s + (r._sum.amountCents ?? 0), 0);
  const liability = totals._sum.balanceCents ?? 0;
  const reserved = totals._sum.reservedCents ?? 0;
  const negative = wallets.filter((w) => w.balanceCents < 0);

  return (
    <SoloAdminShell
      title="Wallets"
      description="Advertising wallet balances. Unspent balances are money Affsense owes affiliates in ad credit."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <GradientStatCard label="Total ad credit liability" value={formatUsdCents(liability)} icon={Landmark} variant="revenue" />
        <NeutralStatCard label="Reserved for pending clicks" value={formatUsdCents(reserved)} icon={Lock} accent="orange" />
        <NeutralStatCard
          label={negative.length ? `Negative balances (${negative.length})` : "Wallets"}
          value={negative.length ? formatUsdCents(negative.reduce((s, w) => s + w.balanceCents, 0)) : totals._count._all}
          icon={Wallet}
          accent={negative.length ? "red" : "purple"}
        />
      </div>

      <div className="premium-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Affiliate</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className="text-right">Reserved</TableHead>
              <TableHead className="text-right">Card deposits</TableHead>
              <TableHead className="text-right">From earnings</TableHead>
              <TableHead className="text-right">Spent</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {wallets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                  No advertising wallets yet.
                </TableCell>
              </TableRow>
            ) : null}
            {wallets.map((w) => (
              <TableRow key={w.id}>
                <TableCell>
                  <div className="font-medium">{w.publisher.name}</div>
                  <div className="text-xs text-muted-foreground">{w.publisher.email}</div>
                </TableCell>
                <TableCell className={`text-right tabular-nums ${w.balanceCents < 0 ? "text-red-600" : ""}`}>
                  {formatUsdCents(w.balanceCents)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatUsdCents(w.reservedCents)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatUsdCents(sumFor(w.id, ["DEPOSIT", "REVERSAL", "CHARGEBACK"]))}</TableCell>
                <TableCell className="text-right tabular-nums">{formatUsdCents(sumFor(w.id, ["EARNINGS_TRANSFER"]))}</TableCell>
                <TableCell className="text-right tabular-nums">{formatUsdCents(-sumFor(w.id, ["CHARGE", "REFUND"]))}</TableCell>
                <TableCell className="text-right">
                  <SoloWalletAdjustDialog publisherId={w.publisher.id} publisherName={w.publisher.name} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </SoloAdminShell>
  );
}
