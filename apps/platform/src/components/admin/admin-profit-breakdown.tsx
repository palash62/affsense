import { formatCurrency } from "@/components/admin/admin-ui";
import {
  PROFIT_COST_LINES,
  PROFIT_INCOME_LINES,
  type InvoiceProfitTotals,
} from "@/lib/partner-invoice";

function BreakdownList({
  title,
  total,
  lines,
}: {
  title: string;
  total: number;
  lines: Array<{ label: string; value: number; subtract?: boolean }>;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="text-sm font-semibold text-foreground">{formatCurrency(total)}</span>
      </div>
      <dl className="space-y-1.5 text-sm">
        {lines.map((line) => (
          <div key={line.label} className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{line.label}</dt>
            <dd className="text-foreground">
              {line.subtract && line.value ? "− " : ""}
              {formatCurrency(line.value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Income and cost lines behind a platform profit figure. */
export function AdminProfitBreakdown({ totals }: { totals: InvoiceProfitTotals }) {
  return (
    <div className="grid gap-6 rounded-[18px] border border-border bg-card p-5 shadow-sm md:grid-cols-2">
      <BreakdownList
        title="Income"
        total={totals.income}
        lines={PROFIT_INCOME_LINES.map((line) => ({ ...line, value: totals[line.key] }))}
      />
      <BreakdownList
        title="Costs"
        total={totals.costs}
        lines={PROFIT_COST_LINES.map((line) => ({ ...line, value: totals[line.key] }))}
      />
    </div>
  );
}
