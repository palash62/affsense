"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import {
  PUBLISHER_CPA_POSTBACK_MACROS,
  PUBLISHER_DIGITAL_PRODUCT_POSTBACK_MACROS,
} from "@cpl/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { readApiErrorMessage } from "@/lib/errors";

type Channel = "DIGITAL_PRODUCT" | "CPA";

type FormState = {
  status: "ACTIVE" | "INACTIVE";
  endpoint: string;
};

type DeliveryRow = {
  id: string;
  refId: string;
  status: string;
  httpStatus: number | null;
  payout: number | null;
  createdAt: string;
};

type ChannelData = FormState & { deliveries: DeliveryRow[] };

type MacroItem = { macro: string; description: string };

const CHANNELS: {
  channel: Channel;
  key: "digitalProduct" | "cpa";
  label: string;
  refLabel: string;
  macros: readonly MacroItem[];
}[] = [
  {
    channel: "DIGITAL_PRODUCT",
    key: "digitalProduct",
    label: "Digital Product",
    refLabel: "Event",
    macros: PUBLISHER_DIGITAL_PRODUCT_POSTBACK_MACROS,
  },
  {
    channel: "CPA",
    key: "cpa",
    label: "CPA",
    refLabel: "Conversion",
    macros: PUBLISHER_CPA_POSTBACK_MACROS,
  },
];

export function AdminPublisherPostbackDialog({
  publisherId,
  publisherName,
  open,
  onOpenChange,
}: {
  publisherId: string;
  publisherName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const apiBase = `/api/v1/admin/publishers/${publisherId}/postbacks`;
  const [data, setData] = useState<Record<Channel, ChannelData> | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setData(null);
    void (async () => {
      try {
        const res = await fetch(apiBase);
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(readApiErrorMessage(body, "Failed to load postbacks.", res.status));
        }
        if (cancelled) return;
        const pick = (row: ChannelData): ChannelData => ({
          status: row.status,
          endpoint: row.endpoint ?? "",
          deliveries: row.deliveries ?? [],
        });
        setData({
          DIGITAL_PRODUCT: pick(body.data.digitalProduct),
          CPA: pick(body.data.cpa),
        });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load postbacks");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBase, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Postbacks — {publisherName}</DialogTitle>
        </DialogHeader>

        {!data ? (
          <p className="text-sm text-muted-foreground">Loading postbacks…</p>
        ) : (
          <Tabs defaultValue="DIGITAL_PRODUCT">
            <TabsList>
              {CHANNELS.map((c) => (
                <TabsTrigger key={c.channel} value={c.channel}>
                  {c.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {CHANNELS.map((c) => (
              <TabsContent key={c.channel} value={c.channel} className="pt-4">
                <ChannelPostbackPanel
                  apiBase={apiBase}
                  channel={c.channel}
                  label={c.label}
                  refLabel={c.refLabel}
                  macros={c.macros}
                  initial={data[c.channel]}
                />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ChannelPostbackPanel({
  apiBase,
  channel,
  label,
  refLabel,
  macros,
  initial,
}: {
  apiBase: string;
  channel: Channel;
  label: string;
  refLabel: string;
  macros: readonly MacroItem[];
  initial: ChannelData;
}) {
  const [values, setValues] = useState<FormState>({
    status: initial.status,
    endpoint: initial.endpoint,
  });
  const [draft, setDraft] = useState<FormState>(values);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  async function copyMacro(macro: string) {
    await navigator.clipboard.writeText(macro);
    setCopied(macro);
    setTimeout(() => setCopied(null), 1500);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(apiBase, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, ...draft }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(readApiErrorMessage(body, "Failed to save postback.", res.status));
      }
      const next = {
        status: body.data.status as FormState["status"],
        endpoint: (body.data.endpoint as string) ?? "",
      };
      setValues(next);
      setDraft(next);
      toast.success(`${label} postback saved`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    try {
      const res = await fetch(`${apiBase}/test-fire`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, endpoint: draft.endpoint }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(readApiErrorMessage(body, "Test fire failed.", res.status));
      }
      const result = body.data as {
        ok: boolean;
        httpStatus: number;
        error: string | null;
        skipped?: boolean;
      };
      if (result.ok) {
        toast.success(`Test postback succeeded (HTTP ${result.httpStatus})`);
      } else {
        toast.error(
          result.error ||
            (result.skipped
              ? "Test postback was skipped."
              : `Test postback failed (HTTP ${result.httpStatus})`),
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Test fire failed");
    } finally {
      setTesting(false);
    }
  }

  const busy = saving || testing;

  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_220px]">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Status</Label>
          <Select
            value={draft.status}
            onValueChange={(v) =>
              v && setDraft((prev) => ({ ...prev, status: v as FormState["status"] }))
            }
          >
            <SelectTrigger className="h-10 w-full max-w-xs bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>S2S Postback URL</Label>
          <Textarea
            value={draft.endpoint}
            onChange={(e) => setDraft((prev) => ({ ...prev, endpoint: e.target.value }))}
            rows={5}
            placeholder="https://your-tracker.com/pb?click_id={click_id}&payout={payout}&sub_id={sub_id}"
            className="font-mono text-xs"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={busy}
            onClick={() => void handleSave()}
            className="bg-[var(--theme-primary)] hover:opacity-90"
          >
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy || !draft.endpoint.trim()}
            onClick={() => void handleTest()}
          >
            {testing ? "Testing…" : "Test postback"}
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={() => setDraft(values)}>
            Reset
          </Button>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground">Recent deliveries</h3>
          {initial.deliveries.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No deliveries yet.</p>
          ) : (
            <div className="mt-2 overflow-hidden rounded-xl border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">When</th>
                    <th className="px-3 py-2 font-medium">{refLabel}</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 text-right font-medium">Payout</th>
                  </tr>
                </thead>
                <tbody>
                  {initial.deliveries.map((row) => (
                    <tr key={row.id} className="border-t border-border">
                      <td className="whitespace-nowrap px-3 py-2">
                        {new Date(row.createdAt).toLocaleString()}
                      </td>
                      <td className="max-w-[8rem] truncate px-3 py-2 font-mono text-muted-foreground">
                        {row.refId.slice(-10)}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            row.status === "SUCCESS"
                              ? "text-emerald-700"
                              : row.status === "FAILED"
                                ? "text-rose-700"
                                : "text-muted-foreground"
                          }
                        >
                          {row.status}
                          {row.httpStatus != null ? ` (${row.httpStatus})` : ""}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {row.payout != null ? `$${row.payout.toFixed(2)}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <aside className="h-fit rounded-xl border border-border p-3">
        <h3 className="text-sm font-semibold text-foreground">Macros</h3>
        <ul className="mt-2 divide-y divide-border">
          {macros.map((item) => (
            <li key={item.macro} className="flex items-start justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="font-mono text-xs font-semibold text-sky-800">{item.macro}</p>
                <p className="text-[11px] text-muted-foreground">{item.description}</p>
              </div>
              <button
                type="button"
                className="rounded p-1 text-muted-foreground hover:bg-muted"
                onClick={() => void copyMacro(item.macro)}
                aria-label={`Copy ${item.macro}`}
              >
                {copied === item.macro ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
