import { AffiliateInvoiceStatusBadge, formatCurrency } from "@/components/admin/admin-ui";
import { formatInvoicePeriod } from "@/lib/affiliate-invoice-period";
import { PLATFORM_EMAILS } from "@/lib/email/addresses";
import { formatPayoutMethodLabel } from "@/lib/payout-payment-details";
import { formatUserDateTime } from "@/lib/user-timezone";
import type { SerializedAffiliateInvoice } from "@/services/affiliate-invoice.service";
import {
  InvoicePrintToolbar,
  InvoicePrintTrigger,
} from "@/components/invoices/invoice-print-toolbar";

export function AffiliateInvoiceDocument({
  invoice,
  timezone,
  periodTimezone,
  showAdminNote = false,
}: {
  invoice: SerializedAffiliateInvoice;
  timezone?: string;
  periodTimezone: string;
  showAdminNote?: boolean;
}) {
  return (
    <div className="min-h-screen bg-muted/40 text-foreground">
      <InvoicePrintTrigger />
      <InvoicePrintToolbar />

      <style>{`
        @media print {
          @page { margin: 16mm; }
          body { background: white !important; }
          .invoice-print-toolbar { display: none !important; }
        }
      `}</style>

      <div className="mx-auto max-w-3xl px-4 py-8 print:max-w-none print:px-0 print:py-0">
        <article className="rounded-xl border border-border bg-card p-8 shadow-sm print:rounded-none print:border-0 print:shadow-none">
          <header className="flex flex-wrap items-start justify-between gap-6 border-b border-border pb-6">
            <div>
              <p className="text-2xl font-semibold tracking-tight text-foreground">LeadVix</p>
              <p className="mt-1 text-sm text-muted-foreground">{PLATFORM_EMAILS.support}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Invoice
              </p>
              <p className="mt-1 font-mono text-lg font-semibold text-foreground">
                {invoice.number}
              </p>
              <div className="mt-2 flex justify-end">
                <AffiliateInvoiceStatusBadge status={invoice.status} overdue={invoice.overdue} />
              </div>
            </div>
          </header>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Bill to
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">{invoice.publisherName}</p>
              <p className="text-sm text-muted-foreground">{invoice.publisherEmail}</p>
            </div>
            <div className="grid gap-3 sm:justify-items-end">
              <MetaRow
                label="Earning period"
                value={formatInvoicePeriod(
                  invoice.periodStart,
                  invoice.periodEnd,
                  periodTimezone,
                )}
              />
              <MetaRow
                label="Issued"
                value={formatUserDateTime(invoice.issuedAt, timezone, "MMM d, yyyy")}
              />
              <MetaRow
                label="Due"
                value={formatUserDateTime(invoice.dueAt, timezone, "MMM d, yyyy")}
              />
            </div>
          </div>

          <div className="mt-8 overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/60">
                <tr className="text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Description</th>
                  <th className="px-4 py-3 text-right font-medium">Entries</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lines.map((line) => (
                  <tr key={line.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium text-foreground">{line.source}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                      {line.entryCount}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground">
                      {formatCurrency(line.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex justify-end">
            <div className="w-full max-w-xs space-y-2 rounded-lg border border-border bg-muted/40 px-4 py-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {invoice.status === "UNPAID" ? "Amount due" : "Total"}
                </span>
                <span className="text-lg font-bold tabular-nums text-emerald-600">
                  {formatCurrency(invoice.total)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{invoice.currency}</p>
            </div>
          </div>

          {invoice.status === "PAID" ? (
            <div className="mt-6 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
              <p className="font-medium text-foreground">Payment recorded</p>
              <p className="mt-1 text-muted-foreground">
                Paid {formatUserDateTime(invoice.paidAt, timezone, "MMM d, yyyy HH:mm")}
                {invoice.paymentMethod
                  ? ` via ${formatPayoutMethodLabel(invoice.paymentMethod)}`
                  : ""}
              </p>
              {invoice.paymentReference ? (
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  Ref: {invoice.paymentReference}
                </p>
              ) : null}
            </div>
          ) : null}

          {invoice.status === "CANCELLED" && invoice.cancelReason ? (
            <div className="mt-6 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              Cancelled: {invoice.cancelReason}
            </div>
          ) : null}

          {showAdminNote && invoice.adminNote ? (
            <div className="mt-4 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted-foreground print:hidden">
              Internal note: {invoice.adminNote}
            </div>
          ) : null}

          <footer className="mt-10 border-t border-border pt-4 text-xs text-muted-foreground">
            Generated by LeadVix. Questions? Contact {PLATFORM_EMAILS.support}.
          </footer>
        </article>
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="sm:text-right">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
