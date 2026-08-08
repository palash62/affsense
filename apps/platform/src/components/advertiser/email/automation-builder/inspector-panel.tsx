"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock,
  List,
  Mail,
  Minus,
  MousePointerClick,
  MailOpen,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Send,
  Trash2,
  User,
  Zap,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { AutomationBuilderState } from "./use-automation-builder-state";
import type { StepStat } from "./types";
import {
  DEFAULT_EMAIL_HTML,
  daysToMinutes,
  flattenVerifiedMailboxes,
  minutesToDays,
} from "./types";
import { EmailComposeEditor } from "./email-compose-editor";

type Props = {
  state: AutomationBuilderState;
};

type CreateMode = "quick" | "library";

function PanelSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="text-sm font-semibold tracking-tight text-slate-900">{title}</h3>
        {description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{description}</p>
        ) : null}
      </div>
      <div className="space-y-3.5">{children}</div>
    </section>
  );
}

function FieldHint({
  children,
  tone = "muted",
}: {
  children: React.ReactNode;
  tone?: "muted" | "amber" | "success";
}) {
  return (
    <p
      className={cn(
        "mt-1.5 text-xs leading-relaxed",
        tone === "muted" && "text-slate-500",
        tone === "amber" &&
          "rounded-lg border border-amber-200/80 bg-amber-50 px-2.5 py-2 text-amber-800",
        tone === "success" &&
          "rounded-lg border border-emerald-200/70 bg-emerald-50/80 px-2.5 py-2 text-emerald-800",
      )}
    >
      {children}
    </p>
  );
}

function FieldLabel({
  children,
  required,
}: {
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <Label className="text-xs font-medium text-slate-500">
      {children}
      {required ? <span className="text-red-500"> *</span> : null}
    </Label>
  );
}

function StatsEmpty({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof BarChart3;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center px-4 py-10 text-center">
      <span className="mb-3 flex size-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-400">
        <Icon className="size-5" />
      </span>
      <p className="text-sm font-medium text-slate-800">{title}</p>
      <p className="mt-1 max-w-[240px] text-xs leading-relaxed text-slate-500">{description}</p>
    </div>
  );
}

function StickyFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-200/90 bg-white/95 px-4 py-3 backdrop-blur-sm">
      {children}
    </div>
  );
}

function StatRow({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Send;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-slate-600 shadow-sm">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        <p className="text-lg font-semibold tracking-tight text-slate-900">{value}</p>
        {detail ? <p className="text-xs text-slate-500">{detail}</p> : null}
      </div>
    </div>
  );
}

function StepStatistics({ stat }: { stat: StepStat }) {
  return (
    <div className="space-y-2">
      <StatRow icon={Send} label="Sent" value={String(stat.sent)} />
      <StatRow icon={CheckCircle2} label="Delivered" value={String(stat.delivered)} />
      <StatRow icon={AlertTriangle} label="Bounce" value={String(stat.bounced)} />
      <StatRow
        icon={MailOpen}
        label="Opened"
        value={`${stat.openRate}%`}
        detail={`${stat.opens} opens`}
      />
      <StatRow
        icon={MousePointerClick}
        label="Clicked"
        value={`${stat.clickRate}%`}
        detail={`${stat.clicks} clicks`}
      />
    </div>
  );
}

