import type {
  AutomationForm,
  AutomationStep,
  SendingIdentityOption,
  TagOption,
  Template,
  ValidationIssue,
} from "./types";
import { MAX_STEPS } from "./types";

export function validateAutomation(
  form: AutomationForm,
  steps: AutomationStep[],
  templates: Template[],
  tags: TagOption[] = [],
  options: {
    defaultFromEmail?: string;
    identities?: SendingIdentityOption[];
  } = {},
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const name = form.name.trim();
  if (name.length < 2) {
    issues.push({ path: "name", message: "Name must be at least 2 characters" });
  } else if (name.length > 80) {
    issues.push({ path: "name", message: "Name must be at most 80 characters" });
  }

  const fromName = form.fromName.trim();
  if (fromName.length < 2) {
    issues.push({ path: "fromName", message: "From name is required" });
  } else if (fromName.length > 80) {
    issues.push({ path: "fromName", message: "From name must be at most 80 characters" });
  }

  if (!form.listId.trim()) {
    issues.push({ path: "listId", message: "Select a list" });
  }

  if (form.replyTo.trim()) {
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.replyTo.trim());
    if (!emailOk) {
      issues.push({ path: "replyTo", message: "Reply-to must be a valid email" });
    }
  }

  if (steps.length < 1) {
    issues.push({ path: "steps", message: "Add at least one email action" });
  }
  if (steps.length > MAX_STEPS) {
    issues.push({ path: "steps", message: `Maximum ${MAX_STEPS} emails` });
  }

  const templateIds = new Set(templates.map((t) => t.id));
  const tagIds = new Set(tags.map((t) => t.id));
  const verifiedEmails = new Set(
    (options.identities ?? [])
      .filter((i) => i.verificationStatus === "VERIFIED" || i.ready)
      .flatMap((i) => {
        if (i.mailboxes && i.mailboxes.length > 0) {
          return i.mailboxes.map((m) => m.email.trim().toLowerCase());
        }
        return [i.fromEmail.trim().toLowerCase()];
      }),
  );
  const defaultFrom = (options.defaultFromEmail ?? "").trim().toLowerCase();

  if (form.openTagId && tagIds.size > 0 && !tagIds.has(form.openTagId)) {
    issues.push({ path: "openTagId", message: "Open tag not found" });
  }
  if (form.clickTagId && tagIds.size > 0 && !tagIds.has(form.clickTagId)) {
    issues.push({ path: "clickTagId", message: "Click tag not found" });
  }

  if (verifiedEmails.size === 0) {
    issues.push({
      path: "fromEmail",
      message: "Add and verify a sending domain before publishing",
    });
  } else if (!defaultFrom && steps.some((s) => !s.fromEmail.trim())) {
    issues.push({
      path: "fromEmail",
      message:
        "Set a default from email in Email Settings, or choose one on every email action",
    });
  } else if (defaultFrom && !verifiedEmails.has(defaultFrom)) {
    issues.push({
      path: "fromEmail",
      message: "Default from email must be a verified domain address",
    });
  }

  steps.forEach((step, i) => {
    if (!step.templateId) {
      issues.push({
        path: `steps.${i}.templateId`,
        message: `Email ${i + 1}: choose a template`,
        stepClientId: step.clientId,
      });
    } else if (!templateIds.has(step.templateId)) {
      issues.push({
        path: `steps.${i}.templateId`,
        message: `Email ${i + 1}: template not found`,
        stepClientId: step.clientId,
      });
    }
    if (step.delayMinutes < 0 || step.delayMinutes > 525600) {
      issues.push({
        path: `steps.${i}.delayMinutes`,
        message: `Email ${i + 1}: invalid delay`,
        stepClientId: step.clientId,
      });
    }
    const stepFrom = step.fromEmail.trim().toLowerCase();
    const resolved = stepFrom || defaultFrom;
    if (!resolved) {
      issues.push({
        path: `steps.${i}.fromEmail`,
        message: `Email ${i + 1}: select a from email`,
        stepClientId: step.clientId,
      });
    } else if (verifiedEmails.size > 0 && !verifiedEmails.has(resolved)) {
      issues.push({
        path: `steps.${i}.fromEmail`,
        message: `Email ${i + 1}: from email must be a verified domain address`,
        stepClientId: step.clientId,
      });
    }
  });

  return issues;
}

export function canPersist(
  form: AutomationForm,
  steps: AutomationStep[],
  templates: Template[],
  tags: TagOption[] = [],
  options: {
    defaultFromEmail?: string;
    identities?: SendingIdentityOption[];
  } = {},
) {
  return validateAutomation(form, steps, templates, tags, options).length === 0;
}
