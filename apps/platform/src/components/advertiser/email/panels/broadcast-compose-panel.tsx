"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import {
  CalendarClock,
  Loader2,
  Mail,
  Save,
  Send,
  User,
  Users,
} from "lucide-react";
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
import { cn } from "@/lib/utils";
import { resolveUserTimezone } from "@/lib/user-timezone";
import { EmailComposeEditor } from "../automation-builder/email-compose-editor";
import { EmailModuleShell } from "../email-module-shell";

type AudienceType = "LIST" | "TAGS";
type DeliveryMode = "now" | "schedule";
type BroadcastAction = "draft" | "schedule" | "send";

type ListOption = { id: string; name: string };
type TagOption = { id: string; name: string; color: string | null };
type TemplateOption = { id: string; name: string; subject: string };
type MailboxOption = {
  id: string;
  email: string;
  fromName: string | null;
  isDefault: boolean;
};

type IdentityOption = {
  id: string;
  domain: string;
  fromEmail: string;
  fromName: string;
  verificationStatus: string;
  ready?: boolean;
  mailboxes?: MailboxOption[];
};

function flattenVerifiedMailboxes(identities: IdentityOption[]) {
  return identities
    .filter((i) => i.verificationStatus === "VERIFIED" || i.ready)
    .flatMap((i) => {
      const boxes =
        i.mailboxes && i.mailboxes.length > 0
          ? i.mailboxes
          : [
              {
                id: i.id,
                email: i.fromEmail,
                fromName: i.fromName || null,
                isDefault: true,
              },
            ];
      return boxes.map((m) => ({
        ...m,
        fromName: m.fromName ?? i.fromName,
      }));
    });
}

type Props = {
  broadcastId?: string;
};

const DEFAULT_HTML = `<!DOCTYPE html>
<html><body style="font-family:Georgia,serif;color:#1e293b;max-width:600px;margin:0 auto;padding:28px;">
<p>Hi {{first_name}},</p>
<p>Write your broadcast email here.</p>
<p>{{company_name}}</p>
</body></html>`;

function toLocalInputValue(iso: string | null | undefined, tz: string) {
  if (!iso) return "";
  try {
    return formatInTimeZone(new Date(iso), tz, "yyyy-MM-dd'T'HH:mm");
  } catch {
    return "";
  }
}

function fromLocalInputValue(local: string, tz: string) {
  return fromZonedTime(local, tz).toISOString();
}

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 px-6 py-4">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <Icon className="size-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold tracking-tight text-slate-900">{title}</h2>
            <p className="mt-0.5 text-sm text-slate-500">{description}</p>
          </div>
        </div>
      </div>
      <div className="space-y-4 px-6 py-5">{children}</div>
    </section>
  );
}

