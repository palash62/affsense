export type Trigger = "LEAD_CAPTURED" | "LEAD_APPROVED";

export type AutomationStepType = "SEND_EMAIL";

/** Managed email list (excludes virtual All Subscribers). */
export type EmailListOption = {
  id: string;
  name: string;
  campaignId: string;
  /** Lead campaign that feeds this list (context only). */
  campaignName?: string | null;
};

export type Template = {
  id: string;
  name: string;
  subject?: string;
  previewText?: string | null;
};

export type TagOption = {
  id: string;
  name: string;
  color: string | null;
};

/** Full editable template content for a step. */
export type TemplateContent = {
  id: string;
  name: string;
  subject: string;
  previewText: string;
  htmlBody: string;
};

export type AutomationStep = {
  /** Client-stable id for React Flow (not sent to API). */
  clientId: string;
  type: AutomationStepType;
  templateId: string;
  /** Optional tag applied to the contact when this email is sent. */
  tagId: string;
  delayMinutes: number;
  order: number;
  fromName: string;
  fromEmail: string;
  /** Server step id when editing (for stats). */
  serverId?: string;
};

export type AutomationForm = {
  name: string;
  trigger: Trigger;
  /** UI audience — mapped to campaignId on persist. */
  listId: string;
  fromName: string;
  replyTo: string;
};

export type Selection =
  | { kind: "trigger" }
  | { kind: "email"; clientId: string }
  | { kind: "wait"; clientId: string }
  | { kind: "canvas" };

export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "blocked" | "error";

export type StepStat = {
  stepId: string;
  order: number;
  delayMinutes: number;
  sent: number;
  opens: number;
  clicks: number;
  openRate: number;
  clickRate: number;
};

export type ValidationIssue = {
  path: string;
  message: string;
  stepClientId?: string;
};

export const MINUTES_PER_DAY = 1440;

export const DELAY_PRESETS = [
  { label: "Immediate", days: 0 },
  { label: "1 day", days: 1 },
  { label: "3 days", days: 3 },
  { label: "7 days", days: 7 },
  { label: "14 days", days: 14 },
  { label: "30 days", days: 30 },
] as const;

export const MAX_STEPS = 20;
export const TEMPLATE_NONE = "__none__";

export const DEFAULT_EMAIL_HTML = `<!DOCTYPE html>
<html><body style="font-family:Inter,sans-serif;color:#1e293b;max-width:600px;margin:0 auto;padding:24px;">
<p>Hi {{first_name}},</p>
<p>Write your email here.</p>
<p>{{company_name}}</p>
</body></html>`;

export const TRIGGER_LABELS: Record<Trigger, string> = {
  LEAD_CAPTURED: "When lead is submitted",
  LEAD_APPROVED: "When lead is approved",
};

export function daysToMinutes(days: number) {
  return Math.round(days * MINUTES_PER_DAY);
}

export function minutesToDays(minutes: number) {
  return minutes / MINUTES_PER_DAY;
}

export function newStepClientId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `step-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createEmptyStep(order: number, delayMinutes = 0): AutomationStep {
  return {
    clientId: newStepClientId(),
    type: "SEND_EMAIL",
    templateId: "",
    tagId: "",
    delayMinutes,
    order,
    fromName: "",
    fromEmail: "",
  };
}

/**
 * Merge legacy APPLY_TAG steps onto the previous email and drop APPLY/REMOVE tag steps.
 */
export function normalizeServerStepsToEmailOnly<
  T extends {
    id: string;
    type?: string | null;
    templateId?: string | null;
    tagId?: string | null;
    delayMinutes: number;
    order: number;
    fromName?: string | null;
    fromEmail?: string | null;
  },
>(serverSteps: T[]): AutomationStep[] {
  const sorted = [...serverSteps].sort((a, b) => a.order - b.order);
  const emails: AutomationStep[] = [];

  for (const s of sorted) {
    const type = s.type ?? "SEND_EMAIL";
    if (type === "SEND_EMAIL") {
      emails.push({
        clientId: s.id,
        serverId: s.id,
        type: "SEND_EMAIL",
        templateId: s.templateId ?? "",
        tagId: s.tagId ?? "",
        delayMinutes: s.delayMinutes,
        order: emails.length,
        fromName: s.fromName ?? "",
        fromEmail: s.fromEmail ?? "",
      });
      continue;
    }
    if (type === "APPLY_TAG" && s.tagId) {
      const prev = emails[emails.length - 1];
      if (prev && !prev.tagId) {
        prev.tagId = s.tagId;
      }
    }
    // REMOVE_TAG and leftover APPLY_TAG without a prior email: drop
  }

  return emails.map((s, i) => ({ ...s, order: i }));
}

export function formatDelay(minutes: number): string {
  const days = minutesToDays(minutes);
  const preset = DELAY_PRESETS.find((p) => p.days === days);
  if (preset) return preset.label;
  if (minutes === 0) return "Immediate";
  if (Number.isInteger(days)) {
    return `${days} day${days === 1 ? "" : "s"}`;
  }
  if (days < 1) {
    const hours = minutes / 60;
    if (Number.isInteger(hours)) {
      return `${hours} hr${hours === 1 ? "" : "s"}`;
    }
    return `${minutes} min`;
  }
  const rounded = Math.round(days * 10) / 10;
  return `${rounded} day${rounded === 1 ? "" : "s"}`;
}
