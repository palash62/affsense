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
import { PUBLISHER_POSTBACK_MACROS } from "@cpl/shared";

type FormState = {
  status: "ACTIVE" | "INACTIVE";
  endpoint: string;
};

export function PublisherPostbackForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [values, setValues] = useState<FormState>({
    status: "INACTIVE",
    endpoint: "",
  });
  const [draft, setDraft] = useState<FormState>(values);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/v1/publisher/postback");
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
      const res = await fetch("/api/v1/publisher/postback", {
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
      toast.success("Postback saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    try {
      const res = await fetch("/api/v1/publisher/postback/test-fire", {
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
            (result.skipped ? "Test postback was skipped." : `Test postback failed (HTTP ${result.httpStatus})`),
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
      <RoleHero
        eyebrow="Publisher Portal"
        title="Postback"
        description="Receive a server-to-server callback every time one of your leads is paid."
      />

      <PublisherInfoBanner>
        When a lead is paid, we send an HTTP GET to your postback URL with conversion macros
        replaced. Use this to credit conversions in your tracker.
      </PublisherInfoBanner>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            Add your tracker postback URL and set status to Active. We fire it once per paid lead.
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
        </section>

        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">Postback Macros</h3>
          <ul className="mt-3 divide-y divide-slate-100">
            {PUBLISHER_POSTBACK_MACROS.map((item) => (
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
