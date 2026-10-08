"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatUsdCents, soloRequest } from "@/components/solo-ads/solo-ui";

export type SoloCampaignProviderRow = {
  publicCode: number;
  blocked: boolean;
  clicks: number;
  spendCents: number;
  leads: number;
  conversions: number;
  commissionCents: number;
};

export function SoloCampaignProviders({
  campaignId,
  rows,
  editable,
}: {
  campaignId: string;
  rows: SoloCampaignProviderRow[];
  editable: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);

  async function toggle(row: SoloCampaignProviderRow) {
    setBusy(row.publicCode);
    try {
      await soloRequest(`/api/v1/publisher/solo-ads/campaigns/${campaignId}/providers/${row.publicCode}/block`, {
        method: "PUT",
        body: { blocked: !row.blocked },
      });
      toast.success(row.blocked ? `Provider ${row.publicCode} allowed again` : `Provider ${row.publicCode} blocked`);
      router.refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Provider</TableHead>
          <TableHead className="text-right">Paid clicks</TableHead>
          <TableHead className="text-right">Spend</TableHead>
          <TableHead className="text-right">Leads</TableHead>
          <TableHead className="text-right">Sales</TableHead>
          <TableHead className="text-right">Commission</TableHead>
          <TableHead className="text-right">ROI</TableHead>
          {editable ? <TableHead /> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
              No providers available for this traffic type yet.
            </TableCell>
          </TableRow>
        ) : null}
        {rows.map((r) => {
          const roi = r.spendCents > 0 ? Math.round(((r.commissionCents - r.spendCents) / r.spendCents) * 100) : null;
          return (
            <TableRow key={r.publicCode} className={r.blocked ? "opacity-60" : ""}>
              <TableCell className="font-medium">
                Provider {r.publicCode}
                {r.blocked ? <span className="ml-2 text-xs text-red-600">Blocked</span> : null}
              </TableCell>
              <TableCell className="text-right tabular-nums">{r.clicks.toLocaleString()}</TableCell>
              <TableCell className="text-right tabular-nums">{formatUsdCents(r.spendCents)}</TableCell>
              <TableCell className="text-right tabular-nums">{r.leads.toLocaleString()}</TableCell>
              <TableCell className="text-right tabular-nums">{r.conversions.toLocaleString()}</TableCell>
              <TableCell className="text-right tabular-nums">{formatUsdCents(r.commissionCents)}</TableCell>
              <TableCell className={`text-right tabular-nums ${roi != null && roi < 0 ? "text-red-600" : "text-emerald-600"}`}>
                {roi == null ? "—" : `${roi}%`}
              </TableCell>
              {editable ? (
                <TableCell className="text-right">
                  <Button size="sm" variant="outline" disabled={busy === r.publicCode} onClick={() => toggle(r)}>
                    {r.blocked ? "Allow" : "Block"}
                  </Button>
                </TableCell>
              ) : null}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
