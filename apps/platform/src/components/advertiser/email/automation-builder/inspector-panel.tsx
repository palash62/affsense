"use client";

import { useEffect, useState } from "react";
import {
  Clock,
  Mail,
  Minus,
  MousePointerClick,
  MailOpen,
  Plus,
  Send,
  Trash2,
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
import { DEFAULT_EMAIL_HTML, TRIGGER_LABELS, daysToMinutes, minutesToDays } from "./types";
import { EmailComposeEditor } from "./email-compose-editor";

type Props = {
  state: AutomationBuilderState;
};

type CreateMode = "quick" | "library";

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
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <div>
          <Label>
            Action name <span className="text-red-500">*</span>
          </Label>
          <Input
            className="mt-1.5"
            value={template.name}
            onChange={(e) =>
              void updateStepTemplate(selectedStep.clientId, { name: e.target.value })
            }
            placeholder="Day 1"
          />
        </div>

        <div>
          <Label>From name</Label>
          <Input
            className="mt-1.5"
            value={selectedStep.fromName}
            onChange={(e) =>
              updateStep(selectedStep.clientId, { fromName: e.target.value })
            }
            placeholder="From name"
          />
          <p className="mt-1 text-[11px] leading-snug text-slate-500">
            If From name and From email are empty, the email will be sent using default
            values.
          </p>
        </div>

        <div>
          <Label>From email</Label>
          <Input
            type="email"
            className="mt-1.5"
            value={selectedStep.fromEmail}
            onChange={(e) =>
              updateStep(selectedStep.clientId, { fromEmail: e.target.value })
            }
            placeholder="From email"
          />
        </div>

        <div>
          <Label>
            Subject <span className="text-red-500">*</span>
          </Label>
          <Input
            className="mt-1.5"
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
          <Label>Pre-header (Preview Text)</Label>
          <Input
            className="mt-1.5"
            value={template.previewText}
            onChange={(e) =>
              void updateStepTemplate(selectedStep.clientId, {
                previewText: e.target.value,
              })
            }
            placeholder="(Optional)"
          />
          <p className="mt-1 text-[11px] leading-snug text-slate-500">
            This will be used as the preview text that displays in some email clients.
          </p>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-slate-900">Create email</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setCreateMode("quick")}
              className={cn(
                "rounded-lg border px-3 py-2.5 text-left text-sm transition",
                createMode === "quick"
                  ? "border-blue-500 bg-blue-50/50 ring-1 ring-blue-500"
                  : "border-slate-200 hover:border-slate-300",
              )}
            >
              <span className="flex items-center gap-2 font-medium text-slate-900">
                <span
                  className={cn(
                    "flex size-3.5 items-center justify-center rounded-full border",
                    createMode === "quick" ? "border-blue-600" : "border-slate-300",
                  )}
                >
                  {createMode === "quick" ? (
                    <span className="size-2 rounded-full bg-blue-600" />
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
                  ? "border-blue-500 bg-blue-50/50 ring-1 ring-blue-500"
                  : "border-slate-200 hover:border-slate-300",
              )}
            >
              <span className="flex items-center gap-2 font-medium text-slate-900">
                <span
                  className={cn(
                    "flex size-3.5 items-center justify-center rounded-full border",
                    createMode === "library" ? "border-blue-600" : "border-slate-300",
                  )}
                >
                  {createMode === "library" ? (
                    <span className="size-2 rounded-full bg-blue-600" />
                  ) : null}
                </span>
                Select existing template
              </span>
            </button>
          </div>
        </div>

        {createMode === "library" ? (
          <div>
            <Label>Template</Label>
            <Select
              value={libraryId || "__pick__"}
              onValueChange={(v) => {
                if (!v || v === "__pick__") return;
                void onApplyLibrary(v);
              }}
            >
              <SelectTrigger className="mt-1.5 w-full">
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
            <Label>
              Type your message <span className="text-red-500">*</span>
            </Label>
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

        <div>
          <Label>
            Test emails <span className="text-red-500">*</span>
          </Label>
          <div className="mt-1.5 flex gap-2">
            <Input
              type="email"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="Test emails"
              className="flex-1"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={testing || !selectedStep.templateId}
              onClick={() => void onSendTest()}
            >
              {testing ? "Sending…" : "Send test mail"}
            </Button>
          </div>
          {testMsg ? (
            <p
              className={cn(
                "mt-1 text-xs",
                testMsg.includes("failed") ? "text-red-600" : "text-emerald-600",
              )}
            >
              {testMsg}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-200 bg-white px-4 py-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-red-600 hover:text-red-700"
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
      </div>
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
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <div>
          <Label>Action name</Label>
          <Input className="mt-1.5" value="Wait" readOnly />
        </div>

        <div>
          <Label>Time period</Label>
          <div className="mt-1.5 flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-9 shrink-0"
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
              className="h-9 text-center"
              value={days}
              onChange={(e) => setDays(Number(e.target.value) || 0)}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-9 shrink-0"
              disabled={days >= 365}
              onClick={() => setDays(days + 1)}
              aria-label="Increase days"
            >
              <Plus className="size-3.5" />
            </Button>
            <Select value="days" disabled>
              <SelectTrigger className="w-[100px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="days">Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
            Wait time is measured from the automation trigger before this email sends.
            {days === 0 ? " Immediate sends with no delay." : null}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-200 bg-white px-4 py-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-red-600 hover:text-red-700"
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
      </div>
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
    stats,
    validateFlash,
    issues,
  } = state;

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

  return (
    <aside className="flex h-full w-[460px] min-w-[440px] max-w-[520px] shrink-0 flex-col border-l border-slate-200/80 bg-white">
      <div className="border-b border-slate-100 px-4 py-3">
        {isWait ? (
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
              <Clock className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">Wait</p>
              <p className="text-xs text-slate-500">
                Hold for a set number of days before the next email
              </p>
            </div>
          </div>
        ) : isEmail ? (
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <Mail className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">Email</p>
              <p className="text-xs text-slate-500">Send an email to the contact</p>
            </div>
          </div>
        ) : (
          <p className="truncate text-sm font-semibold text-slate-900">Automation</p>
        )}
      </div>

      {showIssues ? (
        <div className="border-b border-red-100 bg-red-50 px-4 py-2">
          <ul className="space-y-0.5 text-xs text-red-700">
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
          className="w-full shrink-0 justify-start gap-0 rounded-none border-b border-slate-100 px-2"
        >
          <TabsTrigger value="content" className="px-3 text-xs">
            Content
          </TabsTrigger>
          <TabsTrigger value="statistics" className="px-3 text-xs">
            Statistics
          </TabsTrigger>
        </TabsList>

        {isWait ? (
          <>
            <TabsContent
              value="content"
              className="mt-0 flex min-h-0 flex-1 flex-col data-[hidden]:hidden"
            >
              <WaitContentForm state={state} />
            </TabsContent>
            <TabsContent
              value="statistics"
              className="mt-0 min-h-0 flex-1 overflow-y-auto px-4 py-4"
            >
              <p className="text-sm text-slate-500">
                Wait steps do not send email. Select the following email to view send
                statistics.
              </p>
            </TabsContent>
          </>
        ) : isEmail ? (
          <>
            <TabsContent
              value="content"
              className="mt-0 flex min-h-0 flex-1 flex-col data-[hidden]:hidden"
            >
              <EmailContentForm state={state} />
            </TabsContent>
            <TabsContent
              value="statistics"
              className="mt-0 min-h-0 flex-1 overflow-y-auto px-4 py-4"
            >
              {stepStat ? (
                <StepStatistics stat={stepStat} />
              ) : (
                <p className="text-sm text-slate-500">
                  Statistics appear after this automation has sent emails.
                </p>
              )}
            </TabsContent>
          </>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <TabsContent value="content" className="mt-0 space-y-4">
              <div>
                <Label>Automation name</Label>
                <Input
                  className="mt-1.5"
                  value={form.name}
                  onChange={(e) => setForm({ name: e.target.value })}
                  placeholder="Welcome sequence"
                />
              </div>
              <div>
                <Label>Trigger</Label>
                <Select
                  value={form.trigger}
                  onValueChange={(v) => {
                    if (v === "LEAD_CAPTURED" || v === "LEAD_APPROVED") {
                      setForm({ trigger: v });
                    }
                  }}
                >
                  <SelectTrigger className="mt-1.5 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TRIGGER_LABELS) as Array<keyof typeof TRIGGER_LABELS>).map(
                      (key) => (
                        <SelectItem key={key} value={key}>
                          {TRIGGER_LABELS[key]}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>List</Label>
                <Select
                  value={
                    lists.find((l) => l.campaignId === form.campaignId)?.id ?? ""
                  }
                  onValueChange={(listId) => {
                    const list = lists.find((l) => l.id === listId);
                    if (list) setForm({ campaignId: list.campaignId });
                  }}
                >
                  <SelectTrigger className="mt-1.5 w-full">
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
                {lists.length === 0 ? (
                  <p className="mt-1.5 text-xs text-amber-700">
                    No lists yet.{" "}
                    <a
                      href="/advertiser/email/lists"
                      className="font-medium underline underline-offset-2"
                    >
                      Create a list
                    </a>{" "}
                    first, then attach this automation to it.
                  </p>
                ) : !form.campaignId ? (
                  <p className="mt-1.5 text-xs text-slate-500">Required — lists are tied to a campaign.</p>
                ) : null}
              </div>
              <div>
                <Label>Default from name</Label>
                <Input
                  className="mt-1.5"
                  value={form.fromName}
                  onChange={(e) => setForm({ fromName: e.target.value })}
                  placeholder="Your brand"
                />
              </div>
              <div>
                <Label>Reply-to email</Label>
                <Input
                  type="email"
                  className="mt-1.5"
                  value={form.replyTo}
                  onChange={(e) => setForm({ replyTo: e.target.value })}
                  placeholder="you@example.com"
                />
              </div>
            </TabsContent>

            <TabsContent value="statistics" className="mt-0 space-y-3">
              {stats.length > 0 ? (
                stats.map((s) => (
                  <div key={s.stepId} className="space-y-2">
                    <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      Step {s.order + 1}
                    </p>
                    <StepStatistics stat={s} />
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  No sends yet. Publish the automation to start tracking.
                </p>
              )}
            </TabsContent>
          </div>
        )}
      </Tabs>
    </aside>
  );
}
