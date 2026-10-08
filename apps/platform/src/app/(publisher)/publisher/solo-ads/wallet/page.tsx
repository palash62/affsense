import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, Lock, Wallet } from "lucide-react";
import { GradientStatCard, NeutralStatCard } from "@/components/admin/gradient-stat-card";
import { SoloPublisherShell } from "@/components/solo-ads/publisher/solo-publisher-shell";
import { SoloWalletActions } from "@/components/solo-ads/publisher/solo-wallet-actions";
import { SoloStatusBadge, formatSoloDateTime, formatUsdCents, soloStatusLabel } from "@/components/solo-ads/solo-shared";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getSession } from "@/lib/session";
import { getSoloAdsAccess } from "@/lib/solo-ads-access";
import { getSoloWalletSummary, listSoloDeposits, listSoloLedger } from "@/services/solo-wallet.service";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  DEPOSIT: "Card deposit",
  EARNINGS_TRANSFER: "From earnings",
  CHARGE: "Click charges",
  REFUND: "Click refund",
  ADJUSTMENT: "Adjustment",
  CHARGEBACK: "Chargeback",
  REVERSAL: "Deposit refund",
};

export default async function SoloWalletPage({ searchParams }: { searchParams: Promise<{ page?: string; type?: string }> }) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const params = await searchParams;
  const type = params.type && TYPE_LABELS[params.type] ? params.type : null;
  const [{ config }, summary, ledger, deposits] = await Promise.all([
    getSoloAdsAccess(session.user.id),
    getSoloWalletSummary(session.user.id),
    listSoloLedger(session.user.id, { page: Number(params.page) || 1, limit: 25, type }),
    listSoloDeposits(session.user.id, 5),
  ]);
  const pending = deposits.filter((d) => d.status === "PENDING");
  const qs = (page: number) => `?page=${page}${type ? `&type=${type}` : ""}`;

  return (
    <SoloPublisherShell title="Ad wallet" description="Funds used to pay for Solo Ads clicks. Separate from your earnings.">
      <div className="grid gap-4 sm:grid-cols-3">
        <GradientStatCard label="Available to spend" value={formatUsdCents(summary.availableCents)} icon={Wallet} variant="approved" />
        <NeutralStatCard label="Reserved for recent clicks" value={formatUsdCents(summary.reservedCents)} icon={Lock} accent="orange" />
        <NeutralStatCard label="Wallet balance" value={formatUsdCents(summary.balanceCents)} icon={Wallet} accent={summary.balanceCents < 0 ? "red" : "purple"} />
      </div>
      {summary.balanceCents < 0 ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Your balance is negative because of a card refund or chargeback. Add funds to bring it back above zero before campaigns
          can run again.
        </div>
      ) : null}
      {pending.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {pending.length} card payment{pending.length > 1 ? "s are" : " is"} still processing. Funds are added as soon as the payment is
          confirmed.
        </div>
      ) : null}

      <SoloWalletActions
        minDepositCents={config.minDepositCents}
        earningsAvailableCents={summary.earningsAvailableCents}
        transferEnabled={config.transferEnabled}
        readOnly={Boolean(session.viewAsMode)}
      />

      <section className="premium-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold">Transactions</h2>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Link href="?" className={`rounded-full border px-3 py-1 ${!type ? "border-[var(--theme-primary)] bg-[var(--theme-primary)] text-white" : "border-border"}`}>
              All
            </Link>
            {Object.entries(TYPE_LABELS).map(([key, label]) => (
              <Link
                key={key}
                href={`?type=${key}`}
                className={`rounded-full border px-3 py-1 ${type === key ? "border-[var(--theme-primary)] bg-[var(--theme-primary)] text-white" : "border-border"}`}
              >
                {label}
              </Link>
            ))}
            <a
              href={`/api/v1/publisher/solo-ads/wallet/ledger/export${type ? `?type=${type}` : ""}`}
              className="ml-2 inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1 font-medium hover:bg-muted"
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </a>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Details</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Balance after</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ledger.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  No transactions yet.
                </TableCell>
              </TableRow>
            ) : null}
            {ledger.rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="whitespace-nowrap text-sm">{formatSoloDateTime(row.createdAt)}</TableCell>
                <TableCell>{TYPE_LABELS[row.type] ?? soloStatusLabel(row.type)}</TableCell>
                <TableCell className="max-w-[320px] truncate text-sm text-muted-foreground">{row.reason ?? row.sourceType ?? ""}</TableCell>
                <TableCell className={`text-right tabular-nums ${row.amountCents < 0 ? "text-red-600" : "text-emerald-600"}`}>
                  {row.amountCents > 0 ? "+" : ""}
                  {formatUsdCents(row.amountCents)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatUsdCents(row.balanceAfterCents)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {ledger.totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-border px-6 py-3 text-sm">
            <span className="text-muted-foreground">
              Page {ledger.page} of {ledger.totalPages}
            </span>
            <div className="flex gap-2">
              {ledger.page > 1 ? <Link href={qs(ledger.page - 1)} className="rounded-lg border border-border px-3 py-1">Previous</Link> : null}
              {ledger.page < ledger.totalPages ? <Link href={qs(ledger.page + 1)} className="rounded-lg border border-border px-3 py-1">Next</Link> : null}
            </div>
          </div>
        ) : null}
      </section>

      {deposits.length > 0 ? (
        <section className="premium-card overflow-hidden">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-base font-semibold">Recent card payments</h2>
          </div>
          <Table>
            <TableBody>
              {deposits.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="text-sm">{formatSoloDateTime(d.createdAt)}</TableCell>
                  <TableCell className="tabular-nums">{formatUsdCents(d.amountCents)}</TableCell>
                  <TableCell>
                    <SoloStatusBadge status={d.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{d.failureReason ?? (d.refundedCents ? `Refunded ${formatUsdCents(d.refundedCents)}` : "")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      ) : null}
    </SoloPublisherShell>
  );
}
