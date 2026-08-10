"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MERGE_TAGS = [
  "first_name",
  "last_name",
  "email",
  "phone",
  "campaign_name",
  "company_name",
  "unsubscribe_url",
];

type Props = { templateId?: string };

export function EmailTemplateEditor({ templateId }: Props) {
  const router = useRouter();
  const isNew = !templateId;
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [previewHtml, setPreviewHtml] = useState("");
  const [form, setForm] = useState({
    name: "",
    subject: "",
    htmlBody: "",
    textBody: "",
    previewText: "",
  });

  useEffect(() => {
    if (!templateId) return;
    fetch(`/api/v1/advertiser/email/templates/${templateId}`)
      .then((r) => r.json())
      .then((d) => {
        const t = d.data;
        setForm({
          name: t.name,
          subject: t.subject,
          htmlBody: t.htmlBody,
          textBody: t.textBody ?? "",
          previewText: t.previewText ?? "",
        });
        setLoading(false);
      });
  }, [templateId]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!form.subject && !form.htmlBody) return;
      const url = templateId
        ? `/api/v1/advertiser/email/templates/${templateId}/preview`
        : null;
      if (!url) {
        setPreviewHtml(form.htmlBody);
        return;
      }
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (json.data?.htmlBody) setPreviewHtml(json.data.htmlBody);
    }, 400);
    return () => clearTimeout(timer);
  }, [form.subject, form.htmlBody, templateId]);

  function insertTag(tag: string) {
    setForm((f) => ({ ...f, htmlBody: `${f.htmlBody}{{${tag}}}` }));
  }

  async function save() {
    setSaving(true);
    setError("");
    setMessage("");
    const url = isNew
      ? "/api/v1/advertiser/email/templates"
      : `/api/v1/advertiser/email/templates/${templateId}`;
    const res = await fetch(url, {
      method: isNew ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        textBody: form.textBody || null,
        previewText: form.previewText || null,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(json?.error?.message ?? "Save failed");
      return;
    }
    setMessage("Saved");
    if (isNew) router.push(`/advertiser/email/templates/${json.data.id}`);
  }

  async function sendTest() {
    if (!templateId) return;
    setTesting(true);
    const res = await fetch(`/api/v1/advertiser/email/templates/${templateId}/test`, {
      method: "POST",
    });
    setTesting(false);
    setMessage(res.ok ? "Test email sent" : "Test send failed — check SES settings");
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4 rounded-xl border border-border bg-card p-6">
        <div>
          <Label htmlFor="name">Template name</Label>
          <Input
            id="name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="subject">Subject</Label>
          <Input
            id="subject"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
          />
        </div>
        <div>
          <Label>Merge tags</Label>
          <div className="mt-1 flex flex-wrap gap-1">
            {MERGE_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => insertTag(tag)}
                className="rounded-md bg-muted px-2 py-0.5 text-xs text-foreground hover:bg-slate-200"
              >
                {`{{${tag}}}`}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Label htmlFor="htmlBody">HTML body</Label>
          <textarea
            id="htmlBody"
            rows={14}
            className="flex w-full rounded-md border border-border bg-card px-3 py-2 font-mono text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)]"
            value={form.htmlBody}
            onChange={(e) => setForm({ ...form, htmlBody: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="textBody">Plain text (optional)</Label>
          <textarea
            id="textBody"
            rows={4}
            className="flex w-full rounded-md border border-border bg-card px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)]"
            value={form.textBody}
            onChange={(e) => setForm({ ...form, textBody: e.target.value })}
          />
        </div>
        {message && <p className="text-sm text-green-600">{message}</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <Button onClick={save} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving…" : "Save"}
          </Button>
          {templateId && (
            <Button variant="outline" onClick={sendTest} disabled={testing}>
              <Send className="mr-2 h-4 w-4" />
              Send test
            </Button>
          )}
        </div>
      </div>
      <div className="rounded-xl border border-border bg-card p-6">
        <p className="mb-3 text-sm font-semibold text-foreground">Preview</p>
        <div
          className="min-h-[400px] overflow-auto rounded-lg border border-border bg-muted p-4"
          dangerouslySetInnerHTML={{ __html: previewHtml || form.htmlBody }}
        />
      </div>
    </div>
  );
}
