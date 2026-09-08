"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { RoleHero } from "@/components/layout/role-hero";
import { PublisherInfoBanner } from "@/components/publisher/publisher-info-banner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { readApiErrorMessage } from "@/lib/errors";

type FormState = {
  status: "ACTIVE" | "INACTIVE";
  endpoint: string;
};

type DeliveryRow = {
  id: string;
  refId: string;
  url: string;
  status: string;
  httpStatus: number | null;
  error: string | null;
  payout: number | null;
  createdAt: string;
};

type MacroItem = { macro: string; description: string };

export function PublisherChannelPostbackForm({
  channelLabel,
  eyebrow,
  title,
  description,
  banner,
  tip,
  apiBase,
  macros,
  refLabel,
}: {
  channelLabel: string;
  eyebrow: string;
  title: string;
  description: string;
  banner: string;
  tip: string;
  apiBase: string;
  macros: readonly MacroItem[];
  refLabel: string;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [values, setValues] = useState<FormState>({
    status: "INACTIVE",
    endpoint: "",
  });
  const [draft, setDraft] = useState<FormState>(values);
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(apiBase);
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(readApiErrorMessage(body, "Failed to load postback.", res.status));
        }
        const next = {
          status: body.data.status as FormState["status"],
          endpoint: body.data.endpoint as string,
        };
        setValues(next);
        setDraft(next);
        setDeliveries((body.data.deliveries as DeliveryRow[] | undefined) ?? []);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, [apiBase]);

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
        body: JSON.stringify(draft),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(readApiErrorMessage(body, "Failed to save postback.", res.status));
      }
      const next = {
        status: body.data.status as FormState["status"],
        endpoint: body.data.endpoint as string,
      };
      setValues(next);
      setDraft(next);
      toast.success(`${channelLabel} postback saved`);
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
        body: JSON.stringify({ endpoint: draft.endpoint }),
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

  if (loading) {
    return <p className="text-sm text-slate-500">Loading postback…</p>;
  }

  const busy = saving || testing;

  return (
    <div className="space-y-6">
      <RoleHero eyebrow={eyebrow} title={title} description={description} />

      <PublisherInfoBanner>{banner}</PublisherInfoBanner>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            {tip}
            <div className="mt-2 font-mono text-xs text-sky-800">
              Example: https://your-tracker.com/pb?click_id=&#123;click_id&#125;&amp;payout=&#123;payout&#125;&amp;sub_id=&#123;sub_id&#125;
            </div>
          </div>

          <h2 className="mt-6 text-base font-semibold text-slate-900">S2S Postback</h2>

          <div className="mt-4 space-y-2">
            <Label>Status</Label>
            <Select
              value={draft.status}
              onValueChange={(v) =>
                v && setDraft((prev) => ({ ...prev, status: v as FormState["status"] }))
              }
            >
              <SelectTrigger className="h-11 w-full max-w-xs bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="mt-4 space-y-2">
            <Label>S2S Postback URL</Label>
            <Textarea
              value={draft.endpoint}
              onChange={(e) => setDraft((prev) => ({ ...prev, endpoint: e.target.value }))}
              rows={6}
              placeholder="https://your-tracker.com/pb?click_id={click_id}&payout={payout}&sub_id={sub_id}"
              className="font-mono text-xs"
            />
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button type="button" disabled={busy} onClick={() => void handleSave()}>
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
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setDraft(values)}
            >
              Cancel
            </Button>
          </div>

          <div className="mt-8">
            <h3 className="text-sm font-semibold text-slate-900">Recent deliveries</h3>
            {deliveries.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No deliveries yet.</p>
            ) : (
              <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-2 font-medium">When</th>
                      <th className="px-3 py-2 font-medium">{refLabel}</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium text-right">Payout</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveries.map((row) => (
                      <tr key={row.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 whitespace-nowrap text-slate-700">
                          {new Date(row.createdAt).toLocaleString()}
                        </td>
                        <td className="max-w-[8rem] truncate px-3 py-2 font-mono text-slate-500">
                          {row.refId.slice(-10)}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={
                              row.status === "SUCCESS"
                                ? "text-emerald-700"
                                : row.status === "FAILED"
                                  ? "text-rose-700"
                                  : "text-slate-600"
                            }
                          >
                            {row.status}
                            {row.httpStatus != null ? ` (${row.httpStatus})` : ""}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-slate-700">
                          {row.payout != null ? `$${row.payout.toFixed(2)}` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">Postback Macros</h3>
          <ul className="mt-3 divide-y divide-slate-100">
            {macros.map((item) => (
              <li key={item.macro} className="flex items-start justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="font-mono text-xs font-semibold text-sky-800">{item.macro}</p>
                  <p className="text-[11px] text-slate-500">{item.description}</p>
                </div>
                <button
                  type="button"
                  className="rounded p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-700"
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
    </div>
  );
}
