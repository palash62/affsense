"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, KeyRound, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SELECT_CLASS, SoloStatusBadge, soloRequest } from "@/components/solo-ads/solo-ui";

export type AdminSoloProvider = {
  id: string;
  publicCode: number;
  realName: string;
  contact: string | null;
  trafficClass: "REGULAR" | "WARM" | "BOTH";
  status: "ACTIVE" | "PAUSED" | "DISABLED";
  geoRules: string[];
  dailyCapacity: number | null;
  notes: string | null;
  clicksToday: number;
  last30: { total: number; billed: number; invalid: number; fallback: number };
  tokens: Array<{ id: string; prefix: string; trafficType: "REGULAR" | "WARM"; status: string; createdAt: string; lastUsedAt: string | null }>;
};

type FormState = {
  realName: string;
  contact: string;
  trafficClass: AdminSoloProvider["trafficClass"];
  status: AdminSoloProvider["status"];
  geoRules: string;
  dailyCapacity: string;
  notes: string;
};

const emptyForm: FormState = {
  realName: "",
  contact: "",
  trafficClass: "REGULAR",
  status: "ACTIVE",
  geoRules: "",
  dailyCapacity: "",
  notes: "",
};

function copy(text: string) {
  void navigator.clipboard.writeText(text).then(() => toast.success("Copied"));
}

