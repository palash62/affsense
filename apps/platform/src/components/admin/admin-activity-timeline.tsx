import { formatDistanceToNow } from "date-fns";
import {
  CheckCircle2,
  Clock,
  FileText,
  XCircle,
  DollarSign,
  MessageSquare,
} from "lucide-react";
import type { LeadStatus } from "@prisma/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface ActivityLead {
  id: string;
  status: LeadStatus;
  createdAt: Date;
  campaign: { name: string };
  publisher: { name: string };
}

interface ActivityTimelineProps {
  recentLeads: ActivityLead[];
  pendingPayouts: number;
  openTickets: number;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function statusConfig(status: LeadStatus) {
  const map: Record<string, { icon: typeof CheckCircle2; color: string; bg: string }> = {
    APPROVED: { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
    PAID: { icon: DollarSign, color: "text-cyan-600", bg: "bg-cyan-50" },
    REJECTED: { icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
    PENDING: { icon: Clock, color: "text-orange-600", bg: "bg-orange-50" },
  };
  return map[status] ?? { icon: FileText, color: "text-muted-foreground", bg: "bg-muted" };
}

export function AdminActivityTimeline({
  recentLeads,
  pendingPayouts,
  openTickets,
}: ActivityTimelineProps) {
  const systemEvents = [
    pendingPayouts > 0 && {
      id: "payouts",
      title: `${pendingPayouts} payout${pendingPayouts > 1 ? "s" : ""} awaiting review`,
      icon: DollarSign,
      color: "text-[var(--theme-primary)]",
      bg: "bg-[var(--theme-primary-soft)]",
    },
    openTickets > 0 && {
      id: "tickets",
      title: `${openTickets} open support ticket${openTickets > 1 ? "s" : ""}`,
      icon: MessageSquare,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
  ].filter(Boolean) as Array<{
    id: string;
    title: string;
    icon: typeof DollarSign;
    color: string;
    bg: string;
  }>;

  return (
    <div className="rounded-[18px] border border-border bg-card p-6 shadow-sm transition-shadow duration-300 hover:shadow-md">
      <div className="mb-5">
        <h3 className="text-base font-semibold text-foreground">Activity Timeline</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">Recent platform events</p>
      </div>

      <div className="space-y-0.5">
        {systemEvents.map((event) => {
          const Icon = event.icon;
          return (
            <div
              key={event.id}
              className="group flex gap-3.5 rounded-xl p-2.5 transition-colors duration-150 hover:bg-muted"
            >
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                  event.bg,
                )}
              >
                <Icon className={cn("h-4 w-4", event.color)} />
              </div>
              <div className="min-w-0 flex-1 pb-3">
                <p className="text-sm font-medium text-foreground">{event.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Requires attention</p>
              </div>
            </div>
          );
        })}

        {recentLeads.map((lead) => {
          const config = statusConfig(lead.status);
          const Icon = config.icon;

          return (
            <div
              key={lead.id}
              className="group flex gap-3.5 rounded-xl p-2.5 transition-colors duration-150 hover:bg-muted"
            >
              <Avatar size="sm">
                <AvatarFallback className={cn("text-xs font-semibold", config.bg, config.color)}>
                  {getInitials(lead.publisher.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      New lead on{" "}
                      <span className="text-[var(--theme-primary)]">{lead.campaign.name}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">by {lead.publisher.name}</p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                      config.bg,
                      config.color,
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {lead.status.toLowerCase()}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(lead.createdAt), { addSuffix: true })}
                </p>
              </div>
            </div>
          );
        })}

        {recentLeads.length === 0 && systemEvents.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">No recent activity</p>
        )}
      </div>
    </div>
  );
}
