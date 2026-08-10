"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  Copy,
  Globe,
  Loader2,
  Plus,
  RefreshCw,
  Star,
  Trash2,
  Wrench,
} from "lucide-react";
import { PageSection } from "@/components/admin/page-section";
import { EmailModuleShell } from "../email-module-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type DnsRecord = {
  type: "CNAME" | "TXT" | "MX";
  name: string;
  value: string;
  purpose: "DKIM" | "SPF" | "DMARC" | "TRACKING" | "MX";
};

type MailboxRow = {
  id: string;
  email: string;
  fromName: string | null;
  isDefault: boolean;
};

type IdentityRow = {
  id: string;
  domain: string;
  fromEmail: string;
  fromName: string;
  verificationStatus: string;
  isDefault: boolean;
  dkimTokens: string[];
  provider?: string;
  ready: boolean;
  dkimReady: boolean;
  spfReady: boolean;
  dmarcReady: boolean;
  dnsRecords: DnsRecord[];
  mailboxes?: MailboxRow[];
};

function StatusIcon({ ready, instructional }: { ready: boolean; instructional?: boolean }) {
  if (instructional) {
    return <Circle className="h-5 w-5 text-muted-foreground" aria-label="Add DNS record" />;
  }
  if (ready) {
    return <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-label="Ready" />;
  }
  return <AlertCircle className="h-5 w-5 text-red-500" aria-label="Not ready" />;
}

function verificationLabel(status: string): { label: string; className: string; Icon: typeof Clock } {
  switch (status) {
    case "VERIFIED":
      return {
        label: "Success",
        className: "border-emerald-200 bg-emerald-50 text-emerald-800",
        Icon: CheckCircle2,
      };
    case "FAILED":
      return {
        label: "Failed",
        className: "border-red-200 bg-red-50 text-red-800",
        Icon: AlertCircle,
      };
    default:
      return {
        label: "Pending",
        className: "border-amber-200 bg-amber-50 text-amber-900",
        Icon: Clock,
      };
  }
}

