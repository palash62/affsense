import { Landmark, Lock, Wallet } from "lucide-react";
import { GradientStatCard, NeutralStatCard } from "@/components/admin/gradient-stat-card";
import { SoloAdminShell } from "@/components/solo-ads/admin/solo-admin-shell";
import { SoloWalletAdjustDialog } from "@/components/solo-ads/admin/solo-wallet-adjust-dialog";
import { SoloWiseDepositReview } from "@/components/solo-ads/admin/solo-wise-deposit-review";
import { formatSoloDateTime, formatUsdCents } from "@/components/solo-ads/solo-shared";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { listPendingSoloWiseDeposits } from "@/services/solo-wallet.service";

export const dynamic = "force-dynamic";

export default async function AdminSoloAdsWalletsPage() {
  const session = await getSession();
  const canReview = session?.user.role === "ADMIN" && !session.impersonatorId;
  const [pendingWise, totals, wallets, byType] = await Promise.all([
    listPendingSoloWiseDeposits(),
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

      {pendingWise.length > 0 ? (
        <section className="premium-card overflow-hidden">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-base font-semibold">Pending Wise deposits ({pendingWise.length})</h2>
            <p className="text-sm text-muted-foreground">
              Confirm each payment arrived in your Wise account, then approve to credit the affiliate&apos;s ad wallet.
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Submitted</TableHead>
                <TableHead>Affiliate</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Wise reference</TableHead>
                <TableHead>Note</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingWise.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="whitespace-nowrap text-sm">{formatSoloDateTime(d.createdAt)}</TableCell>
                  <TableCell>
                    <div className="font-medium">{d.publisher?.name ?? "Unknown"}</div>
                    <div className="text-xs text-muted-foreground">{d.publisher?.email}</div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatUsdCents(d.amountCents)}</TableCell>
                  <TableCell className="font-mono text-sm">{d.paymentReference}</TableCell>
                  <TableCell className="max-w-[240px] truncate text-sm text-muted-foreground">{d.note ?? ""}</TableCell>
                  <TableCell className="text-right">
                    {canReview ? (
                      <SoloWiseDepositReview
                        depositId={d.id}
                        amountCents={d.amountCents}
                        publisherName={d.publisher?.name ?? "affiliate"}
                        reference={d.paymentReference ?? "-"}
                      />
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      ) : null}

      <div className="premium-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Affiliate</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className="text-right">Reserved</TableHead>
              <TableHead className="text-right">Deposits</TableHead>
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
