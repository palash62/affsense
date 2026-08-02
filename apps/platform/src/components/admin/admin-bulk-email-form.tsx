"use client";

import { useEffect, useMemo, useState } from "react";
import { Mail, Search, Send, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { EmailComposeEditor } from "@/components/advertiser/email/automation-builder/email-compose-editor";

type Recipient = {
  id: string;
  name: string;
  email: string;
  role: "ADVERTISER" | "PUBLISHER";
  status: string;
};

type AudienceRole = "ADVERTISER" | "PUBLISHER";

function htmlToPlainText(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isEmptyHtml(html: string) {
  return htmlToPlainText(html).length < 10;
}

export function AdminBulkEmailForm() {
  const [audience, setAudience] = useState<AudienceRole>("ADVERTISER");
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    recipientCount: number;
    sent: number;
    failed: number;
    skipped: number;
    notFound: number;
  } | null>(null);

  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingRecipients(true);
    setSelectedIds([]);
    fetch(`/api/v1/admin/bulk-email/recipients?role=${audience}`, {
      credentials: "same-origin",
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error?.message ?? "Unable to load recipients");
        }
        return (data?.data ?? []) as Recipient[];
      })
      .then((rows) => {
        if (!cancelled) setRecipients(rows);
      })
      .catch(() => {
        if (!cancelled) setRecipients([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingRecipients(false);
      });
    return () => {
      cancelled = true;
    };
  }, [audience]);

  const filteredRecipients = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return recipients;
    return recipients.filter(
      (user) =>
        user.name.toLowerCase().includes(term) || user.email.toLowerCase().includes(term),
    );
  }, [recipients, search]);

  const bodyReady = subject.trim().length >= 3 && !isEmptyHtml(message);
  const testEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testTo.trim());

  function toggleRecipient(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function selectAllVisible() {
    const visibleIds = filteredRecipients.map((user) => user.id);
    setSelectedIds((current) => Array.from(new Set([...current, ...visibleIds])));
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!bodyReady || selectedIds.length === 0) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/v1/admin/bulk-email", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userIds: selectedIds,
          subject: subject.trim(),
          message,
        }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.error?.message ?? "Unable to send email");
        return;
      }

      setResult(data.data);
    } catch {
      setError("Network error while sending. Some emails may still have been delivered — check email logs.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendTest() {
    if (!bodyReady || !testEmailValid) return;
    setTesting(true);
    setTestMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/v1/admin/bulk-email/test", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: testTo.trim(),
          subject: subject.trim(),
          message,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setTestMsg(data?.error?.message ?? "Test send failed");
        return;
      }
      setTestMsg(data?.message ?? "Test email sent");
    } catch {
      setTestMsg("Test send failed (network error)");
    } finally {
      setTesting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-6 rounded-[18px] border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Compose message</h2>
          <p className="mt-1 text-sm text-slate-500">
            Send a one-off email to one or more active advertisers or publishers.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {(["ADVERTISER", "PUBLISHER"] as const).map((role) => (
            <Button
              key={role}
              type="button"
              variant={audience === role ? "default" : "outline"}
              className={cn(
                "h-9 rounded-xl",
                audience === role && "bg-[var(--theme-primary)] hover:opacity-90",
              )}
              onClick={() => setAudience(role)}
            >
              {role === "ADVERTISER" ? "Advertisers" : "Publishers"}
            </Button>
          ))}
        </div>

        <div className="space-y-2">
          <Label htmlFor="subject">Subject</Label>
          <Input
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Email subject"
            required
            maxLength={200}
          />
        </div>

        <div className="space-y-2">
          <Label>Message</Label>
          <EmailComposeEditor value={message} onChange={setMessage} />
        </div>

        <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
          <Label htmlFor="testTo">Test email</Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id="testTo"
              type="email"
              value={testTo}
              onChange={(e) => {
                setTestTo(e.target.value);
                setTestMsg(null);
              }}
              placeholder="you@example.com"
              className="min-w-[200px] flex-1 bg-white"
            />
            <Button
              type="button"
              variant="outline"
              disabled={testing || !bodyReady || !testEmailValid}
              onClick={() => void handleSendTest()}
              className="gap-2"
            >
              <Mail className="h-4 w-4" />
              {testing ? "Sending…" : "Send test mail"}
            </Button>
          </div>
          {testMsg ? (
            <p
              className={cn(
                "text-xs",
                testMsg.toLowerCase().includes("fail") ? "text-red-600" : "text-emerald-700",
              )}
            >
              {testMsg}
            </p>
          ) : (
            <p className="text-xs text-slate-500">
              Sends the current subject and body to one address without selecting recipients.
            </p>
          )}
        </div>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {result && (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Sent to {result.sent} of {result.recipientCount} recipients
            {result.skipped > 0 ? ` · ${result.skipped} skipped (SMTP not configured)` : ""}
            {result.failed > 0 ? ` · ${result.failed} failed` : ""}
            {result.notFound > 0 ? ` · ${result.notFound} not found or inactive` : ""}
          </p>
        )}

        <Button
          type="submit"
          disabled={loading || selectedIds.length === 0 || !bodyReady}
          className="h-10 gap-2 rounded-xl bg-[var(--theme-primary)] hover:opacity-90"
        >
          <Send className="h-4 w-4" />
          {loading
            ? "Sending..."
            : `Send to ${selectedIds.length} recipient${selectedIds.length === 1 ? "" : "s"}`}
        </Button>
      </div>

      <div className="rounded-[18px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[var(--theme-primary)]" />
              <h3 className="font-semibold text-slate-900">Recipients</h3>
            </div>
            <Badge variant="outline">
              {selectedIds.length} selected · {recipients.length} total
            </Badge>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={selectAllVisible}>
              Select visible
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={clearSelection}>
              Clear
            </Button>
          </div>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${audience === "ADVERTISER" ? "advertisers" : "publishers"}...`}
              className="pl-9"
            />
          </div>
        </div>

        <div className="max-h-[520px] divide-y divide-slate-100 overflow-y-auto">
          {loadingRecipients ? (
            <p className="px-5 py-8 text-sm text-slate-500">Loading recipients...</p>
          ) : filteredRecipients.length === 0 ? (
            <p className="px-5 py-8 text-sm text-slate-500">No active recipients found.</p>
          ) : (
            filteredRecipients.map((user) => {
              const checked = selectedIds.includes(user.id);
              return (
                <label
                  key={user.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 px-5 py-3 hover:bg-slate-50",
                    checked && "bg-[var(--theme-primary-soft)]/40",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleRecipient(user.id)}
                    className="mt-1 rounded border-slate-300"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{user.name}</p>
                    <p className="truncate text-xs text-slate-500">{user.email}</p>
                  </div>
                  <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                </label>
              );
            })
          )}
        </div>
      </div>
    </form>
  );
}
