"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type {
  PublisherTaskSubmissionSummary,
} from "@/services/publisher-task-submission.service";
import type { SerializedGetPaidTask } from "@/services/get-paid-task.service";

type TaskDetail = {
  task: SerializedGetPaidTask;
  submission: PublisherTaskSubmissionSummary | null;
};

export function PublisherTaskDetailSheet({
  taskId,
  open,
  onOpenChange,
  onSubmitted,
}: {
  taskId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmitted: () => void;
}) {
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [proofUrl, setProofUrl] = useState("");

  useEffect(() => {
    if (!open || !taskId) {
      setDetail(null);
      setProofUrl("");
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetch(`/api/v1/publisher/get-paid-tasks/${taskId}`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) {
          setDetail(json.data ?? null);
          setProofUrl(json.data?.submission?.proofUrl ?? "");
        }
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load task details");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, taskId]);

  const submission = detail?.submission;
  const task = detail?.task;
  const canSubmit = Boolean(task && (!submission || submission.status === "REJECTED"));

  async function handleSubmit() {
    if (!taskId || !task) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/publisher/get-paid-tasks/${taskId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proofUrl: proofUrl.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error?.message ?? "Failed to submit task");
        return;
      }
      toast.success("Submission sent for review");
      onSubmitted();
      onOpenChange(false);
    } catch {
      toast.error("Failed to submit task");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{task?.title ?? "Task details"}</SheetTitle>
          <SheetDescription>
            {task
              ? `${task.category} · ${task.taskType} · $${task.rewardAmount.toFixed(2)} reward`
              : "Loading task..."}
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : task ? (
          <div className="space-y-5 px-4">
            {submission?.status === "PENDING" ? (
              <div className="rounded-lg border border-[color-mix(in_srgb,var(--warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--warning)_10%,white)] p-3 text-sm text-foreground">
                Your submission is pending admin review.
              </div>
            ) : null}
            {submission?.status === "APPROVED" ? (
              <div className="rounded-lg border border-[color-mix(in_srgb,var(--theme-success)_30%,transparent)] bg-[color-mix(in_srgb,var(--theme-success)_10%,white)] p-3 text-sm text-foreground">
                This task has been approved. Reward: ${task.rewardAmount.toFixed(2)}
              </div>
            ) : null}
            {submission?.status === "REJECTED" ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-foreground">
                Your previous submission was rejected. You may submit again with updated proof.
              </div>
            ) : null}

            {task.descriptionHtml ? (
              <div
                className="prose prose-sm max-w-none text-foreground"
                dangerouslySetInnerHTML={{ __html: task.descriptionHtml }}
              />
            ) : (
              <p className="text-sm text-muted-foreground">{task.descriptionText}</p>
            )}

            <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <p className="font-semibold text-foreground">Required action</p>
              <p className="mt-1 text-muted-foreground">{task.requiredAction}</p>
              {task.requiredLink ? (
                <ButtonLink
                  href={task.requiredLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  size="sm"
                  className="mt-3 h-8 gap-1.5 rounded-md bg-[var(--theme-primary)]"
                >
                  Open link
                  <ExternalLink className="h-3.5 w-3.5" />
                </ButtonLink>
              ) : null}
            </div>

            {task.additionalInstructions ? (
              <div className="text-sm">
                <p className="font-semibold text-foreground">Additional instructions</p>
                <p className="mt-1 text-muted-foreground">{task.additionalInstructions}</p>
              </div>
            ) : null}

            {(task.dailyLimit != null || task.totalLimit != null) && (
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                {task.dailyLimit != null ? <span>Daily limit: {task.dailyLimit}</span> : null}
                {task.totalLimit != null ? <span>Total limit: {task.totalLimit}</span> : null}
              </div>
            )}

            {canSubmit ? (
              <div className="space-y-2">
                {task.proofRequired ? (
                  <>
                    <Label htmlFor="proofUrl">Proof URL (HTTPS)</Label>
                    <Input
                      id="proofUrl"
                      type="url"
                      placeholder="https://example.com/screenshot.png"
                      value={proofUrl}
                      onChange={(e) => setProofUrl(e.target.value)}
                      className="h-9"
                    />
                    <p className="text-xs text-muted-foreground">
                      Paste a link to your screenshot or proof image.
                    </p>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <SheetFooter className="px-4">
          {canSubmit ? (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full bg-[var(--theme-primary)] hover:opacity-90"
            >
              {submitting ? "Submitting..." : "Submit for review"}
            </Button>
          ) : null}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