export function BroadcastComposePanel({ broadcastId: initialBroadcastId }: Props) {
  const router = useRouter();
  const { data: session } = useSession();
  const timezone = resolveUserTimezone(session?.user?.timezone);

  const [broadcastId, setBroadcastId] = useState(initialBroadcastId);
  const [lists, setLists] = useState<ListOption[]>([]);
  const [tags, setTags] = useState<TagOption[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [identities, setIdentities] = useState<IdentityOption[]>([]);
  const [defaultFromEmail, setDefaultFromEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<BroadcastAction | null>(null);
  const [testing, setTesting] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testMsg, setTestMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recipientCount, setRecipientCount] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);

  const [name, setName] = useState("");
  const [audienceType, setAudienceType] = useState<AudienceType>("LIST");
  const [listId, setListId] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [contentMode, setContentMode] = useState<"template" | "compose">("compose");
  const [templateId, setTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState(DEFAULT_HTML);
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [deliveryMode, setDeliveryMode] = useState<DeliveryMode>("now");
  const [scheduleLocal, setScheduleLocal] = useState("");

  const verifiedMailboxes = useMemo(
    () => flattenVerifiedMailboxes(identities),
    [identities],
  );

  useEffect(() => {
    if (session?.user?.email && !testTo) {
      setTestTo(session.user.email);
    }
  }, [session?.user?.email, testTo]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const [lRes, tRes, tplRes, idRes, settingsRes, bRes] = await Promise.all([
          fetch("/api/v1/advertiser/email/lists", { credentials: "same-origin" }),
          fetch("/api/v1/advertiser/email/tags", { credentials: "same-origin" }),
          fetch("/api/v1/advertiser/email/templates", { credentials: "same-origin" }),
          fetch("/api/v1/advertiser/email/identities", { credentials: "same-origin" }),
          fetch("/api/v1/advertiser/email/settings", { credentials: "same-origin" }),
          initialBroadcastId
            ? fetch(`/api/v1/advertiser/email/broadcasts/${initialBroadcastId}`, {
                credentials: "same-origin",
              })
            : Promise.resolve(null),
        ]);
        const [lJson, tJson, tplJson, idJson, settingsJson] = await Promise.all([
          lRes.json().catch(() => null),
          tRes.json().catch(() => null),
          tplRes.json().catch(() => null),
          idRes.json().catch(() => null),
          settingsRes.json().catch(() => null),
        ]);
        if (cancelled) return;
        setLists((lJson?.data ?? []) as ListOption[]);
        setTags((tJson?.data ?? []) as TagOption[]);
        setTemplates((tplJson?.data ?? []) as TemplateOption[]);
        setIdentities((idJson?.data ?? []) as IdentityOption[]);
        const settingsFrom =
          (settingsJson?.data?.fromEmail as string | undefined)?.trim() ?? "";
        setDefaultFromEmail(settingsFrom);
        if (!initialBroadcastId) {
          setFromName((settingsJson?.data?.fromName as string | undefined)?.trim() ?? "");
        }

        if (bRes) {
          const bJson = await bRes.json().catch(() => null);
          if (!bRes.ok || !bJson?.data) {
            setError(bJson?.error?.message ?? "Broadcast not found");
            return;
          }
          const b = bJson.data as {
            name: string;
            audienceType: AudienceType;
            listId: string | null;
            tagIds: string[];
            status: string;
            scheduledAt: string | null;
            fromEmail?: string | null;
            fromName?: string | null;
            template: { id: string; name: string; subject: string; htmlBody?: string };
          };
          if (b.status !== "DRAFT" && b.status !== "QUEUED") {
            setError("This broadcast can no longer be edited.");
            return;
          }
          setName(b.name);
          setAudienceType(b.audienceType);
          setListId(b.listId ?? "");
          setTagIds(b.tagIds ?? []);
          setFromEmail(b.fromEmail ?? "");
          setFromName(b.fromName ?? settingsJson?.data?.fromName ?? "");
          const isOneOff = b.template.name.startsWith("[Broadcast]");
          if (isOneOff) {
            setContentMode("compose");
            setSubject(b.template.subject);
            setHtmlBody(b.template.htmlBody ?? DEFAULT_HTML);
            setTemplateId(b.template.id);
          } else {
            setContentMode("template");
            setTemplateId(b.template.id);
          }
          if (b.scheduledAt && new Date(b.scheduledAt).getTime() > Date.now()) {
            setDeliveryMode("schedule");
            setScheduleLocal(toLocalInputValue(b.scheduledAt, timezone));
          } else {
            setDeliveryMode("now");
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialBroadcastId, timezone]);

  useEffect(() => {
    let cancelled = false;
    const payload =
      audienceType === "LIST"
        ? { audienceType, listId: listId || null, tagIds: null }
        : { audienceType, listId: null, tagIds };

    if (audienceType === "LIST" && !listId) {
      setRecipientCount(null);
      return;
    }
    if (audienceType === "TAGS" && tagIds.length === 0) {
      setRecipientCount(null);
      return;
    }

    setCounting(true);
    const timer = setTimeout(() => {
      void fetch("/api/v1/advertiser/email/broadcasts/preview", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
        .then((r) => r.json())
        .then((j) => {
          if (!cancelled) setRecipientCount(j.data?.recipientCount ?? 0);
        })
        .catch(() => {
          if (!cancelled) setRecipientCount(null);
        })
        .finally(() => {
          if (!cancelled) setCounting(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [audienceType, listId, tagIds]);

  const minScheduleLocal = useMemo(
    () => formatInTimeZone(new Date(Date.now() + 60_000), timezone, "yyyy-MM-dd'T'HH:mm"),
    [timezone],
  );

  const hasContent =
    contentMode === "template"
      ? Boolean(templateId)
      : subject.trim().length >= 2 && htmlBody.trim().length >= 10;

  const hasAudience =
    audienceType === "LIST" ? Boolean(listId) : tagIds.length > 0;
  const hasRecipients = (recipientCount ?? 0) > 0;
  const hasSender = Boolean(fromEmail.trim() || defaultFromEmail);

  const canDraft = name.trim().length >= 2 && hasContent && !saving && !testing;
  const canPrimary =
    canDraft &&
    hasAudience &&
    hasRecipients &&
    hasSender &&
    (deliveryMode === "now" || Boolean(scheduleLocal));
  const canTest =
    name.trim().length >= 2 &&
    hasContent &&
    hasSender &&
    Boolean(testTo.trim()) &&
    !saving &&
    !testing;

  function buildBody(action: BroadcastAction) {
    const base = {
      name: name.trim(),
      audienceType,
      listId: audienceType === "LIST" ? listId || null : null,
      tagIds: audienceType === "TAGS" ? tagIds : null,
      fromEmail: fromEmail.trim() || null,
      fromName: fromName.trim() || null,
      action,
      scheduledAt:
        action === "schedule" && scheduleLocal
          ? fromLocalInputValue(scheduleLocal, timezone)
          : null,
    };
    if (contentMode === "template") {
      return { ...base, templateId };
    }
    return { ...base, subject: subject.trim(), htmlBody };
  }

  async function submit(action: BroadcastAction) {
    setSaving(action);
    setError(null);
    setTestMsg(null);
    try {
      const url = broadcastId
        ? `/api/v1/advertiser/email/broadcasts/${broadcastId}`
        : "/api/v1/advertiser/email/broadcasts";
      const res = await fetch(url, {
        method: broadcastId ? "PATCH" : "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(action)),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error?.message ?? "Unable to save broadcast");
        return;
      }
      if (action === "draft") {
        const id = json?.data?.id as string | undefined;
        const nextTemplateId = json?.data?.template?.id as string | undefined;
        if (nextTemplateId) setTemplateId(nextTemplateId);
        if (id && id !== broadcastId) {
          setBroadcastId(id);
          router.replace(`/advertiser/email/broadcasts/${id}`);
          return;
        }
        router.push("/advertiser/email/broadcasts");
        return;
      }
      router.push("/advertiser/email/broadcasts");
    } catch {
      setError("Unable to save broadcast");
    } finally {
      setSaving(null);
    }
  }

  async function sendTest() {
    if (!canTest) return;
    setTesting(true);
    setError(null);
    setTestMsg(null);
    try {
      // Persist draft so a templateId exists for the test send
      const url = broadcastId
        ? `/api/v1/advertiser/email/broadcasts/${broadcastId}`
        : "/api/v1/advertiser/email/broadcasts";
      const saveRes = await fetch(url, {
        method: broadcastId ? "PATCH" : "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody("draft")),
      });
      const saveJson = await saveRes.json().catch(() => null);
      if (!saveRes.ok) {
        setError(saveJson?.error?.message ?? "Unable to save draft for test");
        return;
      }
      const id = saveJson?.data?.id as string | undefined;
      const tplId = saveJson?.data?.template?.id as string | undefined;
      if (tplId) setTemplateId(tplId);
      if (id && id !== broadcastId) {
        setBroadcastId(id);
        router.replace(`/advertiser/email/broadcasts/${id}`);
      }
      if (!tplId) {
        setError("Unable to prepare template for test send");
        return;
      }

      const testRes = await fetch(`/api/v1/advertiser/email/templates/${tplId}/test`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: testTo.trim(),
          fromEmail: fromEmail.trim() || null,
          fromName: fromName.trim() || null,
        }),
      });
      const testJson = await testRes.json().catch(() => null);
      if (!testRes.ok) {
        setError(testJson?.error?.message ?? "Test email failed");
        return;
      }
      setTestMsg(`Test email sent to ${testTo.trim()}`);
    } catch {
      setError("Test email failed");
    } finally {
      setTesting(false);
    }
  }

  const title = broadcastId ? "Edit broadcast" : "New broadcast";

  return (
    <EmailModuleShell
      title={title}
      description="Save a draft, schedule for later, or send now. Unsubscribe links are added automatically."
      breadcrumbs={[
        { label: "Autoresponder", href: "/advertiser/email" },
        { label: "Broadcasts", href: "/advertiser/email/broadcasts" },
        { label: broadcastId ? "Edit" : "New" },
      ]}
      showToolbar={false}
    >
      {loading ? (
        <div className="flex h-48 items-center justify-center text-slate-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : (
        <div className="mx-auto max-w-3xl space-y-5 pb-28">
          <SectionCard
            icon={Mail}
            title="Details"
            description="Internal name for your broadcast history."
          >
            <div className="space-y-2">
              <Label htmlFor="broadcast-name">Name</Label>
              <Input
                id="broadcast-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="March promo"
                required
                minLength={2}
                disabled={Boolean(saving)}
                className="max-w-md"
              />
            </div>
          </SectionCard>

          <SectionCard
            icon={Users}
            title="Audience"
            description="Choose a list or tags — not both. Only subscribed contacts are counted."
          >
            <div className="space-y-2">
              <Label>Send to</Label>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { id: "LIST" as const, label: "One list" },
                    { id: "TAGS" as const, label: "Tags" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setAudienceType(opt.id);
                      setListId("");
                      setTagIds([]);
                    }}
                    className={cn(
                      "rounded-xl border px-4 py-2 text-sm font-medium transition",
                      audienceType === opt.id
                        ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {audienceType === "LIST" ? (
              <div className="space-y-2">
                <Label>List</Label>
                <Select value={listId || ""} onValueChange={(v) => v && setListId(v)}>
                  <SelectTrigger className="max-w-md">
                    <SelectValue placeholder="Select a list" />
                  </SelectTrigger>
                  <SelectContent>
                    {lists.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-3">
                  {tags.length === 0 ? (
                    <p className="text-sm text-slate-500">No tags yet.</p>
                  ) : (
                    tags.map((t) => {
                      const checked = tagIds.includes(t.id);
                      return (
                        <label
                          key={t.id}
                          className="flex cursor-pointer items-center gap-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setTagIds((prev) =>
                                checked
                                  ? prev.filter((id) => id !== t.id)
                                  : [...prev, t.id],
                              );
                            }}
                          />
                          <span
                            className="inline-block size-2.5 rounded-full"
                            style={{ backgroundColor: t.color ?? "#334155" }}
                          />
                          {t.name}
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Recipients:{" "}
              {counting ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> counting…
                </span>
              ) : recipientCount == null ? (
                "—"
              ) : (
                <strong className="text-slate-900">
                  {recipientCount.toLocaleString()}
                </strong>
              )}{" "}
              subscribed contacts
            </p>
          </SectionCard>

          <SectionCard
            icon={Mail}
            title="Content"
            description="Use an existing template or write this broadcast’s email."
          >
            <div className="space-y-2">
              <Label>Content source</Label>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { id: "compose" as const, label: "Write now" },
                    { id: "template" as const, label: "Use a template" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setContentMode(opt.id)}
                    className={cn(
                      "rounded-xl border px-4 py-2 text-sm font-medium transition",
                      contentMode === opt.id
                        ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {contentMode === "template" ? (
              <div className="space-y-2">
                <Label>Template</Label>
                <Select
                  value={templateId || ""}
                  onValueChange={(v) => v && setTemplateId(v)}
                >
                  <SelectTrigger className="max-w-md">
                    <SelectValue placeholder="Choose a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="broadcast-subject">Subject</Label>
                  <Input
                    id="broadcast-subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Subject line"
                    disabled={Boolean(saving)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Message</Label>
                  <EmailComposeEditor value={htmlBody} onChange={setHtmlBody} />
                </div>
              </>
            )}
          </SectionCard>

          <SectionCard
            icon={User}
            title="Sender"
            description="Choose a verified domain address, or use the default from Email Settings."
          >
            <div className="space-y-2">
              <Label htmlFor="broadcast-from-name">From name</Label>
              <Input
                id="broadcast-from-name"
                value={fromName}
                onChange={(e) => setFromName(e.target.value)}
                placeholder="Your brand"
                disabled={Boolean(saving) || testing}
                className="max-w-md"
              />
            </div>
            <div className="space-y-2">
              <Label>From email</Label>
              {verifiedMailboxes.length === 0 ? (
                <p className="text-sm text-amber-800">
                  No verified sending emails. Add a domain on the Domains tab first.
                </p>
              ) : (
                <Select
                  value={fromEmail || "__default__"}
                  onValueChange={(v) => {
                    const next = !v || v === "__default__" ? "" : v;
                    setFromEmail(next);
                    const match = verifiedMailboxes.find((m) => m.email === next);
                    if (match && !fromName.trim()) {
                      setFromName(match.fromName || "");
                    }
                  }}
                >
                  <SelectTrigger className="max-w-md">
                    <SelectValue placeholder="Select from email" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__default__">
                      {defaultFromEmail
                        ? `Use settings default (${defaultFromEmail})`
                        : "Use default from Settings"}
                    </SelectItem>
                    {verifiedMailboxes.map((m) => (
                      <SelectItem key={m.id} value={m.email}>
                        {m.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {!hasSender ? (
                <p className="text-xs text-amber-700">
                  Set a default on Email Settings or pick an address here before sending.
                </p>
              ) : null}
            </div>
            <div className="space-y-2 border-t border-slate-100 pt-4">
              <Label htmlFor="broadcast-test-to">Send test email</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  id="broadcast-test-to"
                  type="email"
                  value={testTo}
                  onChange={(e) => setTestTo(e.target.value)}
                  placeholder="you@example.com"
                  disabled={testing || Boolean(saving)}
                  className="max-w-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={!canTest}
                  onClick={() => void sendTest()}
                  className="gap-2"
                >
                  {testing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {testing ? "Sending…" : "Send test"}
                </Button>
              </div>
              {testMsg ? <p className="text-sm text-emerald-700">{testMsg}</p> : null}
            </div>
          </SectionCard>

          <SectionCard
            icon={CalendarClock}
            title="Delivery"
            description="Send immediately or pick a time in your timezone."
          >
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: "now" as const, label: "Send now" },
                  { id: "schedule" as const, label: "Schedule" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setDeliveryMode(opt.id)}
                  className={cn(
                    "rounded-xl border px-4 py-2 text-sm font-medium transition",
                    deliveryMode === opt.id
                      ? "border-emerald-600 bg-emerald-50 text-emerald-900"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {deliveryMode === "schedule" ? (
              <div className="space-y-2">
                <Label htmlFor="broadcast-schedule">Date &amp; time</Label>
                <Input
                  id="broadcast-schedule"
                  type="datetime-local"
                  min={minScheduleLocal}
                  value={scheduleLocal}
                  onChange={(e) => setScheduleLocal(e.target.value)}
                  className="max-w-xs"
                  disabled={Boolean(saving)}
                />
                <p className="text-xs text-slate-500">Timezone: {timezone}</p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                Messages queue immediately and send to subscribed recipients.
              </p>
            )}
          </SectionCard>

          {error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          ) : null}
        </div>
      )}

      {!loading ? (
        <div className="sticky bottom-0 z-10 -mx-1 border-t border-slate-200/80 bg-white/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/80">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/advertiser/email/broadcasts")}
              disabled={Boolean(saving)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={!canDraft}
              onClick={() => void submit("draft")}
            >
              {saving === "draft" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save draft
            </Button>
            <Button
              type="button"
              className="gap-2 bg-[var(--theme-primary)] hover:opacity-90"
              disabled={!canPrimary}
              onClick={() =>
                void submit(deliveryMode === "schedule" ? "schedule" : "send")
              }
            >
              {saving === "schedule" || saving === "send" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : deliveryMode === "schedule" ? (
                <CalendarClock className="h-4 w-4" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {deliveryMode === "schedule" ? "Schedule" : "Send now"}
            </Button>
          </div>
        </div>
      ) : null}
    </EmailModuleShell>
  );
}
