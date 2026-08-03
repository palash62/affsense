import type { AutomationForm, AutomationStep, Template, ValidationIssue } from "./types";
import { MAX_STEPS } from "./types";

export function validateAutomation(
  form: AutomationForm,
  steps: AutomationStep[],
  templates: Template[],
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

  if (!form.campaignId.trim()) {
    issues.push({ path: "campaignId", message: "Select a list" });
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
  });

  return issues;
}

export function canPersist(form: AutomationForm, steps: AutomationStep[], templates: Template[]) {
  return validateAutomation(form, steps, templates).length === 0;
}