function EmailContentForm({ state }: { state: AutomationBuilderState }) {
  const {
    steps,
    selection,
    templates,
    templateContents,
    identities,
    defaultFromEmail,
    updateStep,
    updateStepTemplate,
    removeStep,
    revertStepContent,
    saveStepAction,
    applyLibraryTemplate,
  } = state;

  const selectedStep =
    selection.kind === "email"
      ? steps.find((s) => s.clientId === selection.clientId)
      : undefined;
  const stepIndex = selectedStep
    ? steps.findIndex((s) => s.clientId === selectedStep.clientId)
    : -1;

  const template = selectedStep
    ? templateContents[selectedStep.templateId] ?? {
        id: selectedStep.templateId,
        name: `Email ${Math.max(stepIndex, 0) + 1}`,
        subject: "",
        previewText: "",
        htmlBody: DEFAULT_EMAIL_HTML,
      }
    : null;

  const verifiedMailboxes = flattenVerifiedMailboxes(identities);

  const [createMode, setCreateMode] = useState<CreateMode>("quick");
  const [libraryId, setLibraryId] = useState("");
  const [testTo, setTestTo] = useState("");
  const [testMsg, setTestMsg] = useState("");
  const [testing, setTesting] = useState(false);
  const [savingAction, setSavingAction] = useState(false);

  useEffect(() => {
    setCreateMode("quick");
    setLibraryId("");
    setTestMsg("");
  }, [selectedStep?.clientId]);

  if (!selectedStep || !template) return null;

  async function onApplyLibrary(id: string) {
    if (!id || !selectedStep) return;
    setLibraryId(id);
    const ok = await applyLibraryTemplate(selectedStep.clientId, id);
    if (ok) setCreateMode("quick");
  }

  async function onSendTest() {
    if (!selectedStep?.templateId) return;
    setTesting(true);
    setTestMsg("");
    const res = await fetch(
      `/api/v1/advertiser/email/templates/${selectedStep.templateId}/test`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testTo.trim() || undefined }),
      },
    );
    setTesting(false);
    setTestMsg(res.ok ? "Test email sent" : "Test send failed — check SES settings");
  }

  async function onSaveAction() {
    if (!selectedStep) return;
    setSavingAction(true);
    await saveStepAction(selectedStep.clientId);
    setSavingAction(false);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        <PanelSection title="Action" description="Name shown on the canvas for this email step.">
          <div>
            <FieldLabel required>Action name</FieldLabel>
            <Input
              className="mt-1.5 h-10"
              value={template.name}
              onChange={(e) =>
                void updateStepTemplate(selectedStep.clientId, { name: e.target.value })
              }
              placeholder="Day 1"
            />
          </div>
        </PanelSection>

        <PanelSection
          title="Sender"
          description="Choose a verified domain address, or use the default from Email Settings."
        >
          <div>
            <FieldLabel>From name</FieldLabel>
            <Input
              className="mt-1.5 h-10"
              value={selectedStep.fromName}
              onChange={(e) =>
                updateStep(selectedStep.clientId, { fromName: e.target.value })
              }
              placeholder="From name (optional override)"
            />
          </div>
          <div>
            <FieldLabel required>From email</FieldLabel>
            {verifiedMailboxes.length === 0 ? (
              <FieldHint tone="amber">
                No verified sending emails. Add a domain on the Domains tab first.
              </FieldHint>
            ) : (
              <Select
                value={selectedStep.fromEmail || "__default__"}
                onValueChange={(v) => {
                  const next = !v || v === "__default__" ? "" : v;
                  const match = verifiedMailboxes.find((m) => m.email === next);
                  updateStep(selectedStep.clientId, {
                    fromEmail: next,
                    ...(match && !selectedStep.fromName.trim()
                      ? { fromName: match.fromName || "" }
                      : {}),
                  });
                }}
              >
                <SelectTrigger className="mt-1.5 h-10">
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
            {!defaultFromEmail && !selectedStep.fromEmail ? (
              <FieldHint tone="amber">
                Set a default from email in Settings, or pick an address here.
              </FieldHint>
            ) : null}
          </div>
        </PanelSection>

        <PanelSection title="Message" description="Subject line and body for this email.">
          <div>
            <FieldLabel required>Subject</FieldLabel>
            <Input
              className="mt-1.5 h-10"
              value={template.subject}
              onChange={(e) =>
                void updateStepTemplate(selectedStep.clientId, {
                  subject: e.target.value,
                })
              }
              placeholder="Subject"
            />
          </div>
          <div>
            <FieldLabel>Pre-header (Preview Text)</FieldLabel>
            <Input
              className="mt-1.5 h-10"
              value={template.previewText}
              onChange={(e) =>
                void updateStepTemplate(selectedStep.clientId, {
                  previewText: e.target.value,
                })
              }
              placeholder="(Optional)"
            />
            <FieldHint>Shown as preview text in some email clients.</FieldHint>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-slate-500">Create email</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCreateMode("quick")}
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-left text-sm transition",
                  createMode === "quick"
                    ? "border-[var(--theme-primary)] bg-[var(--theme-primary-soft)] ring-1 ring-[var(--theme-primary)]"
                    : "border-slate-200 hover:border-slate-300",
                )}
              >
                <span className="flex items-center gap-2 font-medium text-slate-900">
                  <span
                    className={cn(
                      "flex size-3.5 items-center justify-center rounded-full border",
                      createMode === "quick"
                        ? "border-[var(--theme-primary)]"
                        : "border-slate-300",
                    )}
                  >
                    {createMode === "quick" ? (
                      <span className="size-2 rounded-full bg-[var(--theme-primary)]" />
                    ) : null}
                  </span>
                  Quick compose
                </span>
              </button>
              <button
                type="button"
                onClick={() => setCreateMode("library")}
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-left text-sm transition",
                  createMode === "library"
                    ? "border-[var(--theme-primary)] bg-[var(--theme-primary-soft)] ring-1 ring-[var(--theme-primary)]"
                    : "border-slate-200 hover:border-slate-300",
                )}
              >
                <span className="flex items-center gap-2 font-medium text-slate-900">
                  <span
                    className={cn(
                      "flex size-3.5 items-center justify-center rounded-full border",
                      createMode === "library"
                        ? "border-[var(--theme-primary)]"
                        : "border-slate-300",
                    )}
                  >
                    {createMode === "library" ? (
                      <span className="size-2 rounded-full bg-[var(--theme-primary)]" />
                    ) : null}
                  </span>
                  Select template
                </span>
              </button>
            </div>
          </div>

          {createMode === "library" ? (
            <div>
              <FieldLabel>Template</FieldLabel>
              <Select
                value={libraryId || "__pick__"}
                onValueChange={(v) => {
                  if (!v || v === "__pick__") return;
                  void onApplyLibrary(v);
                }}
              >
                <SelectTrigger className="mt-1.5 h-10 w-full">
                  <SelectValue placeholder="Choose a template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__pick__">Choose a template</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div>
              <FieldLabel required>Type your message</FieldLabel>
              <div className="mt-1.5">
                <EmailComposeEditor
                  key={selectedStep.clientId + selectedStep.templateId}
                  value={template.htmlBody}
                  onChange={(html) =>
                    void updateStepTemplate(selectedStep.clientId, { htmlBody: html })
                  }
                />
              </div>
            </div>
          )}
        </PanelSection>

        <PanelSection title="Test send" description="Send a preview to your inbox before publishing.">
          <div>
            <FieldLabel>Test email</FieldLabel>
            <div className="mt-1.5 flex gap-2">
              <Input
                type="email"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder="you@example.com"
                className="h-10 flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 shrink-0"
                disabled={testing || !selectedStep.templateId}
                onClick={() => void onSendTest()}
              >
                {testing ? "Sending…" : "Send test"}
              </Button>
            </div>
            {testMsg ? (
              <p
                className={cn(
                  "mt-1.5 text-xs",
                  testMsg.includes("failed") ? "text-red-600" : "text-emerald-600",
                )}
              >
                {testMsg}
              </p>
            ) : null}
          </div>
        </PanelSection>
      </div>

      <StickyFooter>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-red-600 hover:bg-red-50 hover:text-red-700"
          onClick={() => removeStep(selectedStep.clientId)}
        >
          <Trash2 className="size-3.5" />
          Delete
        </Button>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void revertStepContent(selectedStep.clientId)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={savingAction}
            onClick={() => void onSaveAction()}
          >
            {savingAction ? "Saving…" : "Save action"}
          </Button>
        </div>
      </StickyFooter>
    </div>
  );
}

