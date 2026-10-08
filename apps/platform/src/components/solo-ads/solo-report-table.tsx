import type { ReactNode } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatUsdCents, soloPct } from "@/components/solo-ads/solo-shared";
import type { SoloReportRow } from "@/services/solo-report.service";

function roi(r: SoloReportRow) {
  return r.spendCents > 0 ? `${Math.round(((r.commissionCents - r.spendCents) / r.spendCents) * 100)}%` : "—";
}

export function SoloReportTable({
  rows,
  totals,
  firstColumn,
  renderLabel,
  empty = "No traffic in this period.",
}: {
  rows: SoloReportRow[];
  totals?: SoloReportRow;
  firstColumn: string;
  renderLabel?: (row: SoloReportRow) => ReactNode;
  empty?: string;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{firstColumn}</TableHead>
          <TableHead className="text-right">Paid clicks</TableHead>
          <TableHead className="text-right">Filtered</TableHead>
          <TableHead className="text-right">Spend</TableHead>
          <TableHead className="text-right">Leads</TableHead>
          <TableHead className="text-right">Opt-in rate</TableHead>
          <TableHead className="text-right">Sales</TableHead>
          <TableHead className="text-right">Commission</TableHead>
          <TableHead className="text-right">EPC</TableHead>
          <TableHead className="text-right">ROI</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={10} className="py-10 text-center text-sm text-muted-foreground">
              {empty}
            </TableCell>
          </TableRow>
        ) : null}
        {[...rows, ...(totals && rows.length > 1 ? [totals] : [])].map((r) => {
          const isTotal = r === totals;
          return (
            <TableRow key={isTotal ? "__total" : r.key} className={isTotal ? "bg-muted/40 font-semibold" : undefined}>
              <TableCell>{isTotal || !renderLabel ? r.label : renderLabel(r)}</TableCell>
              <TableCell className="text-right tabular-nums">{r.billedClicks.toLocaleString()}</TableCell>
              <TableCell className="text-right tabular-nums text-muted-foreground">{r.invalidClicks.toLocaleString()}</TableCell>
              <TableCell className="text-right tabular-nums">{formatUsdCents(r.spendCents)}</TableCell>
              <TableCell className="text-right tabular-nums">{r.leads.toLocaleString()}</TableCell>
              <TableCell className="text-right tabular-nums">{soloPct(r.leads, r.billedClicks)}</TableCell>
              <TableCell className="text-right tabular-nums">{r.conversions.toLocaleString()}</TableCell>
              <TableCell className="text-right tabular-nums">{formatUsdCents(r.commissionCents)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {r.billedClicks > 0 ? formatUsdCents(Math.round(r.commissionCents / r.billedClicks)) : "—"}
              </TableCell>
              <TableCell
                className={`text-right tabular-nums ${r.spendCents > 0 && r.commissionCents >= r.spendCents ? "text-emerald-600" : r.spendCents > 0 ? "text-red-600" : ""}`}
              >
                {roi(r)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