export function EmailDomainsPanel() {
  const [rows, setRows] = useState<IdentityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [domain, setDomain] = useState("");
  const [fromName, setFromName] = useState("");
  const [fromLocal, setFromLocal] = useState("noreply");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [setupRow, setSetupRow] = useState<IdentityRow | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [addLocalByIdentity, setAddLocalByIdentity] = useState<Record<string, string>>(
    {},
  );
  const [mailboxBusy, setMailboxBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/advertiser/email/identities", {
        credentials: "same-origin",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error?.message ?? "Unable to load domains");
        setRows([]);
        return;
      }
      setRows((json.data ?? []) as IdentityRow[]);
      setSetupRow((prev) => {
        if (!prev) return prev;
        const next = ((json.data ?? []) as IdentityRow[]).find((r) => r.id === prev.id);
        return next ?? prev;
      });
      setError(null);
    } catch {
      setError("Unable to load domains");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    fetch("/api/v1/advertiser/email/provider")
      .then((r) => r.json())
      .then((d) => setProvider(d.data?.marketingProvider ?? null))
      .catch(() => setProvider(null));
  }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const normalizedDomain = domain.trim().toLowerCase();
    const local = fromLocal.trim().toLowerCase() || "noreply";
    if (!normalizedDomain || fromName.trim().length < 2) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/advertiser/email/identities", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: normalizedDomain,
          fromName: fromName.trim(),
          fromEmail: `${local}@${normalizedDomain}`,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error?.message ?? "Unable to add domain");
        return;
      }
      setAddOpen(false);
      setDomain("");
      setFromName("");
      setFromLocal("noreply");
      await load();
      if (json.data) {
        setSetupRow(json.data as IdentityRow);
      }
    } catch {
      setError("Unable to add domain");
    } finally {
      setSaving(false);
    }
  }

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function patchMailbox(body: Record<string, unknown>) {
    const res = await fetch("/api/v1/advertiser/email/identities", {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(json?.error?.message ?? "Mailbox update failed");
    }
    await load();
    return json.data as IdentityRow | undefined;
  }

  async function addMailbox(row: IdentityRow) {
    const local = (addLocalByIdentity[row.id] ?? "").trim().toLowerCase();
    if (!local) {
      setError("Enter a local part for the sending email");
      return;
    }
    setMailboxBusy(row.id);
    setError(null);
    try {
      await patchMailbox({
        action: "addMailbox",
        identityId: row.id,
        fromEmail: `${local}@${row.domain}`,
      });
      setAddLocalByIdentity((prev) => ({ ...prev, [row.id]: "" }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to add sending email");
    } finally {
      setMailboxBusy(null);
    }
  }

  async function removeMailbox(identityId: string, mailboxId: string) {
    setMailboxBusy(mailboxId);
    setError(null);
    try {
      await patchMailbox({
        action: "removeMailbox",
        identityId,
        mailboxId,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to remove sending email");
    } finally {
      setMailboxBusy(null);
    }
  }

  async function setDefaultMailbox(identityId: string, mailboxId: string) {
    setMailboxBusy(mailboxId);
    setError(null);
    try {
      await patchMailbox({
        action: "setDefaultMailbox",
        identityId,
        mailboxId,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to set default email");
    } finally {
      setMailboxBusy(null);
    }
  }

  async function refreshIdentity(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch("/api/v1/advertiser/email/identities", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "refresh", identityId: id }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error?.message ?? "Verification refresh failed");
        return;
      }
      await load();
      if (setupRow?.id === id && json.data) {
        setSetupRow(json.data as IdentityRow);
      }
    } catch {
      setError("Verification refresh failed");
    } finally {
      setBusyId(null);
    }
  }

  async function setDefault(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch("/api/v1/advertiser/email/identities", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setDefault", identityId: id }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error?.message ?? "Unable to set default domain");
        return;
      }
      await load();
    } catch {
      setError("Unable to set default domain");
    } finally {
      setBusyId(null);
    }
  }

  async function removeIdentity(row: IdentityRow) {
    if (!window.confirm(`Remove sending domain “${row.domain}”?`)) return;
    setBusyId(row.id);
    setError(null);
    try {
      const res = await fetch(`/api/v1/advertiser/email/identities/${row.id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error?.message ?? "Unable to remove domain");
        return;
      }
      if (setupRow?.id === row.id) setSetupRow(null);
      await load();
    } catch {
      setError("Unable to remove domain");
    } finally {
      setBusyId(null);
    }
  }

  async function copyText(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <EmailModuleShell
      title="Domain"
      description="Add and verify a domain you own for branded autoresponder sending."
      breadcrumbs={[
        { label: "Autoresponder", href: "/advertiser/email" },
        { label: "Domain" },
      ]}
      showToolbar={false}
    >
      {provider === "mailgun" ? (
        <p className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Sending via Mailgun. Add your domain (subdomain recommended, e.g.{" "}
          <span className="font-mono">mg.yourbrand.com</span>), publish the DNS records, then Refresh
          until Ready.
        </p>
      ) : provider ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Custom domain verification needs Mailgun configured by a platform admin.
        </p>
      ) : null}

      <PageSection title="Domains" icon={Globe} gradient="leads">
        <div className="flex items-center justify-end border-b border-border px-6 py-3">
          <Button
            type="button"
            onClick={() => {
              setError(null);
              setAddOpen(true);
            }}
            className="h-9 gap-2 rounded-xl bg-[var(--theme-primary)] hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Add Domain
          </Button>
        </div>

        {error ? (
          <p className="mx-6 mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Ready for use</TableHead>
                <TableHead className="text-center">DKIM</TableHead>
                <TableHead className="text-center">SPF</TableHead>
                <TableHead className="text-center">DMARC</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    No sending domains yet. Add an existing domain you own.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => {
                  const status = verificationLabel(row.verificationStatus);
                  const StatusGlyph = status.Icon;
                  const isVerified = row.verificationStatus === "VERIFIED" || row.ready;
                  const expanded = expandedIds.has(row.id);
                  const mailboxes =
                    row.mailboxes && row.mailboxes.length > 0
                      ? row.mailboxes
                      : [
                          {
                            id: `${row.id}-legacy`,
                            email: row.fromEmail,
                            fromName: row.fromName,
                            isDefault: true,
                          },
                        ];
                  return (
                    <Fragment key={row.id}>
                      <TableRow className="hover:bg-muted">
                        <TableCell>
                          <div className="flex items-start gap-1.5">
                            {isVerified ? (
                              <button
                                type="button"
                                className="mt-0.5 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                                aria-expanded={expanded}
                                aria-label={
                                  expanded
                                    ? `Collapse sending emails for ${row.domain}`
                                    : `Expand sending emails for ${row.domain}`
                                }
                                onClick={() => toggleExpanded(row.id)}
                              >
                                {expanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </button>
                            ) : (
                              <span className="mt-0.5 inline-block w-5" aria-hidden />
                            )}
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-medium text-foreground">{row.domain}</span>
                                {row.isDefault ? (
                                  <Badge variant="outline" className="text-xs">
                                    Default
                                  </Badge>
                                ) : null}
                              </div>
                              <p className="text-xs text-muted-foreground">{row.fromEmail}</p>
                              {isVerified ? (
                                <p className="mt-0.5 text-[11px] text-muted-foreground">
                                  {mailboxes.length} sending email
                                  {mailboxes.length === 1 ? "" : "s"}
                                  {!expanded ? " · expand to manage" : ""}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant="outline"
                            className={cn("gap-1 text-xs font-medium", status.className)}
                          >
                            <StatusGlyph className="h-3.5 w-3.5" aria-hidden />
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <StatusIcon ready={row.ready} />
                            <span className="text-xs text-muted-foreground">
                              {row.ready ? "Yes" : "No"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center">
                            <StatusIcon ready={row.dkimReady} />
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center">
                            <StatusIcon
                              ready={row.spfReady}
                              instructional={row.provider !== "mailgun"}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center">
                            <StatusIcon
                              ready={row.dmarcReady}
                              instructional={row.provider !== "mailgun"}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              aria-label={`DNS setup for ${row.domain}`}
                              onClick={() => setSetupRow(row)}
                            >
                              <Wrench className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              aria-label={`Refresh ${row.domain}`}
                              disabled={busyId === row.id}
                              onClick={() => void refreshIdentity(row.id)}
                            >
                              {busyId === row.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <RefreshCw className="h-4 w-4" />
                              )}
                            </Button>
                            {row.ready && !row.isDefault ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                aria-label={`Set ${row.domain} as default`}
                                disabled={busyId === row.id}
                                onClick={() => void setDefault(row.id)}
                              >
                                <Star className="h-4 w-4" />
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                              aria-label={`Remove ${row.domain}`}
                              disabled={busyId === row.id}
                              onClick={() => void removeIdentity(row)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      {isVerified && expanded ? (
                        <TableRow className="bg-muted/80 hover:bg-muted/80">
                          <TableCell colSpan={7} className="px-6 py-4">
                            <div className="ml-6 space-y-3">
                              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Sending emails for @{row.domain}
                              </p>
                              <ul className="divide-y divide-slate-200 rounded-lg border border-border bg-card">
                                {mailboxes.map((m) => (
                                  <li
                                    key={m.id}
                                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
                                  >
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="font-mono text-foreground">{m.email}</span>
                                      {m.isDefault ? (
                                        <Badge
                                          variant="outline"
                                          className="border-emerald-200 bg-emerald-50 text-emerald-800 text-xs"
                                        >
                                          Default
                                        </Badge>
                                      ) : null}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      {!m.isDefault ? (
                                        <Button
                                          type="button"
                                          variant="ghost"
                                          size="sm"
                                          className="h-8 px-2 text-xs"
                                          disabled={
                                            mailboxBusy === m.id ||
                                            mailboxBusy === row.id ||
                                            m.id.endsWith("-legacy")
                                          }
                                          onClick={() =>
                                            void setDefaultMailbox(row.id, m.id)
                                          }
                                        >
                                          {mailboxBusy === m.id ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                          ) : (
                                            "Set default"
                                          )}
                                        </Button>
                                      ) : null}
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                        aria-label={`Remove ${m.email}`}
                                        disabled={
                                          mailboxes.length <= 1 ||
                                          mailboxBusy === m.id ||
                                          mailboxBusy === row.id ||
                                          m.id.endsWith("-legacy")
                                        }
                                        onClick={() =>
                                          void removeMailbox(row.id, m.id)
                                        }
                                      >
                                        {mailboxBusy === m.id ? (
                                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                          <Trash2 className="h-3.5 w-3.5" />
                                        )}
                                      </Button>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                              <div className="flex flex-wrap items-center gap-2">
                                <Input
                                  value={addLocalByIdentity[row.id] ?? ""}
                                  onChange={(e) =>
                                    setAddLocalByIdentity((prev) => ({
                                      ...prev,
                                      [row.id]: e.target.value
                                        .replace(/@.*/, "")
                                        .toLowerCase(),
                                    }))
                                  }
                                  placeholder="hello"
                                  className="h-9 max-w-[200px] bg-white"
                                  disabled={mailboxBusy === row.id}
                                />
                                <span className="text-sm text-muted-foreground">@{row.domain}</span>
                                <Button
                                  type="button"
                                  size="sm"
                                  className="h-9 gap-1.5 bg-[var(--theme-primary)] hover:opacity-90"
                                  disabled={
                                    mailboxBusy === row.id ||
                                    !(addLocalByIdentity[row.id] ?? "").trim()
                                  }
                                  onClick={() => void addMailbox(row)}
                                >
                                  {mailboxBusy === row.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Plus className="h-3.5 w-3.5" />
                                  )}
                                  Add
                                </Button>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        <p className="border-t border-border px-6 py-3 text-xs text-muted-foreground">
          {provider === "mailgun"
            ? "Add the SPF, DKIM, and tracking records Mailgun shows, then click Refresh. DKIM / SPF / DMARC ticks update from Mailgun after DNS propagates."
            : "SPF and DMARC show as setup guidance. Ready / DKIM update after you add the provider DNS records and click Refresh."}
        </p>
      </PageSection>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <form onSubmit={handleAdd} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Add a Domain</DialogTitle>
              <DialogDescription>
                Add a domain you own. A subdomain like mg.yourcompany.com is recommended for email
                sending.
              </DialogDescription>
            </DialogHeader>

            <button
              type="button"
              className={cn(
                "flex w-full items-start gap-3 rounded-xl border border-border bg-muted/80 p-4 text-left",
                "ring-2 ring-[var(--theme-primary)]",
              )}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-card shadow-sm">
                <Plus className="h-5 w-5 text-[var(--theme-primary)]" />
              </span>
              <span>
                <span className="block font-semibold text-foreground">Add an existing domain</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  Connect DNS at your registrar, then verify
                  {provider === "mailgun" ? " with Mailgun." : "."}
                </span>
              </span>
            </button>

            <div className="space-y-2">
              <Label htmlFor="email-domain">Domain</Label>
              <Input
                id="email-domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="mg.yourcompany.com"
                required
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-from-name">From name</Label>
              <Input
                id="email-from-name"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="Your brand"
                required
                minLength={2}
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-from-local">Sending email</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="email-from-local"
                  value={fromLocal}
                  onChange={(e) =>
                    setFromLocal(e.target.value.replace(/@.*/, "").toLowerCase())
                  }
                  placeholder="noreply"
                  required
                  disabled={saving}
                  className="min-w-0 flex-1"
                />
                <span className="shrink-0 text-sm text-muted-foreground">
                  @{domain.trim().toLowerCase() || "your-domain.com"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Must use this domain. After verification, expand the domain row to add more
                sending addresses.
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving || !domain.trim() || fromName.trim().length < 2}
                className="gap-2 bg-[var(--theme-primary)] hover:opacity-90"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {saving ? "Adding…" : "Continue"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Sheet
        open={Boolean(setupRow)}
        onOpenChange={(open) => {
          if (!open) setSetupRow(null);
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>DNS setup — {setupRow?.domain}</SheetTitle>
            <SheetDescription>
              Add these records at your DNS provider, then click Refresh to verify
              {provider === "mailgun" ? " with Mailgun" : ""}.
              After the domain is verified, manage sending emails by expanding the domain row.
            </SheetDescription>
          </SheetHeader>

          {setupRow ? (
            <div className="mt-6 space-y-6 px-1">
              <div className="flex flex-wrap items-center gap-2">
                {(() => {
                  const sheetStatus = verificationLabel(setupRow.verificationStatus);
                  return (
                    <Badge
                      variant="outline"
                      className={cn("gap-1 text-xs font-medium", sheetStatus.className)}
                    >
                      {sheetStatus.label}
                    </Badge>
                  );
                })()}
                {setupRow.isDefault ? <Badge variant="outline">Default</Badge> : null}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  disabled={busyId === setupRow.id}
                  onClick={() => void refreshIdentity(setupRow.id)}
                >
                  {busyId === setupRow.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Refresh
                </Button>
              </div>

              {(["DKIM", "SPF", "DMARC", "TRACKING", "MX"] as const).map((purpose) => {
                const records = setupRow.dnsRecords.filter((r) => r.purpose === purpose);
                if (records.length === 0) return null;
                const purposeHelp: Record<typeof purpose, string> = {
                  DKIM: "Required for authentication (DKIM).",
                  SPF: "Required TXT so receivers trust sends from this domain.",
                  DMARC: "Recommended policy record for deliverability.",
                  TRACKING: "Optional CNAME for open/click tracking.",
                  MX: "Required by Mailgun if shown — used for inbound on this domain.",
                };
                return (
                  <div key={purpose} className="space-y-2">
                    <h3 className="text-sm font-semibold text-foreground">{purpose}</h3>
                    <p className="text-xs text-muted-foreground">{purposeHelp[purpose]}</p>
                    <div className="space-y-2">
                      {records.map((rec, idx) => {
                        const key = `${rec.purpose}-${rec.name}-${idx}`;
                        return (
                          <div
                            key={key}
                            className="rounded-lg border border-border bg-muted/80 p-3 text-xs"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 space-y-1 font-mono break-all text-foreground">
                                <p>
                                  <span className="font-sans font-medium text-muted-foreground">
                                    Type:{" "}
                                  </span>
                                  {rec.type}
                                </p>
                                <p>
                                  <span className="font-sans font-medium text-muted-foreground">
                                    Name:{" "}
                                  </span>
                                  {rec.name}
                                </p>
                                <p>
                                  <span className="font-sans font-medium text-muted-foreground">
                                    Value:{" "}
                                  </span>
                                  {rec.value}
                                </p>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 shrink-0 p-0"
                                aria-label="Copy value"
                                onClick={() => void copyText(rec.value, key)}
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            {copied === key ? (
                              <p className="mt-1 text-[11px] text-emerald-600">Copied value</p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </EmailModuleShell>
  );
}
