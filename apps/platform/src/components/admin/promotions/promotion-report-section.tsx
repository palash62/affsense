"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/components/admin/admin-ui";
import { cn } from "@/lib/utils";
import type { PromotionReport, PromotionReportRow } from "@/services/promotion.service";

function formatRate(rate: number | null) {
  if (rate == null) return "—";
  return `${rate}%`;
}

function ReportRow({ row }: { row: PromotionReportRow }) {
  const [open, setOpen] = useState(false);
  const utmLabel = [row.utmSource, row.utmMedium ?? "—", row.utmCampaign].join(" / ");

  return (
    <>
      <TableRow className="border-border hover:bg-muted/40">
        <TableCell className="px-6 py-4">
          <button
            type="button"
            className="flex items-center gap-2 text-left"
            onClick={() => setOpen((prev) => !prev)}
            aria-expanded={open}
          >
            <ChevronDown
              className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
            />
            <div>
              <p className="font-medium text-foreground">{utmLabel}</p>
              {(row.utmContent || row.utmTerm) && (
                <p className="text-xs text-muted-foreground">
                  {[row.utmContent, row.utmTerm].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
          </button>
        </TableCell>
        <TableCell className="px-4 py-4 text-right tabular-nums">{row.clickCount}</TableCell>
        <TableCell className="px-4 py-4 text-right tabular-nums">{row.visitCount}</TableCell>
        <TableCell className="px-4 py-4 text-right tabular-nums">{row.uniqueVisits}</TableCell>
        <TableCell className="px-4 py-4 text-right tabular-nums">{row.signupCount}</TableCell>
        <TableCell className="px-4 py-4 text-right tabular-nums">{formatRate(row.signupRate)}</TableCell>
        <TableCell className="px-4 py-4 text-right tabular-nums text-emerald-600">
          {formatCurrency(row.totalDeposits)}
        </TableCell>
        <TableCell className="px-6 py-4 text-right tabular-nums text-muted-foreground">
          {row.avgDeposit != null ? formatCurrency(row.avgDeposit) : "—"}
        </TableCell>
      </TableRow>
      {open && row.advertisers.length > 0 ? (
        <TableRow className="border-border bg-muted/20 hover:bg-muted/20">
          <TableCell colSpan={8} className="px-6 py-4">
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Advertiser</TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
                    <TableHead className="text-muted-foreground">Signed up</TableHead>
                    <TableHead className="text-right text-muted-foreground">Deposits</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {row.advertisers.map((advertiser) => (
                    <TableRow key={advertiser.id} className="hover:bg-muted/40">
                      <TableCell>
                        <Link
                          href={`/admin/advertisers/${advertiser.id}`}
                          className="font-medium text-[var(--theme-primary)] hover:underline"
                        >
                          {advertiser.name}
                        </Link>
                        <p className="text-xs text-muted-foreground">{advertiser.email}</p>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{advertiser.status}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(advertiser.signupAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-600">
                        {formatCurrency(advertiser.depositTotal)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

export function PromotionReportSection({
  initialReport,
  initialQ,
  initialFrom,
  initialTo,
}: {
  initialReport: PromotionReport;
  initialQ?: string;
  initialFrom?: string;
  initialTo?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [report, setReport] = useState(initialReport);
  const [q, setQ] = useState(initialQ ?? "");
  const [from, setFrom] = useState(initialFrom ?? "");
  const [to, setTo] = useState(initialTo ?? "");

  const loadReport = useCallback(
    async (filters: { q: string; from: string; to: string }) => {
      const params = new URLSearchParams();
      if (filters.q.trim()) params.set("q", filters.q.trim());
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);

      const res = await fetch(`/api/v1/admin/promotions/report?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.data) {
        setReport(data.data);
      }
    },
    [],
  );

  const applyFilters = (overrides?: { q?: string; from?: string; to?: string }) => {
    const next = {
      q: overrides?.q ?? q,
      from: overrides?.from ?? from,
      to: overrides?.to ?? to,
    };

    const params = new URLSearchParams(searchParams.toString());
    if (next.q.trim()) params.set("q", next.q.trim());
    else params.delete("q");
    if (next.from) params.set("from", next.from);
    else params.delete("from");
    if (next.to) params.set("to", next.to);
    else params.delete("to");

    startTransition(() => {
      router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname);
      void loadReport(next);
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-foreground">Attribution report</h2>
        <p className="text-sm text-muted-foreground">
          Funnel by UTM tuple — clicks, visits, signups, and completed advertiser deposits
        </p>
      </div>

      <div className="overflow-hidden rounded-[var(--radius-card,0.875rem)] border border-border bg-card shadow-[var(--shadow-card)]">
        <form
          className="flex flex-col gap-3 border-b border-border px-6 py-4 lg:flex-row lg:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            applyFilters();
          }}
        >
          <div className="min-w-0 flex-1 space-y-1.5">
            <label htmlFor="promo-report-q" className="text-xs font-medium text-muted-foreground">
              Search advertisers
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="promo-report-q"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Name, email, or UTM"
                className="h-10 rounded-xl border-border pl-9"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="promo-report-from" className="text-xs font-medium text-muted-foreground">
              From
            </label>
            <Input
              id="promo-report-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-10 rounded-xl border-border"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="promo-report-to" className="text-xs font-medium text-muted-foreground">
              To
            </label>
            <Input
              id="promo-report-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-10 rounded-xl border-border"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="h-10 rounded-xl" disabled={isPending}>
              {isPending ? "Loading..." : "Apply"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-xl border-border"
              disabled={isPending}
              onClick={() => {
                setQ("");
                setFrom("");
                setTo("");
                applyFilters({ q: "", from: "", to: "" });
              }}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
          </div>
        </form>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent bg-muted/60">
                <TableHead className="h-11 px-6 text-muted-foreground">UTM group</TableHead>
                <TableHead className="h-11 px-4 text-right text-muted-foreground">Clicks</TableHead>
                <TableHead className="h-11 px-4 text-right text-muted-foreground">Visits</TableHead>
                <TableHead className="h-11 px-4 text-right text-muted-foreground">Unique</TableHead>
                <TableHead className="h-11 px-4 text-right text-muted-foreground">Signups</TableHead>
                <TableHead className="h-11 px-4 text-right text-muted-foreground">Signup rate</TableHead>
                <TableHead className="h-11 px-4 text-right text-muted-foreground">Revenue</TableHead>
                <TableHead className="h-11 px-6 text-right text-muted-foreground">Avg / signup</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="px-6 py-12 text-center text-sm text-muted-foreground">
                    No attribution data for the selected filters.
                  </TableCell>
                </TableRow>
              ) : (
                report.rows.map((row) => <ReportRow key={row.key} row={row} />)
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
