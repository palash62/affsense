"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Circle,
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
  type: "CNAME" | "TXT";
  name: string;
  value: string;
  purpose: "DKIM" | "SPF" | "DMARC";
};

type IdentityRow = {
  id: string;
  domain: string;
  fromEmail: string;
  fromName: string;
  verificationStatus: string;
  isDefault: boolean;
  dkimTokens: string[];
  ready: boolean;
  dkimReady: boolean;
  spfReady: boolean;
  dmarcReady: boolean;
  dnsRecords: DnsRecord[];
};

function StatusIcon({ ready, instructional }: { ready: boolean; instructional?: boolean }) {
  if (instructional) {
    return <Circle className="h-5 w-5 text-slate-300" aria-label="Add DNS record" />;
  }
  if (ready) {
    return <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-label="Ready" />;
  }
  return <AlertCircle className="h-5 w-5 text-red-500" aria-label="Not ready" />;
}

export function EmailDomainsPanel() {
  const [rows, setRows] = useState<IdentityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [domain, setDomain] = useState("");
  const [fromName, setFromName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [setupRow, setSetupRow] = useState<IdentityRow | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

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
  }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!domain.trim() || fromName.trim().length < 2) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/advertiser/email/identities", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: domain.trim().toLowerCase(),
          fromName: fromName.trim(),
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
      await load();
      if (json.data) setSetupRow(json.data as IdentityRow);
    } catch {
      setError("Unable to add domain");
    } finally {
      setSaving(false);
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
      if (setupRow?.id === id && json.data) setSetupRow(json.data as IdentityRow);
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
      <PageSection title="Domains" icon={Globe} gradient="leads">
        <div className="flex items-center justify-end border-b border-slate-100 px-6 py-3">
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
                  <TableCell colSpan={6} className="h-32 text-center text-slate-500">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-slate-500">
                    No sending domains yet. Add an existing domain you own.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id} className="hover:bg-slate-50">
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-slate-900">{row.domain}</span>
                        {row.isDefault ? (
                          <Badge variant="outline" className="text-xs">
                            Default
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-xs text-slate-500">{row.fromEmail}</p>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col items-center gap-1">
                        <StatusIcon ready={row.ready} />
                        <span className="text-xs text-slate-500">{row.ready ? "Yes" : "No"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        <StatusIcon ready={row.dkimReady} />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        <StatusIcon ready={false} instructional />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex justify-center">
                        <StatusIcon ready={false} instructional />
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
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <p className="border-t border-slate-100 px-6 py-3 text-xs text-slate-500">
          SPF and DMARC show as setup guidance. Ready / DKIM update after you add SES DKIM CNAMEs and
          click refresh.
        </p>
      </PageSection>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <form onSubmit={handleAdd} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Add a Domain</DialogTitle>
              <DialogDescription>
                Add an existing domain you own for autoresponder sending.
              </DialogDescription>
            </DialogHeader>

            <button
              type="button"
              className={cn(
                "flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4 text-left",
                "ring-2 ring-[var(--theme-primary)]",
              )}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">
                <Plus className="h-5 w-5 text-[var(--theme-primary)]" />
              </span>
              <span>
                <span className="block font-semibold text-slate-900">Add an existing domain</span>
                <span className="mt-0.5 block text-sm text-slate-500">
                  Connect a domain from your DNS provider and verify with SES.
                </span>
              </span>
            </button>

            <div className="space-y-2">
              <Label htmlFor="email-domain">Domain</Label>
              <Input
                id="email-domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="mail.yourcompany.com"
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

      <Sheet open={Boolean(setupRow)} onOpenChange={(open) => !open && setSetupRow(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>DNS setup — {setupRow?.domain}</SheetTitle>
            <SheetDescription>
              Add these records at your DNS provider, then refresh verification.
            </SheetDescription>
          </SheetHeader>

          {setupRow ? (
            <div className="mt-6 space-y-6 px-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={setupRow.ready ? "default" : "secondary"}>
                  {setupRow.verificationStatus}
                </Badge>
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

              {(["DKIM", "SPF", "DMARC"] as const).map((purpose) => {
                const records = setupRow.dnsRecords.filter((r) => r.purpose === purpose);
                if (records.length === 0) return null;
                return (
                  <div key={purpose} className="space-y-2">
                    <h3 className="text-sm font-semibold text-slate-900">{purpose}</h3>
                    <p className="text-xs text-slate-500">
                      {purpose === "DKIM"
                        ? "Required CNAME records from Amazon SES."
                        : "Recommended TXT record for deliverability."}
                    </p>
                    <div className="space-y-2">
                      {records.map((rec) => {
                        const key = `${rec.purpose}-${rec.name}`;
                        return (
                          <div
                            key={key}
                            className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 text-xs"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 space-y-1 font-mono break-all text-slate-700">
                                <p>
                                  <span className="font-sans font-medium text-slate-500">
                                    Type:{" "}
                                  </span>
                                  {rec.type}
                                </p>
                                <p>
                                  <span className="font-sans font-medium text-slate-500">
                                    Name:{" "}
                                  </span>
                                  {rec.name}
                                </p>
                                <p>
                                  <span className="font-sans font-medium text-slate-500">
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
