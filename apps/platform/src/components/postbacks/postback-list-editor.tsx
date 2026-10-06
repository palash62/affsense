"use client";

import { useState } from "react";
import { Check, Copy, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { cn } from "@/lib/utils";

type PostbackStatus = "ACTIVE" | "INACTIVE";

export type EditablePostback = {
  id: string | null;
  name: string | null;
  status: PostbackStatus;
  endpoint: string;
};

export type PostbackDeliveryRow = {
  id: string;
  refId: string;
  postbackId?: string | null;
  postbackLabel?: string | null;
  status: string;
  httpStatus: number | null;
  payout: number | null;
  createdAt: string;
};

type MacroItem = { macro: string; description: string };

type Values = { name: string; status: PostbackStatus; endpoint: string };

type Card = {
  key: string;
  id: string | null;
  saved: Values | null;
  draft: Values;
};

type FireResult = { ok: boolean; httpStatus: number; error: string | null; skipped?: boolean };

const EMPTY_VALUES: Values = { name: "", status: "ACTIVE", endpoint: "" };

let cardSeq = 0;
function nextKey() {
  cardSeq += 1;
  return `new-${cardSeq}`;
}

function toValues(row: EditablePostback): Values {
  return { name: row.name ?? "", status: row.status, endpoint: row.endpoint ?? "" };
}

function toCard(row: EditablePostback): Card {
  const values = toValues(row);
  return { key: row.id ?? nextKey(), id: row.id, saved: values, draft: values };
}

function sameValues(a: Values | null, b: Values) {
  return !!a && a.name === b.name && a.status === b.status && a.endpoint === b.endpoint;
}

async function sendJson(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { res, json };
}

/**
 * Manage any number of S2S postbacks for one channel. Every active postback fires
 * once per conversion. Used by the affiliate postback pages and the admin dialog.
 */
export function PostbackListEditor({
  channelLabel,
  collectionUrl,
  itemUrl,
  testFireUrl,
  extraBody,
  initialPostbacks,
  deliveries,
  macros,
  refLabel,
  compact = false,
}: {
  channelLabel: string;
  /** POST creates a postback. */
  collectionUrl: string;
  /** PATCH updates and DELETE removes a postback. */
  itemUrl: (postbackId: string) => string;
  testFireUrl: string;
  /** Merged into create and test-fire bodies (the admin API needs the channel). */
  extraBody?: Record<string, string>;
  initialPostbacks: EditablePostback[];
  deliveries: PostbackDeliveryRow[];
  macros: readonly MacroItem[];
  refLabel: string;
  compact?: boolean;
}) {
  const [cards, setCards] = useState<Card[]>(() => initialPostbacks.filter((p) => p.id).map(toCard));
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  function updateDraft(key: string, patch: Partial<Values>) {
    setCards((prev) =>
      prev.map((card) => (card.key === key ? { ...card, draft: { ...card.draft, ...patch } } : card)),
    );
  }

  function addCard() {
    setCards((prev) => [...prev, { key: nextKey(), id: null, saved: null, draft: { ...EMPTY_VALUES } }]);
  }

  async function copyMacro(macro: string) {
    await navigator.clipboard.writeText(macro);
    setCopied(macro);
    setTimeout(() => setCopied(null), 1500);
  }

  async function saveCard(card: Card) {
    setBusyKey(card.key);
    try {
      const payload = {
        name: card.draft.name.trim() || null,
        status: card.draft.status,
        endpoint: card.draft.endpoint,
      };
      const { res, json } = card.id
        ? await sendJson(itemUrl(card.id), "PATCH", payload)
        : await sendJson(collectionUrl, "POST", { ...extraBody, ...payload });
      if (!res.ok) {
        throw new Error(readApiErrorMessage(json, "Failed to save postback.", res.status));
      }
      const saved = json.data as EditablePostback;
      const values = toValues(saved);
      setCards((prev) =>
        prev.map((c) => (c.key === card.key ? { ...c, id: saved.id, saved: values, draft: values } : c)),
      );
      toast.success(`${channelLabel} postback saved`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setBusyKey(null);
    }
  }

  async function testCard(card: Card) {
    setBusyKey(card.key);
    try {
      const { res, json } = await sendJson(testFireUrl, "POST", {
        ...extraBody,
        ...(card.id ? { postbackId: card.id } : {}),
        endpoint: card.draft.endpoint,
      });
      if (!res.ok) {
        throw new Error(readApiErrorMessage(json, "Test fire failed.", res.status));
      }
      const result = json.data as FireResult;
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
      setBusyKey(null);
    }
  }

  async function deleteCard(card: Card) {
    if (!card.id) {
      setCards((prev) => prev.filter((c) => c.key !== card.key));
      return;
    }
    const label = card.saved?.name || card.saved?.endpoint || "this postback";
    if (!window.confirm(`Delete ${label}? It will stop firing immediately.`)) return;
    setBusyKey(card.key);
    try {
      const { res, json } = await sendJson(itemUrl(card.id), "DELETE");
      if (!res.ok) {
        throw new Error(readApiErrorMessage(json, "Failed to delete postback.", res.status));
      }
      setCards((prev) => prev.filter((c) => c.key !== card.key));
      toast.success(`${channelLabel} postback deleted`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setBusyKey(null);
    }
  }

  const activeCount = cards.filter((c) => c.id && c.saved?.status === "ACTIVE").length;

  return (
    <div className={cn("grid gap-5", compact ? "md:grid-cols-[minmax(0,1fr)_220px]" : "lg:grid-cols-[minmax(0,1fr)_280px]")}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-foreground">S2S Postbacks</h2>
            <p className="text-xs text-muted-foreground">
              {activeCount === 0
                ? "No active postbacks."
                : `${activeCount} active postback${activeCount === 1 ? "" : "s"}. Every active postback fires once per conversion.`}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addCard}>
            <Plus className="mr-1 h-4 w-4" />
            Add postback
          </Button>
        </div>

        {cards.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No postbacks yet. Click &ldquo;Add postback&rdquo; to create one.
          </div>
        ) : (
          cards.map((card, index) => {
            const busy = busyKey === card.key;
            const dirty = !sameValues(card.saved, card.draft);
            return (
              <div key={card.key} className="space-y-3 rounded-xl border border-border bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    {card.saved?.name || `Postback ${index + 1}`}
                    {!card.id ? <span className="ml-2 text-xs font-normal text-amber-700">Not saved</span> : null}
                  </p>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      card.saved?.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600",
                    )}
                  >
                    {card.saved?.status === "ACTIVE" ? "Active" : card.id ? "Inactive" : "Draft"}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
                  <div className="space-y-1.5">
                    <Label>Name (optional)</Label>
                    <Input
                      value={card.draft.name}
                      maxLength={100}
                      onChange={(e) => updateDraft(card.key, { name: e.target.value })}
                      placeholder="e.g. Voluum, RedTrack"
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select
                      value={card.draft.status}
                      onValueChange={(v) => v && updateDraft(card.key, { status: v as PostbackStatus })}
                    >
                      <SelectTrigger className="h-10 w-full bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ACTIVE">Active</SelectItem>
                        <SelectItem value="INACTIVE">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>S2S Postback URL</Label>
                  <Textarea
                    value={card.draft.endpoint}
                    onChange={(e) => updateDraft(card.key, { endpoint: e.target.value })}
                    rows={compact ? 3 : 4}
                    placeholder="https://your-tracker.com/pb?click_id={click_id}&payout={payout}&sub_id={sub_id}"
                    className="font-mono text-xs"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" disabled={busy || (!!card.id && !dirty)} onClick={() => void saveCard(card)}>
                    {busy ? "Working…" : "Save"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy || !card.draft.endpoint.trim()}
                    onClick={() => void testCard(card)}
                  >
                    Test
                  </Button>
                  {card.saved && dirty ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => card.saved && updateDraft(card.key, card.saved)}
                    >
                      Reset
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    className="ml-auto text-rose-700 hover:text-rose-800"
                    onClick={() => void deleteCard(card)}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    {card.id ? "Delete" : "Discard"}
                  </Button>
                </div>
              </div>
            );
          })
        )}

        <div>
          <h3 className="text-sm font-semibold text-foreground">Recent deliveries</h3>
          {deliveries.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No deliveries yet.</p>
          ) : (
            <div className="mt-2 overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">When</th>
                    <th className="px-3 py-2 font-medium">{refLabel}</th>
                    <th className="px-3 py-2 font-medium">Postback</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 text-right font-medium">Payout</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map((row) => (
                    <tr key={row.id} className="border-t border-border">
                      <td className="whitespace-nowrap px-3 py-2">{new Date(row.createdAt).toLocaleString()}</td>
                      <td className="max-w-[8rem] truncate px-3 py-2 font-mono text-muted-foreground">
                        {row.refId.slice(-10)}
                      </td>
                      <td
                        className="max-w-[12rem] truncate px-3 py-2 text-muted-foreground"
                        title={row.postbackLabel ?? undefined}
                      >
                        {row.postbackLabel ?? (row.postbackId ? "Deleted postback" : "—")}
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

      <aside className="h-fit rounded-xl border border-border bg-white p-4">
        <h3 className="text-sm font-semibold text-foreground">Postback Macros</h3>
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
