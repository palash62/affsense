import { formatUserDateTime } from "@/lib/user-timezone";
import { Filter, Download, Search } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import type { LeadStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

interface RecentLead {
  id: string;
  status: LeadStatus;
  createdAt: Date;
  campaign: { name: string };
  publisher: { name: string };
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const styles: Record<string, string> = {
    APPROVED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    PAID: "bg-cyan-50 text-cyan-700 ring-cyan-600/20",
    REJECTED: "bg-red-50 text-red-700 ring-red-600/20",
    PENDING: "bg-orange-50 text-orange-700 ring-orange-600/20",
  };

  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset",
        styles[status] ?? "bg-muted text-muted-foreground ring-slate-500/20",
      )}
    >
      {status.toLowerCase()}
    </span>
  );
}

const avatarColors = [
  "bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]",
  "bg-purple-100 text-purple-700",
  "bg-emerald-100 text-emerald-700",
  "bg-orange-100 text-orange-700",
];

export function AdminRecentLeadsTable({
  leads,
  timezone,
}: {
  leads: RecentLead[];
  timezone?: string;
}) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-border bg-card shadow-sm transition-shadow duration-300 hover:shadow-md">
      <div className="flex flex-col gap-4 border-b border-border px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">Recent Leads</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">Latest submissions across all campaigns</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search leads..."
              className="h-9 w-44 rounded-lg border-border bg-muted pl-8 text-sm"
              readOnly
              aria-hidden
            />
          </div>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-lg border-border">
            <Filter className="h-3.5 w-3.5" />
            Filter
          </Button>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-lg border-border">
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
        </div>
      </div>

      {leads.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-muted-foreground">No leads yet</p>
      ) : (
        <div className="max-h-[420px] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm">
              <TableRow className="border-border hover:bg-muted/95">
                <TableHead className="h-10 px-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Publisher
                </TableHead>
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Campaign
                </TableHead>
                <TableHead className="h-10 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Status
                </TableHead>
                <TableHead className="h-10 px-6 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Date
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead, i) => (
                <TableRow
                  key={lead.id}
                  className="border-border transition-colors duration-150 hover:bg-blue-50/40"
                >
                  <TableCell className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar size="sm">
                        <AvatarFallback
                          className={cn(
                            "text-xs font-semibold",
                            avatarColors[i % avatarColors.length],
                          )}
                        >
                          {getInitials(lead.publisher.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-foreground">{lead.publisher.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3.5 text-muted-foreground">{lead.campaign.name}</TableCell>
                  <TableCell className="px-4 py-3.5">
                    <LeadStatusBadge status={lead.status} />
                  </TableCell>
                  <TableCell className="px-6 py-3.5 text-right text-sm text-muted-foreground">
                    {formatUserDateTime(lead.createdAt, timezone, "MMM d, yyyy")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
