"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { formatUserDateTime } from "@/lib/user-timezone";
import { useSession } from "next-auth/react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  LifeBuoy,
  MessageSquarePlus,
  Ticket,
} from "lucide-react";
import { GradientStatCard, NeutralStatCard } from "@/components/admin/gradient-stat-card";
import { PageSection } from "@/components/admin/page-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  updatedAt: string;
  messages?: TicketMessage[];
}

export function SupportTicketsPanel() {
  const { data: session } = useSession();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("GENERAL");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [sendingReply, setSendingReply] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  const stats = useMemo(() => {
    const open = tickets.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS").length;
    const resolved = tickets.filter((t) => t.status === "RESOLVED" || t.status === "CLOSED").length;
    const withAdminReply = tickets.filter((t) =>
      t.messages?.some((m) => m.sender?.role === "ADMIN"),
    ).length;
    return { total: tickets.length, open, resolved, withAdminReply };
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

  async function createTicket(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const payload = {
      subject: subject.trim(),
      category: category.trim().toUpperCase(),
      body: body.trim(),
    };

    const res = await fetch("/api/v1/support/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data?.error?.message ?? "Unable to create support ticket");
      setSubmitting(false);
      return;
    }

    setSubject("");
    setBody("");
    setCategory("GENERAL");
    setSuccess("Support ticket created successfully.");
    setSubmitting(false);
    load();
  }

  async function sendReply(ticketId: string) {
    if (!replyBody.trim()) return;
    setSendingReply(true);
    setReplyError(null);

    const res = await fetch("/api/v1/support/tickets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticketId, body: replyBody.trim() }),
    });
    const data = await res.json();

    setSendingReply(false);

    if (!res.ok) {
      setReplyError(data?.error?.message ?? "Unable to send reply");
      return;
    }

    setReplyBody("");
    setReplyingId(null);
    setExpandedId(ticketId);
    load();
  }

  function toggleExpand(ticketId: string) {
    setExpandedId((current) => (current === ticketId ? null : ticketId));
    setReplyingId(null);
    setReplyBody("");
    setReplyError(null);
  }

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-[18px] bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <GradientStatCard variant="leads" label="Total Tickets" value={stats.total} icon={Ticket} />
        <NeutralStatCard label="Open / In Progress" value={stats.open} icon={Clock} accent="orange" />
        <NeutralStatCard label="Resolved" value={stats.resolved} icon={CheckCircle2} accent="green" />
        <GradientStatCard
          variant="approved"
          label="Support Replies"
          value={stats.withAdminReply}
          icon={LifeBuoy}
        />
      </div>

      <div id="new-ticket" className="scroll-mt-24">
        <PageSection
          title="New Ticket"
          description="Describe your issue and our support team will get back to you"
          icon={MessageSquarePlus}
          gradient="leads"
        >
          <form onSubmit={createTicket} className="space-y-4 p-6">
            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}
            {success && (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {success}
              </p>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  minLength={3}
                  required
                  placeholder="Brief summary of your issue"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <select
                  id="category"
                  name="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={cn(
                    "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground shadow-sm outline-none",
                    "focus:border-[var(--theme-primary)] focus:ring-2 focus:ring-[var(--theme-primary)]/15",
                  )}
                >
                  <option value="GENERAL">General</option>
                  <option value="BILLING">Billing</option>
                  <option value="TECHNICAL">Technical</option>
                  <option value="CAMPAIGN">Campaign</option>
                  <option value="PAYOUT">Payout</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="body">Message</Label>
              <textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                minLength={10}
                required
                rows={4}
                className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-[var(--theme-primary)] focus:ring-2 focus:ring-[var(--theme-primary)]/15"
                placeholder="Describe your issue in detail..."
              />
              <p className="text-xs text-muted-foreground">Minimum 10 characters</p>
            </div>
            <Button
              type="submit"
              disabled={submitting}
              className="h-10 rounded-xl bg-[var(--theme-primary)] px-6 hover:opacity-90"
            >
              {submitting ? "Submitting..." : "Submit Ticket"}
            </Button>
          </form>
        </PageSection>
      </div>

      <PageSection
        title="My Tickets"
        description="Click a ticket to view the full conversation and admin replies"
        icon={LifeBuoy}
        gradient="approved"
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow
                className="border-none hover:bg-transparent"
                style={{ background: "var(--theme-primary-soft)" }}
              >
                <TableHead className="h-11 w-10 px-4" />
                <TableHead className="h-11 px-4 text-muted-foreground">Date</TableHead>
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
                    No tickets yet. Create one above to get help from our support team.
                  </TableCell>
                </TableRow>
              ) : (
                tickets.map((ticket) => {
                  const lastMessage = ticket.messages?.[ticket.messages.length - 1];
                  const hasAdminReply = ticket.messages?.some((m) => m.sender?.role === "ADMIN");
                  const isExpanded = expandedId === ticket.id;
                  const isClosed = ticket.status === "CLOSED";

                  return (
                    <Fragment key={ticket.id}>
                      <TableRow
                        className="cursor-pointer border-border transition-colors hover:bg-blue-50/40"
                        onClick={() => toggleExpand(ticket.id)}
                      >
                        <TableCell className="px-4 py-4">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-4 text-sm text-muted-foreground">
                          {formatUserDateTime(ticket.createdAt, session?.user?.timezone, "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{ticket.subject}</span>
                            {hasAdminReply && !isExpanded && (
                              <span className="rounded-full bg-[var(--theme-primary-soft)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--theme-primary)]">
                                Replied
                              </span>
                            )}
                          </div>
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
                          {lastMessage ? (
                            <>
                              <span className="font-medium text-foreground">
                                {lastMessage.sender?.role === "ADMIN" ? "Support: " : "You: "}
                              </span>
                              {truncateTicketMessage(lastMessage.body, 60)}
                            </>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow className="hover:bg-transparent">
                          <TableCell colSpan={6} className="bg-muted/60 px-6 py-5">
                            <div onClick={(e) => e.stopPropagation()}>
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
                                sendingReply={sendingReply}
                                allowReply={!isClosed}
                              />
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
      </PageSection>
    </div>
  );
}
