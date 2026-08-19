"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Send } from "lucide-react";
import { toast } from "sonner";
import { AdminBreadcrumbs } from "@/components/admin/digital-products/admin-breadcrumbs";
import {
  DashboardCard,
  DashboardCardTitle,
} from "@/components/admin/affsense-dashboard/dashboard-card";
import { CpaCountryMultiSelect } from "@/components/cpa/cpa-country-multi-select";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
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
import { cn } from "@/lib/utils";
import {
  DEFAULT_FORM_VALUES,
  REQUIRED_ACTIONS,
  TASK_TYPES,
  type GetPaidTaskFormValues,
} from "./get-paid-task-types";
import { SettingToggle } from "./setting-toggle";
import { TaskDescriptionEditor } from "./task-description-editor";
import { TaskGuidelinesPanel } from "./task-guidelines-panel";
import { TaskHowItWorksPanel } from "./task-how-it-works-panel";
import { TaskPreviewPanel } from "./task-preview-panel";
import { TaskSettingsPanel } from "./task-settings-panel";

function SectionHeader({ number, title }: { number: number; title: string }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--theme-primary-soft)] text-sm font-bold text-[var(--theme-primary)]">
        {number}
      </span>
      <DashboardCardTitle className="text-lg">{title}</DashboardCardTitle>
    </div>
  );
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <Label className="text-sm font-medium text-foreground">
      {children}
      {required ? <span className="ml-0.5 text-red-500">*</span> : null}
    </Label>
  );
}

