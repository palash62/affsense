"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Globe, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type DomainRecord = {
  id: string;
  domain: string;
  status: string;
  verifiedAt: string | null;
  lastCheckedAt: string | null;
  createdAt: string;
  funnels: Array<{ id: string; name: string; slug: string; status: string }>;
};

const STATUS_STYLES: Record<string, string> = {
  VERIFIED: "bg-emerald-50 text-emerald-700",
  PENDING: "bg-amber-50 text-amber-700",
  FAILED: "bg-red-50 text-red-700",
};

export function AdvertiserDomainsPanel({
  platformHost,
  platformIp,
}: {
  platformHost: string;
  platformIp: string | null;
}) {
  const [domains, setDomains] = useState<DomainRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [domainInput, setDomainInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/v1/advertiser/domains");
    const json = await res.json();
    setDomains(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const domain = domainInput.trim();
    if (!domain) return;

    setAdding(true);
    setMessage(null);
    try {
      const res = await fetch("/api/v1/advertiser/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMessage({
          type: "err",
          text: json?.error?.message ?? "Unable to add domain",
        });
        return;
      }
      setDomainInput("");
      setMessage({ type: "ok", text: "Domain added. Configure DNS, then verify." });
      void load();
    } catch {
      setMessage({ type: "err", text: "Unable to add domain. Try again." });
    } finally {
      setAdding(false);
    }
  }

  async function handleVerify(id: string) {
    setVerifyingId(id);
    setMessage(null);
    try {
      const res = await fetch(`/api/v1/advertiser/domains/${id}/verify`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        setMessage({
          type: "err",
          text: json?.error?.message ?? "Verification failed",
        });
        return;
      }
      const status = json.data?.status as string | undefined;
      setMessage(
        status === "VERIFIED"
          ? { type: "ok", text: "Domain verified successfully." }
          : {
              type: "err",
              text: "DNS not pointing to the platform yet. Check your CNAME and try again.",
            },
      );
      void load();
    } catch {
      setMessage({ type: "err", text: "Verification failed. Try again." });
    } finally {
      setVerifyingId(null);
    }
  }

  async function handleRemove(id: string) {
    if (!confirm("Remove this domain? Any funnel using it will fall back to the default URL.")) {
      return;
    }

    setRemovingId(id);
    setMessage(null);
    try {
      const res = await fetch(`/api/v1/advertiser/domains/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setMessage({
          type: "err",
          text: json?.error?.message ?? "Unable to remove domain",
        });
        return;
      }
      setMessage({ type: "ok", text: "Domain removed." });
      void load();
    } catch {
      setMessage({ type: "err", text: "Unable to remove domain. Try again." });
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
            <Globe className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">DNS setup</p>
            <p>
              In your domain registrar (Namecheap, GoDaddy, Cloudflare, etc.), open the DNS
              settings for your domain and add <strong>one</strong> of these records:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-1.5 pr-4 font-medium">Use case</th>
                    <th className="py-1.5 pr-4 font-medium">Type</th>
                    <th className="py-1.5 pr-4 font-medium">Host</th>
                    <th className="py-1.5 pr-4 font-medium">Value</th>
                    <th className="py-1.5 font-medium">TTL</th>
                  </tr>
                </thead>
                <tbody className="text-foreground">
                  <tr className="border-b border-border">
                    <td className="py-1.5 pr-4">
                      Subdomain (e.g. <span className="font-mono">www.yourdomain.com</span>)
                    </td>
                    <td className="py-1.5 pr-4 font-mono">CNAME</td>
                    <td className="py-1.5 pr-4 font-mono">www</td>
                    <td className="py-1.5 pr-4 font-mono font-semibold text-foreground">
                      {platformHost}
                    </td>
                    <td className="py-1.5 font-mono">Automatic</td>
                  </tr>
                  {platformIp && (
                    <tr className="border-b border-border">
                      <td className="py-1.5 pr-4">
                        Root domain (e.g. <span className="font-mono">yourdomain.com</span>)
                      </td>
                      <td className="py-1.5 pr-4 font-mono">A</td>
                      <td className="py-1.5 pr-4 font-mono">@</td>
                      <td className="py-1.5 pr-4 font-mono font-semibold text-foreground">
                        {platformIp}
                      </td>
                      <td className="py-1.5 font-mono">Automatic</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              <li>
                Remove any existing <span className="font-mono">URL Redirect</span>,{" "}
                <span className="font-mono">A</span>, or <span className="font-mono">CNAME</span>{" "}
                records on the same host first — they conflict with the new record.
              </li>
              <li>
                Add the domain below exactly as visitors will type it (with{" "}
                <span className="font-mono">www</span> if you used the CNAME option).
              </li>
              <li>
                DNS changes take 5–30 minutes to propagate. Then click <strong>Verify</strong>.
              </li>
              <li>
                Once verified, select the domain in your funnel settings. HTTPS is issued
                automatically on the first visit.
              </li>
            </ul>
          </div>
        </div>
      </div>

      <form
        onSubmit={(e) => void handleAdd(e)}
        className="rounded-xl border border-border bg-card p-5 shadow-sm"
      >
        <Label htmlFor="domain-input" className="text-sm font-medium text-foreground">
          Add domain
        </Label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <Input
            id="domain-input"
            value={domainInput}
            onChange={(e) => setDomainInput(e.target.value)}
            placeholder="www.yourdomain.com"
            className="h-10 border-border"
            disabled={adding}
          />
          <Button type="submit" className="h-10 shrink-0" disabled={adding}>
            {adding ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              "Add domain"
            )}
          </Button>
        </div>
      </form>

      {message && (
        <p
          className={cn(
            "text-sm",
            message.type === "ok" ? "text-emerald-600" : "text-red-600",
          )}
        >
          {message.text}
        </p>
      )}

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">Your domains</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 px-5 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading domains...
          </div>
        ) : domains.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            No domains yet. Add one above to get started.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {domains.map((domain) => {
              const connectedFunnel = domain.funnels[0];
              return (
                <div
                  key={domain.id}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-mono text-sm font-medium text-foreground">
                        {domain.domain}
                      </p>
                      <Badge
                        variant="secondary"
                        className={STATUS_STYLES[domain.status] ?? "bg-muted text-foreground"}
                      >
                        {domain.status === "VERIFIED" && (
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                        )}
                        {domain.status.charAt(0) + domain.status.slice(1).toLowerCase()}
                      </Badge>
                    </div>
                    {connectedFunnel ? (
                      <p className="text-xs text-muted-foreground">
                        Connected to funnel:{" "}
                        <Link
                          href={`/advertiser/optin-funnels/${connectedFunnel.id}`}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {connectedFunnel.name}
                        </Link>
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">Not connected to a funnel</p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={verifyingId === domain.id}
                      onClick={() => void handleVerify(domain.id)}
                    >
                      {verifyingId === domain.id ? (
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-1.5 h-4 w-4" />
                      )}
                      Verify
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      disabled={removingId === domain.id}
                      onClick={() => void handleRemove(domain.id)}
                    >
                      {removingId === domain.id ? (
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="mr-1.5 h-4 w-4" />
                      )}
                      Remove
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