function WaitContentForm({ state }: { state: AutomationBuilderState }) {
  const {
    steps,
    selection,
    updateStep,
    clearWait,
    saveStepAction,
    selectCanvas,
  } = state;

  const selectedStep =
    selection.kind === "wait"
      ? steps.find((s) => s.clientId === selection.clientId)
      : undefined;

  const [savingAction, setSavingAction] = useState(false);
  const days = selectedStep
    ? Math.max(0, Math.round(minutesToDays(selectedStep.delayMinutes)))
    : 0;

  if (!selectedStep) return null;

  function setDays(next: number) {
    const clamped = Math.max(0, Math.min(365, Math.round(next)));
    updateStep(selectedStep!.clientId, { delayMinutes: daysToMinutes(clamped) });
  }

  async function onSaveAction() {
    setSavingAction(true);
    await saveStepAction(selectedStep!.clientId);
    setSavingAction(false);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        <PanelSection title="Wait" description="Pause the sequence before the next email.">
          <div>
            <FieldLabel>Action name</FieldLabel>
            <Input className="mt-1.5 h-10" value="Wait" readOnly />
          </div>
          <div>
            <FieldLabel>Time period</FieldLabel>
            <div className="mt-1.5 flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-10 shrink-0"
                disabled={days <= 0}
                onClick={() => setDays(days - 1)}
                aria-label="Decrease days"
              >
                <Minus className="size-3.5" />
              </Button>
              <Input
                type="number"
                min={0}
                max={365}
                step={1}
                className="h-10 text-center"
                value={days}
                onChange={(e) => setDays(Number(e.target.value) || 0)}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-10 shrink-0"
                disabled={days >= 365}
                onClick={() => setDays(days + 1)}
                aria-label="Increase days"
              >
                <Plus className="size-3.5" />
              </Button>
              <Select value="days" disabled>
                <SelectTrigger className="h-10 w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="days">Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <FieldHint>
              Measured from when the lead enters this automation before this email sends.
              {days === 0 ? " Immediate (no delay)." : null}
            </FieldHint>
          </div>
        </PanelSection>
      </div>

      <StickyFooter>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-red-600 hover:bg-red-50 hover:text-red-700"
          onClick={() => clearWait(selectedStep.clientId)}
        >
          <Trash2 className="size-3.5" />
          Delete
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => selectCanvas()}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={savingAction}
            onClick={() => void onSaveAction()}
          >
            {savingAction ? "Saving…" : "Save action"}
          </Button>
        </div>
      </StickyFooter>
    </div>
  );
}

