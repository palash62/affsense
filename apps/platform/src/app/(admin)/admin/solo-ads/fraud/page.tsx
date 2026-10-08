import Link from "next/link";
import { SoloAdminShell } from "@/components/solo-ads/admin/solo-admin-shell";
import { SoloRefundClickButton } from "@/components/solo-ads/admin/solo-refund-click-button";
import { SoloStatusBadge, formatSoloDateTime, formatUsdCents, soloPct } from "@/components/solo-ads/solo-shared";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getSession } from "@/lib/session";
import { getSoloTrafficQuality } from "@/services/solo-report.service";

export const dynamic = "force-dynamic";

const REASON_LABELS: Record<string, string> = {
  bot: "Bot or crawler",
  unsupported_geo: "Country not supported",
  provider_geo: "Outside provider's geo",
  token_rate: "Token rate limit",
  ip_rate: "Repeat IP",
  ip_velocity: "Repeat IP (at validation)",
  no_campaign: "No eligible campaign",
  reservation_failed: "Budgets full",
  provider_capacity: "Provider daily capacity",
  campaign_deleted: "Campaign removed",
};

const STATUSES = ["INVALID", "FALLBACK", "BILLED", "REFUNDED"];
const PERIODS = [1, 7, 30];

export default async function AdminSoloTrafficQualityPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; status?: string; page?: string }>;
}) {
  const session = await getSession();
  const params = await searchParams;
  const days = PERIODS.includes(Number(params.days)) ? Number(params.days) : 7;
  const q = await getSoloTrafficQuality({ days, status: params.status, page: Number(params.page) || 1 });
  const canRefund = session?.user.role === "ADMIN" && !session.impersonatorId;
  const qs = (patch: Record<string, string | number>) =>
    `?${new URLSearchParams({ days: String(days), status: q.status, ...Object.fromEntries(Object.entries(patch).map(([k, v]) => [k, String(v)])) })}`;
  const reasonTotal = q.reasons.reduce((a, r) => a + r.count, 0);

  return (
    <SoloAdminShell title="Traffic quality" description="Filtered clicks, provider quality and click refunds.">
      <div className="flex flex-wrap gap-2 text-sm">
        {PERIODS.map((p) => (
          <Link
            key={p}
            href={qs({ days: p, page: 1 })}
            className={`rounded-full border px-3 py-1 ${p === days ? "border-[var(--theme-primary)] bg-[var(--theme-primary)] text-white" : "border-border"}`}
          >
            {p === 1 ? "Last 24 hours" : `Last ${p} days`}
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <section className="premium-card p-6 lg:col-span-2">
          <h2 className="mb-4 text-base font-semibold">Why clicks were not billed</h2>
          {q.reasons.length === 0 ? (
            <p className="text-sm text-muted-foreground">No filtered clicks in this period.</p>
          ) : (
            <ul className="space-y-3">
              {q.reasons.map((r) => (
                <li key={r.reason} className="text-sm">
                  <div className="flex justify-between">
                    <span>{REASON_LABELS[r.reason] ?? r.reason}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {r.count.toLocaleString()} · {soloPct(r.count, reasonTotal)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-amber-500" style={{ width: `${(r.count / reasonTotal) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="premium-card overflow-hidden lg:col-span-3">
          <div className="border-b border-border px-6 py-4">
            <h2 className="text-base font-semibold">Provider quality</h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead className="text-right">Clicks</TableHead>
                <TableHead className="text-right">Billed</TableHead>
                <TableHead className="text-right">Filtered</TableHead>
                <TableHead className="text-right">Fallback</TableHead>
                <TableHead className="text-right">Refunded</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.providers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                    No traffic in this period.
                  </TableCell>
                </TableRow>
              ) : null}
              {q.providers.map((p) => {
                const rate = p.total > 0 ? p.invalid / p.total : 0;
                return (
                  <TableRow key={p.providerId}>
                    <TableCell>
                      <div className="font-medium">#{p.publicCode}</div>
                      <div className="text-xs text-muted-foreground">{p.realName}</div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{p.total.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.billed.toLocaleString()}</TableCell>
                    <TableCell className={`text-right tabular-nums ${rate > 0.2 ? "font-semibold text-red-600" : ""}`}>
                      {p.invalid.toLocaleString()} ({soloPct(p.invalid, p.total)})
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{p.fallback.toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.refunded.toLocaleString()}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </section>
      </div>

      <section className="premium-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold">Clicks ({q.total.toLocaleString()})</h2>
          <div className="flex gap-2 text-xs">
            {STATUSES.map((s) => (
              <Link
                key={s}
                href={qs({ status: s, page: 1 })}
                className={`rounded-full border px-3 py-1 ${s === q.status ? "border-[var(--theme-primary)] bg-[var(--theme-primary)] text-white" : "border-border"}`}
              >
                {s === "INVALID" ? "Filtered" : s.charAt(0) + s.slice(1).toLowerCase()}
              </Link>
            ))}
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Click ID</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Campaign</TableHead>
              <TableHead>Visitor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Charge</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.clicks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                  No clicks.
                </TableCell>
              </TableRow>
            ) : null}
            {q.clicks.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="whitespace-nowrap text-xs">{formatSoloDateTime(c.createdAt)}</TableCell>
                <TableCell className="font-mono text-xs">{c.id}</TableCell>
                <TableCell>#{c.provider?.publicCode ?? "?"}</TableCell>
                <TableCell>
                  {c.campaign ? (
                    <>
                      <div className="text-sm">{c.campaign.name}</div>
                      <div className="text-xs text-muted-foreground">{c.campaign.publisher.email}</div>
                    </>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-xs">
                  {c.country ?? "??"} · {c.device ?? "unknown"} · {c.trafficType === "WARM" ? "Warm" : "Regular"}
                </TableCell>
                <TableCell>
                  <SoloStatusBadge status={c.billingStatus} />
                  {c.invalidReason ? <div className="mt-0.5 text-xs text-muted-foreground">{REASON_LABELS[c.invalidReason] ?? c.invalidReason}</div> : null}
                </TableCell>
                <TableCell className="text-right tabular-nums">{c.billingStatus === "BILLED" ? formatUsdCents(c.chargeCents) : "—"}</TableCell>
                <TableCell className="text-right">
                  {canRefund && c.billingStatus === "BILLED" ? (
                    <SoloRefundClickButton clickId={c.id} amountLabel={formatUsdCents(c.chargeCents)} />
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {q.totalPages > 1 ? (
          <div className="flex items-center justify-between border-t border-border px-6 py-3 text-sm">
            <span className="text-muted-foreground">
              Page {q.page} of {q.totalPages}
            </span>
            <div className="flex gap-2">
              {q.page > 1 ? <Link href={qs({ page: q.page - 1 })} className="rounded-lg border border-border px-3 py-1">Previous</Link> : null}
              {q.page < q.totalPages ? <Link href={qs({ page: q.page + 1 })} className="rounded-lg border border-border px-3 py-1">Next</Link> : null}
            </div>
          </div>
        ) : null}
      </section>
    </SoloAdminShell>
  );
}
