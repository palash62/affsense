"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { formatUserDateTime } from "@/lib/user-timezone";
import { useSession } from "next-auth/react";
import {
  ChevronDown,
  ChevronRight,
  Clock,
  MessageSquare,
  Ticket,
  Users,
  XCircle,
} from "lucide-react";
import { GradientStatCard, NeutralStatCard } from "@/components/admin/gradient-stat-card";
import { avatarColors, getInitials } from "@/components/admin/admin-ui";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TicketConversation } from "@/components/support/ticket-conversation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatTicketStatus,
  SUPPORT_CATEGORY_LABELS,
  SUPPORT_STATUS_STYLES,
  truncateTicketMessage,
} from "@/lib/support-tickets";
import { cn } from "@/lib/utils";

interface TicketMessage {
  id: string;
  body: string;
  createdAt: string;
  sender?: { name: string; role: string };
}

interface SupportTicket {
  id: string;
  subject: string;
  category: string;
  status: string;
  createdAt: string;
  user?: { name: string; email: string; role: string };
  messages?: TicketMessage[];
}

export function AdminSupportTicketsPanel() {
  const { data: session } = useSession();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);

  const stats = useMemo(() => {
    const open = tickets.filter((t) => t.status === "OPEN").length;
    const inProgress = tickets.filter((t) => t.status === "IN_PROGRESS").length;
    const closed = tickets.filter((t) => t.status === "CLOSED").length;
    return { total: tickets.length, open, inProgress, closed };
  }, [tickets]);

  async function load() {
    const res = await fetch("/api/v1/support/tickets");
    const data = await res.json();
    setTickets(data.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function sendReply(ticketId: string) {
    if (!replyBody.trim()) return;
    setSending(true);
    setReplyError(null);

    const res = await fetch("/api/v1/support/tickets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId, body: replyBody.trim() }),
    });
    const data = await res.json();

    setSending(false);

    if (!res.ok) {
      setReplyError(data?.error?.message ?? "Unable to send reply");
      return;
    }

    setReplyBody("");
    setReplyingId(null);
    setExpandedId(ticketId);
    load();
  }

  async function closeTicket(ticketId: string) {
    if (!window.confirm("Close this support ticket? The user will be notified.")) {
      return;
    }

    setClosingId(ticketId);
    setCloseError(null);

    const res = await fetch("/api/v1/support/tickets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId, action: "close" }),
    });
    const data = await res.json();

    setClosingId(null);

    if (!res.ok) {
      setCloseError(data?.error?.message ?? "Unable to close ticket");
      return;
    }

    setReplyingId(null);
    setReplyBody("");
    setReplyError(null);
    setExpandedId(ticketId);
    load();
  }

  function toggleExpand(ticketId: string) {
    setExpandedId((current) => (current === ticketId ? null : ticketId));
    setReplyingId(null);
    setReplyBody("");
    setReplyError(null);
    setCloseError(null);
  }

  if (loading) {
    return <p className="text-muted-foreground">Loading tickets...</p>;
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <GradientStatCard variant="leads" label="All Tickets" value={stats.total} icon={Ticket} />
        <NeutralStatCard label="Open" value={stats.open} icon={MessageSquare} accent="orange" />
        <NeutralStatCard label="In Progress" value={stats.inProgress} icon={Clock} accent="purple" />
        <NeutralStatCard label="Closed" value={stats.closed} icon={XCircle} accent="green" />
      </div>

      <div className="overflow-hidden rounded-[var(--radius-card,0.875rem)] border border-border bg-card shadow-[var(--shadow-card)]">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent bg-muted/60">
                <TableHead className="h-11 w-10 px-4" />
                <TableHead className="h-11 px-4 text-muted-foreground">User</TableHead>
                <TableHead className="h-11 px-4 text-muted-foreground">Subject</TableHead>
                <TableHead className="h-11 px-4 text-muted-foreground">Category</TableHead>
                <TableHead className="h-11 px-4 text-muted-foreground">Status</TableHead>
                <TableHead className="h-11 px-4 text-muted-foreground">Last Message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="px-6 py-16 text-center text-muted-foreground">
                    No support tickets yet
                  </TableCell>
                </TableRow>
              ) : (
                tickets.map((ticket, index) => {
                  const lastMessage = ticket.messages?.[ticket.messages.length - 1];
                  const isExpanded = expandedId === ticket.id;
                  const isClosed = ticket.status === "CLOSED";

                  return (
                    <Fragment key={ticket.id}>
                      <TableRow
                        className="cursor-pointer border-border transition-colors hover:bg-muted/40"
                        onClick={() => toggleExpand(ticket.id)}
                      >
                        <TableCell className="px-4 py-4">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-4">
                          {ticket.user && (
                            <div className="flex items-center gap-3">
                              <Avatar size="sm">
                                <AvatarFallback
                                  className={cn(
                                    "text-xs font-semibold",
                                    avatarColors[index % avatarColors.length],
                                  )}
                                >
                                  {getInitials(ticket.user.name)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm font-medium text-foreground">{ticket.user.name}</p>
                                <p className="text-xs text-muted-foreground">{ticket.user.email}</p>
                              </div>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-4 font-medium text-foreground">
                          {ticket.subject}
                        </TableCell>
                        <TableCell className="px-4 py-4">
                          <Badge variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700">
                            {SUPPORT_CATEGORY_LABELS[ticket.category] ?? ticket.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 py-4">
                          <Badge
                            variant="outline"
                            className={SUPPORT_STATUS_STYLES[ticket.status] ?? "border-border bg-muted text-muted-foreground"}
                          >
                            {formatTicketStatus(ticket.status)}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs px-4 py-4 text-sm text-muted-foreground">
                          {lastMessage
                            ? truncateTicketMessage(lastMessage.body, 60)
                            : "—"}
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={6} className="bg-muted/60 px-6 py-5">
                            <div onClick={(e) => e.stopPropagation()}>
                              <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <Users className="h-3.5 w-3.5" />
                                <span>
                                  {ticket.user?.name} · {ticket.user?.role} ·{" "}
                                  {formatUserDateTime(ticket.createdAt, session?.user?.timezone, "MMM d, yyyy")}
                                </span>
                              </div>
                              {closeError && expandedId === ticket.id && (
                                <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                  {closeError}
                                </p>
                              )}
                              {replyError && (
                                <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                  {replyError}
                                </p>
                              )}
                              <TicketConversation
                                messages={ticket.messages ?? []}
                                replyBody={replyBody}
                                onReplyBodyChange={setReplyBody}
                                onSendReply={() => sendReply(ticket.id)}
                                onCancelReply={() => {
                                  setReplyingId(null);
                                  setReplyBody("");
                                  setReplyError(null);
                                }}
                                showReplyForm={replyingId === ticket.id}
                                onStartReply={() => {
                                  setReplyingId(ticket.id);
                                  setReplyBody("");
                                  setReplyError(null);
                                }}
                                sendingReply={sending}
                                replyLabel="Admin reply to user"
                                allowReply={!isClosed}
                                closedMessage="This ticket is closed."
                                hideReplyTrigger
                              />
                              {!isClosed && (
                                <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setReplyingId(ticket.id);
                                      setReplyBody("");
                                      setReplyError(null);
                                    }}
                                  >
                                    Reply
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1.5 border-border text-foreground hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                                    disabled={closingId === ticket.id}
                                    onClick={() => closeTicket(ticket.id)}
                                  >
                                    <XCircle className="h-3.5 w-3.5" />
                                    {closingId === ticket.id ? "Closing..." : "Close Ticket"}
                                  </Button>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