export function InspectorPanel({ state }: Props) {
  const {
    form,
    setForm,
    steps,
    selection,
    lists,
    tags,
    stats,
    validateFlash,
    issues,
  } = state;

  const [open, setOpen] = useState(true);

  const selectedEmail =
    selection.kind === "email"
      ? steps.find((s) => s.clientId === selection.clientId)
      : undefined;
  const selectedWait =
    selection.kind === "wait"
      ? steps.find((s) => s.clientId === selection.clientId)
      : undefined;
  const selectedStep = selectedEmail ?? selectedWait;
  const stepIndex = selectedStep
    ? steps.findIndex((s) => s.clientId === selectedStep.clientId)
    : -1;
  const stepStat =
    selectedStep?.serverId != null
      ? stats.find((s) => s.stepId === selectedStep.serverId)
      : stepIndex >= 0
        ? stats.find((s) => s.order === stepIndex)
        : undefined;

  const showIssues = validateFlash && issues.length > 0;
  const isWait = selection.kind === "wait" && Boolean(selectedWait);
  const isEmail = selection.kind === "email" && Boolean(selectedEmail);

  const selectedList = lists.find((l) => l.id === form.listId);

  const selectionKey =
    selection.kind === "email" || selection.kind === "wait"
      ? `${selection.kind}:${selection.clientId}`
      : selection.kind;

  useEffect(() => {
    setOpen(true);
  }, [selectionKey]);

  if (!open) {
    return (
      <aside className="flex h-full w-10 shrink-0 flex-col items-center border-l border-slate-200/80 bg-slate-50/80 pt-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-slate-600 hover:text-slate-900"
          aria-label="Open inspector"
          onClick={() => setOpen(true)}
        >
          <PanelRightOpen className="size-4" />
        </Button>
      </aside>
    );
  }

  return (
    <aside className="flex h-full w-[460px] min-w-[440px] max-w-[520px] shrink-0 flex-col border-l border-slate-200/80 bg-slate-50/40">
      <div className="flex items-start justify-between gap-2 border-b border-slate-200/80 bg-slate-50/80 px-4 py-3.5">
        {isWait ? (
          <div className="flex min-w-0 flex-1 items-start gap-2.5">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 shadow-sm">
              <Clock className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">Wait</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                Hold for a set number of days before the next email
              </p>
            </div>
          </div>
        ) : isEmail ? (
          <div className="flex min-w-0 flex-1 items-start gap-2.5">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 shadow-sm">
              <Mail className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">Email</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                Compose the message contacts receive in this step
              </p>
            </div>
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 items-start gap-2.5">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--theme-primary-soft)] text-[var(--theme-primary)] shadow-sm">
              <Zap className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">
                Automation settings
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                Who enters and how this flow starts
              </p>
            </div>
          </div>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="mt-0.5 size-8 shrink-0 text-slate-500 hover:text-slate-900"
          aria-label="Collapse inspector"
          onClick={() => setOpen(false)}
        >
          <PanelRightClose className="size-4" />
        </Button>
      </div>

      {showIssues ? (
        <div className="mx-3 mt-3 flex gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 shadow-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-600" />
          <ul className="min-w-0 space-y-0.5 text-xs text-red-700">
            {issues.slice(0, 4).map((issue) => (
              <li key={issue.path}>{issue.message}</li>
            ))}
            {issues.length > 4 ? <li>+{issues.length - 4} more</li> : null}
          </ul>
        </div>
      ) : null}

      <Tabs
        key={
          isWait
            ? `wait-${selectedWait!.clientId}`
            : isEmail
              ? `email-${selectedEmail!.clientId}`
              : "automation"
        }
        defaultValue="content"
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <TabsList
          variant="line"
          className="w-full shrink-0 justify-start gap-1 rounded-none border-b border-slate-200/80 bg-white px-3"
        >
          <TabsTrigger
            value="content"
            className="px-3.5 py-2.5 text-sm data-active:text-[var(--theme-primary)]"
          >
            Content
          </TabsTrigger>
          <TabsTrigger
            value="statistics"
            className="px-3.5 py-2.5 text-sm data-active:text-[var(--theme-primary)]"
          >
            Statistics
          </TabsTrigger>
        </TabsList>

        {isWait ? (
          <>
            <TabsContent
              value="content"
              className="mt-0 flex min-h-0 flex-1 flex-col bg-slate-50/30 data-[hidden]:hidden"
            >
              <WaitContentForm state={state} />
            </TabsContent>
            <TabsContent
              value="statistics"
              className="mt-0 min-h-0 flex-1 overflow-y-auto bg-white"
            >
              <StatsEmpty
                icon={Clock}
                title="No stats for wait steps"
                description="Select the following email step to view send, open, and click statistics."
              />
            </TabsContent>
          </>
        ) : isEmail ? (
          <>
            <TabsContent
              value="content"
              className="mt-0 flex min-h-0 flex-1 flex-col bg-slate-50/30 data-[hidden]:hidden"
            >
              <EmailContentForm state={state} />
            </TabsContent>
            <TabsContent
              value="statistics"
              className="mt-0 min-h-0 flex-1 overflow-y-auto bg-white px-4 py-4"
            >
              {stepStat ? (
                <div className="space-y-3">
                  <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    This email
                  </p>
                  <StepStatistics stat={stepStat} />
                </div>
              ) : (
                <StatsEmpty
                  icon={BarChart3}
                  title="No sends yet"
                  description="Statistics appear after this automation has delivered emails."
                />
              )}
            </TabsContent>
          </>
        ) : (
          <>
            <TabsContent
              value="content"
              className="mt-0 min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50/30 px-4 py-4"
            >
              <PanelSection
                title="Flow"
                description="Name this automation. People enter from the audience list’s campaign."
              >
                <div>
                  <FieldLabel required>Automation name</FieldLabel>
                  <Input
                    className="mt-1.5 h-10"
                    value={form.name}
                    onChange={(e) => setForm({ name: e.target.value })}
                    placeholder="Welcome sequence"
                  />
                </div>
              </PanelSection>

              <PanelSection
                title="Audience"
                description="Connect a list — submitted leads for that list’s campaign enter this flow."
              >
                <div>
                  <FieldLabel required>Audience list</FieldLabel>
                  <Select
                    value={form.listId || ""}
                    onValueChange={(listId) => {
                      if (listId) setForm({ listId });
                    }}
                  >
                    <SelectTrigger className="mt-1.5 h-10 w-full">
                      <SelectValue placeholder="Select a list">
                        {selectedList ? (
                          <span className="flex items-center gap-2">
                            <List className="size-3.5 text-slate-400" />
                            {selectedList.name}
                          </span>
                        ) : (
                          "Select a list"
                        )}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {lists.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {lists.length === 0 ? (
                    <FieldHint tone="amber">
                      No lists yet.{" "}
                      <a
                        href="/advertiser/email/lists"
                        className="font-medium underline underline-offset-2"
                      >
                        Create a list
                      </a>{" "}
                      first, then connect this automation to it.
                    </FieldHint>
                  ) : !form.listId ? (
                    <FieldHint>
                      Required — people who join this list enter when a lead is submitted
                      for its campaign.
                    </FieldHint>
                  ) : (
                    <FieldHint tone="success">
                      {selectedList?.campaignName?.trim()
                        ? `Feeds from lead campaign: ${selectedList.campaignName.trim()}`
                        : "Subscribers on this list enter when a matching lead is submitted."}
                    </FieldHint>
                  )}
                </div>
              </PanelSection>

              <PanelSection
                title="Tags on engagement"
                description="Optional. Applied when someone opens or clicks an email in this automation."
              >
                {tags.length === 0 ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
                    No tags yet.{" "}
                    <a
                      href="/advertiser/email/tags"
                      className="font-medium text-[var(--theme-primary)] underline underline-offset-2"
                    >
                      Create a tag
                    </a>{" "}
                    to label contacts on open or click.
                  </div>
                ) : (
                  <>
                    <div>
                      <FieldLabel>Tag on open</FieldLabel>
                      <Select
                        value={form.openTagId || "__none__"}
                        onValueChange={(v) => {
                          if (!v || v === "__none__") {
                            setForm({ openTagId: "" });
                            return;
                          }
                          setForm({ openTagId: v });
                        }}
                      >
                        <SelectTrigger className="mt-1.5 h-10 w-full">
                          <SelectValue placeholder="No tag">
                            {form.openTagId
                              ? (() => {
                                  const selectedTag = tags.find((t) => t.id === form.openTagId);
                                  return selectedTag ? selectedTag.name : "Unknown tag";
                                })()
                              : "No tag"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">No tag</SelectItem>
                          {tags.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <FieldLabel>Tag on click</FieldLabel>
                      <Select
                        value={form.clickTagId || "__none__"}
                        onValueChange={(v) => {
                          if (!v || v === "__none__") {
                            setForm({ clickTagId: "" });
                            return;
                          }
                          setForm({ clickTagId: v });
                        }}
                      >
                        <SelectTrigger className="mt-1.5 h-10 w-full">
                          <SelectValue placeholder="No tag">
                            {form.clickTagId
                              ? (() => {
                                  const selectedTag = tags.find((t) => t.id === form.clickTagId);
                                  return selectedTag ? selectedTag.name : "Unknown tag";
                                })()
                              : "No tag"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">No tag</SelectItem>
                          {tags.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <FieldHint>
                      When someone opens or clicks an email in this automation, they receive
                      that tag — the Tags page Subscribers count goes up.
                    </FieldHint>
                  </>
                )}
              </PanelSection>

              <PanelSection
                title="Sender"
                description="Defaults for emails that don’t override from name."
              >
                <div>
                  <FieldLabel>Default from name</FieldLabel>
                  <Input
                    className="mt-1.5 h-10"
                    value={form.fromName}
                    onChange={(e) => setForm({ fromName: e.target.value })}
                    placeholder="Your brand"
                  />
                </div>
                <div>
                  <FieldLabel>Reply-to email</FieldLabel>
                  <div className="relative mt-1.5">
                    <User className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-slate-400" />
                    <Input
                      type="email"
                      className="h-10 pl-9"
                      value={form.replyTo}
                      onChange={(e) => setForm({ replyTo: e.target.value })}
                      placeholder="you@example.com"
                    />
                  </div>
                </div>
              </PanelSection>
            </TabsContent>

            <TabsContent
              value="statistics"
              className="mt-0 min-h-0 flex-1 overflow-y-auto bg-white px-4 py-4"
            >
              {stats.length > 0 ? (
                (() => {
                  const sent = stats.reduce((n, s) => n + s.sent, 0);
                  const delivered = stats.reduce((n, s) => n + s.delivered, 0);
                  const bounced = stats.reduce((n, s) => n + s.bounced, 0);
                  const opens = stats.reduce((n, s) => n + s.opens, 0);
                  const clicks = stats.reduce((n, s) => n + s.clicks, 0);
                  return (
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                          Totals
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          All emails in this automation
                        </p>
                      </div>
                      <StepStatistics
                        stat={{
                          stepId: "totals",
                          order: 0,
                          delayMinutes: 0,
                          sent,
                          delivered,
                          bounced,
                          opens,
                          clicks,
                          openRate: sent > 0 ? Math.round((opens / sent) * 100) : 0,
                          clickRate: sent > 0 ? Math.round((clicks / sent) * 100) : 0,
                        }}
                      />
                    </div>
                  );
                })()
              ) : (
                <StatsEmpty
                  icon={BarChart3}
                  title="No sends yet"
                  description="Publish the automation to start tracking opens, clicks, and delivery."
                />
              )}
            </TabsContent>
          </>
        )}
      </Tabs>
    </aside>
  );
}
