"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { RoleHero } from "@/components/layout/role-hero";
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
import { GLOBAL_POSTBACK_MACROS } from "@cpl/shared";

type FormState = {
  type: "S2S" | "IMAGE" | "HTML";
  status: "ACTIVE" | "INACTIVE";
  endpoint: string;
};

const TYPE_OPTIONS = [
  { value: "S2S" as const, label: "S2S Server To Server Postback Url" },
  { value: "IMAGE" as const, label: "Image Pixel" },
  { value: "HTML" as const, label: "HTML/Javascript Code" },
];

export function AdvertiserGlobalPostbackForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [values, setValues] = useState<FormState>({
    type: "S2S",
    status: "INACTIVE",
    endpoint: "",
  });
  const [draft, setDraft] = useState<FormState>(values);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/v1/advertiser/global-postback");
        const body = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(readApiErrorMessage(body, "Failed to load postback.", res.status));
        }
        const next = {
          type: body.data.type as FormState["type"],
          status: body.data.status as FormState["status"],
          endpoint: body.data.endpoint as string,
        };
        setValues(next);
        setDraft(next);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function copyMacro(macro: string) {
    await navigator.clipboard.writeText(macro);
    setCopied(macro);
    setTimeout(() => setCopied(null), 1500);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/v1/advertiser/global-postback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(readApiErrorMessage(body, "Failed to save postback.", res.status));
      }
      const next = {
        type: body.data.type as FormState["type"],
        status: body.data.status as FormState["status"],
        endpoint: body.data.endpoint as string,
      };
      setValues(next);
      setDraft(next);
      toast.success("Global postback saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading global postback…</p>;
  }

  return (
    <div className="space-y-6">
      <RoleHero
        eyebrow="Tools"
        title="Postback Settings"
        description="Receive conversion data for every CPA offer through your global postback."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            Our global postback functionality applies to all CPA offers. When a new conversion
            occurs, we send the conversion information to your designated global postback.
            <div className="mt-2 font-mono text-xs text-sky-800">
              Example: https://your-server.com/conversion?click_id=&#123;click_id&#125;&amp;payout=&#123;payout&#125;
            </div>
          </div>

          <h2 className="mt-6 text-base font-semibold text-foreground">
            Approved Conversion Postback
          </h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={draft.type}
                onValueChange={(v) =>
                  v && setDraft((prev) => ({ ...prev, type: v as FormState["type"] }))
                }
              >
                <SelectTrigger className="h-11 w-full bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={draft.status}
                onValueChange={(v) =>
                  v && setDraft((prev) => ({ ...prev, status: v as FormState["status"] }))
                }
              >
                <SelectTrigger className="h-11 w-full bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <Label>
              {draft.type === "HTML"
                ? "HTML / Javascript Code"
                : draft.type === "IMAGE"
                  ? "Image Pixel URL"
                  : "S2S Postback URL"}
            </Label>
            <Textarea
              value={draft.endpoint}
              onChange={(e) => setDraft((prev) => ({ ...prev, endpoint: e.target.value }))}
              rows={6}
              placeholder={
                draft.type === "HTML"
                  ? '<img src="https://example.com/pixel?click_id={click_id}" />'
                  : "https://your-server.com/conversion?click_id={click_id}&payout={payout}&aff_id={aff_id}"
              }
              className="font-mono text-xs"
            />
            {draft.type === "HTML" ? (
              <p className="text-xs text-amber-700">
                HTML/Javascript snippets are saved for your own landing pages. The platform does not
                server-fire HTML postbacks — use S2S or Image Pixel for automatic conversion
                delivery.
              </p>
            ) : null}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button type="button" disabled={saving} onClick={() => void handleSave()}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => setDraft(values)}
            >
              Cancel
            </Button>
          </div>
        </section>

        <aside className="h-fit rounded-2xl border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground">Postback Macros</h3>
          <ul className="mt-3 divide-y divide-slate-100">
            {GLOBAL_POSTBACK_MACROS.map((item) => (
              <li key={item.macro} className="flex items-start justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="font-mono text-xs font-semibold text-sky-800">{item.macro}</p>
                  <p className="text-[11px] text-muted-foreground">{item.description}</p>
                </div>
                <button
                  type="button"
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
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
