"use client";

import { formatUserDateTime } from "@/lib/user-timezone";
import { Ban, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { shortPublisherId } from "@/lib/advertiser-leads";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type BlockedPublisher = {
  publisherId: string;
  createdAt: Date | string;
};

export function AdvertiserBlockedPublishersTable({
  blockedPublishers,
  timezone,
}: {
  blockedPublishers: BlockedPublisher[];
  timezone?: string;
}) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function handleUnblock(publisherId: string) {
    setLoadingId(publisherId);
    try {
      const res = await fetch(
        `/api/v1/advertiser/publisher-blocks?publisherId=${encodeURIComponent(publisherId)}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setLoadingId(null);
    }
  }

  if (blockedPublishers.length === 0) {
    return (
      <p className="px-6 py-10 text-center text-sm text-slate-500">
        No blocked publishers. Block a publisher from the report above.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow
            className="border-none hover:bg-transparent"
            style={{ background: "var(--theme-primary-soft)" }}
          >
            <TableHead className="h-11 px-6 text-slate-600">Publisher ID</TableHead>
            <TableHead className="h-11 px-4 text-slate-600">Blocked on</TableHead>
            <TableHead className="h-11 px-6 text-right text-slate-600">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {blockedPublishers.map((block) => (
            <TableRow
              key={block.publisherId}
              className="border-slate-100 transition-colors hover:bg-blue-50/40"
            >
              <TableCell className="px-6 py-4 font-mono text-sm font-medium text-slate-800">
                {shortPublisherId(block.publisherId)}
              </TableCell>
              <TableCell className="px-4 py-4 text-sm text-slate-600">
                {formatUserDateTime(block.createdAt, timezone, "MMM d, yyyy HH:mm")}
              </TableCell>
              <TableCell className="px-6 py-4 text-right">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleUnblock(block.publisherId)}
                  disabled={loadingId === block.publisherId}
                  className="h-8 gap-1.5 border-red-200 text-red-700 hover:bg-red-50"
                >
                  {loadingId === block.publisherId ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Ban className="h-3.5 w-3.5" />
                  )}
                  Unblock
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