export function SoloProvidersManager({
  providers,
  masterUrls,
}: {
  providers: AdminSoloProvider[];
  masterUrls: { regular: string; warm: string };
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<AdminSoloProvider | "new" | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [issued, setIssued] = useState<{ provider: string; url: string; trafficType: string } | null>(null);

  function openEditor(provider: AdminSoloProvider | "new") {
    setEditing(provider);
    setForm(
      provider === "new"
        ? emptyForm
        : {
            realName: provider.realName,
            contact: provider.contact ?? "",
            trafficClass: provider.trafficClass,
            status: provider.status,
            geoRules: provider.geoRules.join(", "),
            dailyCapacity: provider.dailyCapacity ? String(provider.dailyCapacity) : "",
            notes: provider.notes ?? "",
          },
    );
  }

  async function saveProvider(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    const body = {
      realName: form.realName,
      contact: form.contact || null,
      trafficClass: form.trafficClass,
      status: form.status,
      geoRules: form.geoRules.split(/[\s,]+/).filter(Boolean),
      dailyCapacity: form.dailyCapacity ? Number(form.dailyCapacity) : null,
      notes: form.notes || null,
    };
    try {
      if (editing === "new") {
        await soloRequest("/api/v1/admin/solo-ads/providers", { body });
        toast.success("Provider added");
      } else {
        await soloRequest(`/api/v1/admin/solo-ads/providers/${editing.id}`, { method: "PATCH", body });
        toast.success("Provider updated");
      }
      setEditing(null);
      router.refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function issueToken(provider: AdminSoloProvider, trafficType: "REGULAR" | "WARM") {
    try {
      const data = await soloRequest<{ url: string }>(`/api/v1/admin/solo-ads/providers/${provider.id}/tokens`, {
        body: { trafficType },
      });
      setIssued({ provider: `Provider ${provider.publicCode}`, url: data.url, trafficType });
      router.refresh();
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  async function revokeToken(provider: AdminSoloProvider, tokenId: string) {
    if (!window.confirm("Revoke this link? Clicks using it will go to the fallback page.")) return;
    try {
      await soloRequest(`/api/v1/admin/solo-ads/providers/${provider.id}/tokens/${tokenId}`, { method: "DELETE" });
      toast.success("Link revoked");
      router.refresh();
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  return (
    <div className="space-y-6">
      <section className="premium-card space-y-3 p-6">
        <h2 className="text-base font-semibold">Master traffic URLs</h2>
        <p className="text-sm text-muted-foreground">
          Every provider sends traffic to one of these addresses with their own secret token. Issue a token below to get a
          provider&apos;s full link.
        </p>
        {(["regular", "warm"] as const).map((pool) => (
          <div key={pool} className="flex items-center gap-2">
            <span className="w-20 text-sm font-medium capitalize">{pool}</span>
            <code className="flex-1 truncate rounded-lg bg-muted px-3 py-2 text-xs">{masterUrls[pool]}?token=…</code>
          </div>
        ))}
      </section>

      <section className="premium-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold">Providers</h2>
          <Button size="sm" onClick={() => openEditor("new")} className="gap-1">
            <Plus className="h-4 w-4" /> Add provider
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Provider</TableHead>
              <TableHead>Traffic</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Today / capacity</TableHead>
              <TableHead className="text-right">30d clicks</TableHead>
              <TableHead className="text-right">30d invalid</TableHead>
              <TableHead>Links</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {providers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  No providers yet. Add the first traffic provider to start routing clicks.
                </TableCell>
              </TableRow>
            ) : null}
            {providers.map((p) => {
              const invalidRate = p.last30.total ? Math.round((p.last30.invalid / p.last30.total) * 100) : 0;
              const canRegular = p.trafficClass !== "WARM";
              const canWarm = p.trafficClass !== "REGULAR";
              return (
                <TableRow key={p.id} className="align-top">
                  <TableCell>
                    <div className="font-medium">Provider {p.publicCode}</div>
                    <div className="text-xs text-muted-foreground">{p.realName}</div>
                    {p.contact ? <div className="text-xs text-muted-foreground">{p.contact}</div> : null}
                  </TableCell>
                  <TableCell className="capitalize">{p.trafficClass.toLowerCase()}</TableCell>
                  <TableCell>
                    <SoloStatusBadge status={p.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.clicksToday} / {p.dailyCapacity ?? "∞"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{p.last30.total}</TableCell>
                  <TableCell className={`text-right tabular-nums ${invalidRate > 20 ? "text-red-600" : ""}`}>
                    {p.last30.invalid} ({invalidRate}%)
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {p.tokens.length === 0 ? <span className="text-xs text-muted-foreground">None</span> : null}
                      {p.tokens.map((t) => (
                        <div key={t.id} className="flex items-center gap-2 text-xs">
                          <code>{t.prefix}…</code>
                          <span className="capitalize text-muted-foreground">{t.trafficType.toLowerCase()}</span>
                          <SoloStatusBadge status={t.status} />
                          {t.status === "ACTIVE" ? (
                            <button type="button" className="text-red-600 hover:underline" onClick={() => revokeToken(p, t.id)}>
                              Revoke
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => openEditor(p)}>
                        Edit
                      </Button>
                      {canRegular ? (
                        <Button size="sm" variant="ghost" className="gap-1" onClick={() => issueToken(p, "REGULAR")}>
                          <KeyRound className="h-3.5 w-3.5" /> Regular link
                        </Button>
                      ) : null}
                      {canWarm ? (
                        <Button size="sm" variant="ghost" className="gap-1" onClick={() => issueToken(p, "WARM")}>
                          <KeyRound className="h-3.5 w-3.5" /> Warm link
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </section>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Add provider" : "Edit provider"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveProvider} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="p-name">Real name (internal only)</Label>
              <Input id="p-name" required value={form.realName} onChange={(e) => setForm((f) => ({ ...f, realName: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-contact">Contact</Label>
              <Input id="p-contact" value={form.contact} onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-class">Traffic class</Label>
                <select
                  id="p-class"
                  className={SELECT_CLASS}
                  value={form.trafficClass}
                  onChange={(e) => setForm((f) => ({ ...f, trafficClass: e.target.value as FormState["trafficClass"] }))}
                >
                  <option value="REGULAR">Regular</option>
                  <option value="WARM">Warm</option>
                  <option value="BOTH">Both</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-status">Status</Label>
                <select
                  id="p-status"
                  className={SELECT_CLASS}
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as FormState["status"] }))}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="PAUSED">Paused</option>
                  <option value="DISABLED">Disabled</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-geo">Allowed countries</Label>
                <Input
                  id="p-geo"
                  placeholder="Empty = all supported"
                  value={form.geoRules}
                  onChange={(e) => setForm((f) => ({ ...f, geoRules: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-cap">Daily click capacity</Label>
                <Input
                  id="p-cap"
                  type="number"
                  min="1"
                  placeholder="Unlimited"
                  value={form.dailyCapacity}
                  onChange={(e) => setForm((f) => ({ ...f, dailyCapacity: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-notes">Notes</Label>
              <Input id="p-notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={issued !== null} onOpenChange={(open) => !open && setIssued(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {issued?.provider} {issued?.trafficType.toLowerCase()} link
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Copy this link now and send it to the provider. For security it is shown only once; if it is lost, revoke it and
            issue a new one.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 break-all rounded-lg bg-muted px-3 py-2 text-xs">{issued?.url}</code>
            <Button size="sm" variant="outline" onClick={() => issued && copy(issued.url)} className="gap-1">
              <Copy className="h-3.5 w-3.5" /> Copy
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