export function GetPaidTaskForm() {
  const router = useRouter();
  const [values, setValues] = useState<GetPaidTaskFormValues>(DEFAULT_FORM_VALUES);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/v1/admin/get-paid-tasks/categories")
      .then((r) => r.json())
      .then((json) => {
        setCategories((json.data ?? []).map((c: { name: string }) => c.name));
      })
      .catch(() => {});
  }, []);

  const canPublish = useMemo(
    () =>
      values.title.trim().length >= 2 &&
      values.category.trim().length >= 1 &&
      values.taskType.trim().length >= 1 &&
      values.requiredAction.trim().length >= 1 &&
      values.requiredLink.trim().length >= 1 &&
      values.descriptionText.trim().length >= 1,
    [values],
  );

  function patch(partial: Partial<GetPaidTaskFormValues>) {
    setValues((prev) => ({ ...prev, ...partial }));
  }

  async function persist(status: "Active" | "Draft", message: string) {
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/v1/admin/get-paid-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: values.title,
          category: values.category,
          descriptionHtml: values.descriptionHtml,
          descriptionText: values.descriptionText,
          taskType: values.taskType,
          requiredAction: values.requiredAction,
          requiredLink: values.requiredLink,
          additionalInstructions: values.additionalInstructions,
          rewardAmount: Number(values.rewardAmount) || 0,
          dailyLimit: values.dailyLimit ? Number(values.dailyLimit) : undefined,
          totalLimit: values.totalLimit ? Number(values.totalLimit) : undefined,
          proofRequired: values.proofRequired,
          deductPoints: values.deductPoints,
          disallowedCountries: values.disallowedCountries,
          status,
          showOnDashboard: values.showOnDashboard,
          featured: values.featured,
          isNew: values.isNew,
          startDate: values.startDate || undefined,
          endDate: values.endDate || undefined,
        }),
      });
      if (!res.ok) throw new Error("save failed");
      toast.success(message);
      router.push("/admin/get-paid-tasks");
    } catch {
      toast.error("Could not save task");
    } finally {
      setSaving(false);
    }
  }

  function handleSaveDraft() {
    if (values.title.trim().length < 2) {
      toast.error("Enter a task title to save a draft");
      return;
    }
    persist("Draft", "Draft saved");
  }

  function handlePublish() {
    if (!canPublish) {
      toast.error("Fill in all required fields before publishing");
      return;
    }
    persist("Active", "Task published");
  }

  return (
    <div className="space-y-5 pb-24">
      <AdminBreadcrumbs
        items={[
          { label: "Dashboard", href: "/admin" },
          { label: "Get Paid Tasks", href: "/admin/get-paid-tasks" },
          { label: "Add New Task" },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-12">
        <div className="space-y-5 xl:col-span-8">
          <DashboardCard>
            <SectionHeader number={1} title="Task Information" />
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <FieldLabel required>Task Title</FieldLabel>
                <Input
                  value={values.title}
                  onChange={(e) => patch({ title: e.target.value })}
                  placeholder="Example: Follow our Instagram Account"
                  className="h-10 rounded-md"
                />
              </div>
              <div className="space-y-2">
                <FieldLabel required>Task Category</FieldLabel>
                <Select
                  value={values.category}
                  onValueChange={(v) => patch({ category: v ?? values.category })}
                >
                  <SelectTrigger className="h-10 w-full rounded-md bg-card">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <FieldLabel required>Task Type</FieldLabel>
                <Select
                  value={values.taskType}
                  onValueChange={(v) => patch({ taskType: v ?? values.taskType })}
                >
                  <SelectTrigger className="h-10 w-full rounded-md bg-card">
                    <SelectValue placeholder="Select Task Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <FieldLabel required>Task Description</FieldLabel>
              <TaskDescriptionEditor
                value={values.descriptionHtml}
                onChange={(html, text) => patch({ descriptionHtml: html, descriptionText: text })}
              />
            </div>

            <div className="mt-5 space-y-2">
              <FieldLabel required>Proof Required?</FieldLabel>
              <div className="flex gap-2">
                {[true, false].map((yes) => (
                  <button
                    key={String(yes)}
                    type="button"
                    onClick={() => patch({ proofRequired: yes })}
                    className={cn(
                      "h-9 rounded-md border px-4 text-sm font-medium transition-colors",
                      values.proofRequired === yes
                        ? "border-[var(--theme-primary)] bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]"
                        : "border-border bg-card text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {yes ? "Yes" : "No"}
                  </button>
                ))}
              </div>
            </div>
          </DashboardCard>

          <DashboardCard>
            <SectionHeader number={2} title="Reward & Limits" />
            <div className="grid gap-5 md:grid-cols-3">
              <div className="space-y-2">
                <FieldLabel required>Reward Amount (USD)</FieldLabel>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    $
                  </span>
                  <Input
                    value={values.rewardAmount}
                    onChange={(e) => patch({ rewardAmount: e.target.value })}
                    placeholder="0.50"
                    className="h-10 rounded-md pl-7"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <FieldLabel>Daily Task Limit (Per User)</FieldLabel>
                <Input
                  value={values.dailyLimit}
                  onChange={(e) => patch({ dailyLimit: e.target.value })}
                  placeholder="Example: 3"
                  className="h-10 rounded-md"
                />
              </div>
              <div className="space-y-2">
                <FieldLabel>Total Completions Limit (Optional)</FieldLabel>
                <Input
                  value={values.totalLimit}
                  onChange={(e) => patch({ totalLimit: e.target.value })}
                  placeholder="Example: 1000"
                  className="h-10 rounded-md"
                />
              </div>
            </div>
            <div className="mt-5 rounded-md border border-border bg-muted/40 px-4 py-3">
              <SettingToggle
                label="Deduct Points Instead of Cash?"
                checked={values.deductPoints}
                onCheckedChange={(on) => patch({ deductPoints: on })}
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Enable this if task rewards will be in points.
              </p>
            </div>
          </DashboardCard>

          <DashboardCard>
            <SectionHeader number={3} title="Task Requirements" />
            <div className="grid gap-5 md:grid-cols-2">
              <div className="space-y-2">
                <FieldLabel required>Required Action</FieldLabel>
                <Select
                  value={values.requiredAction}
                  onValueChange={(v) => patch({ requiredAction: v ?? values.requiredAction })}
                >
                  <SelectTrigger className="h-10 w-full rounded-md bg-card">
                    <SelectValue placeholder="Select Action" />
                  </SelectTrigger>
                  <SelectContent>
                    {REQUIRED_ACTIONS.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <FieldLabel required>Required Link / Page / Username</FieldLabel>
                <Input
                  value={values.requiredLink}
                  onChange={(e) => patch({ requiredLink: e.target.value })}
                  placeholder="Example: https://instagram.com/affsense"
                  className="h-10 rounded-md"
                />
              </div>
            </div>
            <div className="mt-5 space-y-2">
              <FieldLabel>Additional Instructions (Optional)</FieldLabel>
              <Textarea
                value={values.additionalInstructions}
                onChange={(e) => patch({ additionalInstructions: e.target.value })}
                placeholder="Any extra details for members..."
                rows={3}
                className="resize-none rounded-md"
              />
            </div>
            <div className="mt-5 space-y-2">
              <FieldLabel>Disallowed Countries (Optional)</FieldLabel>
              <CpaCountryMultiSelect
                value={values.disallowedCountries}
                onChange={(codes) => patch({ disallowedCountries: codes })}
              />
            </div>
          </DashboardCard>

          <DashboardCard className="overflow-hidden p-0">
            <button
              type="button"
              onClick={() => setReviewOpen((o) => !o)}
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--theme-primary-soft)] text-sm font-bold text-[var(--theme-primary)]">
                  4
                </span>
                <DashboardCardTitle className="text-lg">Review & Publish</DashboardCardTitle>
              </div>
              <ChevronDown
                className={cn(
                  "h-5 w-5 shrink-0 text-muted-foreground transition-transform",
                  reviewOpen && "rotate-180",
                )}
              />
            </button>
            {reviewOpen ? (
              <div className="space-y-2 border-t border-border px-5 pb-5 text-sm">
                <ReviewRow label="Title" value={values.title || "—"} />
                <ReviewRow label="Category" value={values.category || "—"} />
                <ReviewRow label="Type" value={values.taskType || "—"} />
                <ReviewRow label="Action" value={values.requiredAction || "—"} />
                <ReviewRow
                  label="Reward"
                  value={`$${(Number.parseFloat(values.rewardAmount) || 0).toFixed(2)}`}
                />
                <ReviewRow label="Proof" value={values.proofRequired ? "Required" : "Not required"} />
                <ReviewRow label="Status" value={values.status} />
              </div>
            ) : null}
          </DashboardCard>
        </div>

        <aside className="space-y-5 xl:col-span-4">
          <div className="xl:sticky xl:top-24 xl:space-y-5">
            <TaskPreviewPanel values={values} />
            <TaskSettingsPanel values={values} onChange={patch} />
            <TaskGuidelinesPanel />
            <TaskHowItWorksPanel />
          </div>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-4 py-3 backdrop-blur-sm sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2.5">
          <ButtonLink
            href="/admin/get-paid-tasks"
            variant="outline"
            className="h-10 rounded-md border-border px-5"
          >
            Cancel
          </ButtonLink>
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-md border-border px-5"
              onClick={handleSaveDraft}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save as Draft"}
            </Button>
            <Button
              type="button"
              className={cn(
                "h-10 gap-2 rounded-md bg-[var(--theme-primary)] px-5 hover:opacity-90",
                !canPublish && "opacity-60",
              )}
              onClick={handlePublish}
              disabled={saving}
            >
              <Send className="h-4 w-4" />
              {saving ? "Publishing..." : "Save & Publish"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/60 py-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[60%] truncate text-right font-medium text-foreground">{value}</span>
    </div>
  );
}

