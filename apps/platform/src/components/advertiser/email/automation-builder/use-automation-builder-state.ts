"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AutomationForm,
  AutomationStep,
  EmailListOption,
  SaveStatus,
  Selection,
  SendingIdentityOption,
  StepStat,
  TagOption,
  Template,
  TemplateContent,
  Trigger,
} from "./types";
import {
  DEFAULT_EMAIL_HTML,
  MAX_STEPS,
  MINUTES_PER_DAY,
  createEmptyStep,
  newStepClientId,
  normalizeServerStepsToEmailOnly,
} from "./types";
import { canPersist, validateAutomation } from "./validation";

type Snapshot = {
  form: AutomationForm;
  steps: AutomationStep[];
  templateContents: Record<string, TemplateContent>;
};

type Props = {
  automationId?: string;
  lists: EmailListOption[];
  initialCreate?: { name: string; trigger: Trigger };
};

const HISTORY_LIMIT = 50;
export const AUTOSAVE_MS = 1600;

function cloneSnapshot(s: Snapshot): Snapshot {
  return {
    form: { ...s.form },
    steps: s.steps.map((st) => ({ ...st })),
    templateContents: Object.fromEntries(
      Object.entries(s.templateContents).map(([k, v]) => [k, { ...v }]),
    ),
  };
}

function toContent(t: {
  id: string;
  name: string;
  subject: string;
  previewText?: string | null;
  htmlBody: string;
}): TemplateContent {
  return {
    id: t.id,
    name: t.name,
    subject: t.subject,
    previewText: t.previewText ?? "",
    htmlBody: t.htmlBody,
  };
}

async function createStepTemplate(label: string): Promise<TemplateContent> {
  const res = await fetch("/api/v1/advertiser/email/templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: label,
      subject: "Your subject here",
      htmlBody: DEFAULT_EMAIL_HTML,
      previewText: "",
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.data) {
    throw new Error(json?.error?.message ?? "Failed to create email template");
  }
  return toContent(json.data);
}

export function useAutomationBuilderState({
  automationId: initialId,
  lists,
  initialCreate,
}: Props) {
  const router = useRouter();
  const [automationId, setAutomationId] = useState<string | undefined>(initialId);
  const [form, setFormState] = useState<AutomationForm>(() => ({
    name: initialCreate?.name ?? "",
    trigger: initialCreate?.trigger ?? "LEAD_CAPTURED",
    listId: "",
    fromName: "",
    replyTo: "",
    openTagId: "",
    clickTagId: "",
  }));
  const [steps, setStepsState] = useState<AutomationStep[]>([]);
  const [templateContents, setTemplateContents] = useState<Record<string, TemplateContent>>({});
  const [templates, setTemplates] = useState<Template[]>([]);
  const [tags, setTags] = useState<TagOption[]>([]);
  const [identities, setIdentities] = useState<SendingIdentityOption[]>([]);
  const [defaultFromEmail, setDefaultFromEmail] = useState("");
  const [stats, setStats] = useState<StepStat[]>([]);
  const [selection, setSelection] = useState<Selection>({ kind: "trigger" });
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState("");
  const [loading, setLoading] = useState(Boolean(initialId));
  const [addingStep, setAddingStep] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [insertIndex, setInsertIndex] = useState(0);
  const [validateFlash, setValidateFlash] = useState(false);
  const [historyTick, setHistoryTick] = useState(0);

  const pastRef = useRef<Snapshot[]>([]);
  const futureRef = useRef<Snapshot[]>([]);
  const skipHistoryRef = useRef(false);
  const dirtyRef = useRef(false);
  const snapshotRef = useRef<Snapshot>({ form, steps, templateContents });
  const hydratedRef = useRef(!initialId);
  const persistInFlight = useRef(false);
  const templatePatchTimers = useRef<Record<string, number>>({});
  const stepSnapshotsRef = useRef<
    Record<string, { step: AutomationStep; template: TemplateContent }>
  >({});

  const captureStepSnapshot = useCallback(
    (clientId: string, stepList?: AutomationStep[], contents?: Record<string, TemplateContent>) => {
      const list = stepList ?? snapshotRef.current.steps;
      const map = contents ?? snapshotRef.current.templateContents;
      const step = list.find((s) => s.clientId === clientId);
      if (!step?.templateId) return;
      const template = map[step.templateId];
      if (!template) return;
      stepSnapshotsRef.current[clientId] = {
        step: { ...step },
        template: { ...template },
      };
    },
    [],
  );

  useEffect(() => {
    snapshotRef.current = { form, steps, templateContents };
  }, [form, steps, templateContents]);

  const pushHistory = useCallback(() => {
    if (skipHistoryRef.current) return;
    pastRef.current = [
      ...pastRef.current.slice(-(HISTORY_LIMIT - 1)),
      cloneSnapshot(snapshotRef.current),
    ];
    futureRef.current = [];
    setHistoryTick((t) => t + 1);
  }, []);

  const setForm = useCallback(
    (patch: Partial<AutomationForm> | ((prev: AutomationForm) => AutomationForm)) => {
      pushHistory();
      setFormState((prev) =>
        typeof patch === "function" ? patch(prev) : { ...prev, ...patch },
      );
      dirtyRef.current = true;
      setSaveStatus("dirty");
    },
    [pushHistory],
  );

  const setSteps = useCallback(
    (updater: AutomationStep[] | ((prev: AutomationStep[]) => AutomationStep[])) => {
      pushHistory();
      setStepsState((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        return next.map((s, i) => ({ ...s, order: i }));
      });
      dirtyRef.current = true;
      setSaveStatus("dirty");
    },
    [pushHistory],
  );

  const undo = useCallback(() => {
    const prev = pastRef.current.pop();
    if (!prev) return;
    futureRef.current.push(cloneSnapshot(snapshotRef.current));
    skipHistoryRef.current = true;
    setFormState(prev.form);
    setStepsState(prev.steps);
    setTemplateContents(prev.templateContents);
    dirtyRef.current = true;
    setSaveStatus("dirty");
    skipHistoryRef.current = false;
    setHistoryTick((t) => t + 1);
  }, []);

  const redo = useCallback(() => {
    const next = futureRef.current.pop();
    if (!next) return;
    pastRef.current.push(cloneSnapshot(snapshotRef.current));
    skipHistoryRef.current = true;
    setFormState(next.form);
    setStepsState(next.steps);
    setTemplateContents(next.templateContents);
    dirtyRef.current = true;
    setSaveStatus("dirty");
    skipHistoryRef.current = false;
    setHistoryTick((t) => t + 1);
  }, []);

  const validationOptions = useMemo(
    () => ({ defaultFromEmail, identities }),
    [defaultFromEmail, identities],
  );

  const issues = useMemo(
    () => validateAutomation(form, steps, templates, tags, validationOptions),
    [form, steps, templates, tags, validationOptions],
  );

  const invalidStepIds = useMemo(() => {
    const set = new Set<string>();
    for (const issue of issues) {
      if (issue.stepClientId) set.add(issue.stepClientId);
    }
    return set;
  }, [issues]);

  const refreshTemplateList = useCallback((contents: Record<string, TemplateContent>) => {
    setTemplates((prev) => {
      const byId = new Map(prev.map((t) => [t.id, t]));
      for (const c of Object.values(contents)) {
        byId.set(c.id, {
          id: c.id,
          name: c.name,
          subject: c.subject,
          previewText: c.previewText,
        });
      }
      return Array.from(byId.values());
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/v1/advertiser/email/templates").then((r) => r.json()),
      fetch("/api/v1/advertiser/email/settings").then((r) => r.json()),
      fetch("/api/v1/advertiser/email/tags").then((r) => r.json()),
      fetch("/api/v1/advertiser/email/identities").then((r) => r.json()),
    ]).then(([tpl, settings, tagsRes, identitiesRes]) => {
      if (cancelled) return;
      setTemplates(tpl.data ?? []);
      setTags(
        ((tagsRes.data ?? []) as Array<{ id: string; name: string; color: string | null }>).map(
          (t) => ({ id: t.id, name: t.name, color: t.color }),
        ),
      );
      setIdentities((identitiesRes.data ?? []) as SendingIdentityOption[]);
      const settingsFrom = (settings.data?.fromEmail as string | undefined)?.trim() ?? "";
      setDefaultFromEmail(settingsFrom);
      if (settings.data && !initialId) {
        setFormState((f) => ({
          ...f,
          fromName: f.fromName || settings.data.fromName || "",
          replyTo: f.replyTo || settings.data.replyTo || "",
        }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [initialId]);

  useEffect(() => {
    if (!initialId) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/v1/advertiser/email/automations/${initialId}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d.data) return;
        const a = d.data;
        skipHistoryRef.current = true;
        setFormState({
          name: a.name,
          trigger: "LEAD_CAPTURED",
          listId:
            lists.find((l) => l.campaignId === (a.campaignId ?? ""))?.id ?? "",
          fromName: a.fromName,
          replyTo: a.replyTo ?? "",
          openTagId: a.openTagId ?? "",
          clickTagId: a.clickTagId ?? "",
        });
        const contents: Record<string, TemplateContent> = {};
        const rawSteps = (
          a.steps as Array<{
            id: string;
            type?: string | null;
            templateId?: string | null;
            delayMinutes: number;
            order: number;
            fromName?: string | null;
            fromEmail?: string | null;
            template?: {
              id: string;
              name: string;
              subject: string;
              previewText?: string | null;
              htmlBody: string;
            };
          }>
        );
        for (const s of rawSteps) {
          if (s.template) {
            contents[s.template.id] = toContent(s.template);
          }
        }
        const mapped = normalizeServerStepsToEmailOnly(rawSteps);
        setStepsState(mapped);
        setTemplateContents(contents);
        refreshTemplateList(contents);
        for (const s of mapped) {
          captureStepSnapshot(s.clientId, mapped, contents);
        }
        skipHistoryRef.current = false;
        hydratedRef.current = true;
        setSaveStatus("idle");
        dirtyRef.current = false;
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [initialId, lists, refreshTemplateList, captureStepSnapshot]);

  useEffect(() => {
    if (!automationId) {
      setStats([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/v1/advertiser/email/automations/${automationId}/stats`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setStats(d.data?.steps ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [automationId]);

  const buildPayload = useCallback(() => {
    const campaignId =
      lists.find((l) => l.id === form.listId)?.campaignId?.trim() ?? "";
    return {
      name: form.name.trim(),
      trigger: "LEAD_CAPTURED" as const,
      campaignId,
      fromName: form.fromName.trim(),
      replyTo: form.replyTo.trim() || null,
      openTagId: form.openTagId.trim() || null,
      clickTagId: form.clickTagId.trim() || null,
      steps: steps.map((s, i) => ({
        ...(s.serverId ? { id: s.serverId } : {}),
        type: "SEND_EMAIL" as const,
        templateId: s.templateId,
        tagId: null,
        delayMinutes: s.delayMinutes,
        order: i,
        fromName: s.fromName.trim() || null,
        fromEmail: s.fromEmail.trim() || null,
      })),
    };
  }, [form, lists, steps]);

  const syncStepsFromServer = useCallback(
    (
      serverSteps: Array<{
        id: string;
        type?: string | null;
        templateId?: string | null;
        delayMinutes: number;
        order: number;
        fromName?: string | null;
        fromEmail?: string | null;
      }>,
    ) => {
      skipHistoryRef.current = true;
      setStepsState((prev) => {
        const normalized = normalizeServerStepsToEmailOnly(serverSteps);
        return normalized.map((s, i) => {
          const prevMatch =
            prev.find((p) => p.serverId === s.serverId) ??
            prev.find((p) => p.templateId === s.templateId && p.order === i);
          return {
            ...s,
            clientId: prevMatch?.clientId ?? s.clientId,
            order: i,
          };
        });
      });
      skipHistoryRef.current = false;
    },
    [],
  );

  const persist = useCallback(
    async (activate = false) => {
      if (!canPersist(form, steps, templates, tags, validationOptions)) {
        setSaveStatus("blocked");
        setValidateFlash(true);
        setSaveError("Fix validation issues before saving");
        const first = issues.find((i) => i.stepClientId);
        if (first?.stepClientId) {
          setSelection({ kind: "email", clientId: first.stepClientId });
        } else {
          setSelection({ kind: "trigger" });
        }
        return false;
      }
      if (persistInFlight.current) return false;
      persistInFlight.current = true;
      setSaveStatus("saving");
      setSaveError("");
      try {
        const payload = buildPayload();
        const url = automationId
          ? `/api/v1/advertiser/email/automations/${automationId}`
          : "/api/v1/advertiser/email/automations";
        const res = await fetch(url, {
          method: automationId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) {
          setSaveStatus("error");
          setSaveError(json?.error?.message ?? "Save failed");
          return false;
        }
        const id = automationId ?? (json.data?.id as string | undefined);
        if (!automationId && id) {
          setAutomationId(id);
          window.history.replaceState(null, "", `/advertiser/email/automations/${id}`);
        }
        if (Array.isArray(json.data?.steps)) {
          syncStepsFromServer(json.data.steps);
        }
        if (activate && id) {
          const act = await fetch(`/api/v1/advertiser/email/automations/${id}/activate`, {
            method: "POST",
          });
          if (!act.ok) {
            const aj = await act.json().catch(() => ({}));
            setSaveStatus("error");
            setSaveError(aj?.error?.message ?? "Activate failed");
            return false;
          }
          dirtyRef.current = false;
          setSaveStatus("saved");
          router.push("/advertiser/email/automations");
          return true;
        }
        dirtyRef.current = false;
        setSaveStatus("saved");
        return true;
      } finally {
        persistInFlight.current = false;
      }
    },
    [automationId, buildPayload, form, issues, router, steps, syncStepsFromServer, tags, templates, validationOptions],
  );

  useEffect(() => {
    if (!hydratedRef.current) return;
    if (saveStatus !== "dirty") return;
    if (!canPersist(form, steps, templates, tags)) {
      setSaveStatus("blocked");
      return;
    }
    const t = window.setTimeout(() => {
      void persist(false);
    }, AUTOSAVE_MS);
    return () => window.clearTimeout(t);
  }, [form, steps, templates, tags, saveStatus, persist]);

  const addEmailAt = useCallback(
    async (index: number) => {
      if (steps.length >= MAX_STEPS || addingStep) return;
      setAddingStep(true);
      setPickerOpen(false);
      setSaveError("");
      try {
        const label = `Email ${steps.length + 1}`;
        const content = await createStepTemplate(label);
        const step: AutomationStep = {
          ...createEmptyStep(index, 0),
          clientId: newStepClientId(),
          templateId: content.id,
        };
        pushHistory();
        setTemplateContents((prev) => {
          const next = { ...prev, [content.id]: content };
          refreshTemplateList(next);
          return next;
        });
        setStepsState((prev) => {
          const next = [...prev];
          next.splice(index, 0, step);
          return next.map((s, i) => ({ ...s, order: i }));
        });
        dirtyRef.current = true;
        setSaveStatus("dirty");
        setSelection({ kind: "email", clientId: step.clientId });
        queueMicrotask(() => captureStepSnapshot(step.clientId));
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "Failed to add email");
        setSaveStatus("error");
      } finally {
        setAddingStep(false);
      }
    },
    [addingStep, captureStepSnapshot, pushHistory, refreshTemplateList, steps.length],
  );

  const openPicker = useCallback((index: number) => {
    setInsertIndex(index);
    setPickerOpen(true);
  }, []);

  const removeStep = useCallback(
    (clientId: string) => {
      setSteps((prev) => prev.filter((s) => s.clientId !== clientId));
      setSelection({ kind: "trigger" });
    },
    [setSteps],
  );

  const updateStep = useCallback(
    (clientId: string, patch: Partial<AutomationStep>) => {
      setSteps((prev) =>
        prev.map((s) => (s.clientId === clientId ? { ...s, ...patch } : s)),
      );
    },
    [setSteps],
  );

  /** Insert Wait: sets next email's delay, or creates an email with that wait if none follows. */
  const addWaitAt = useCallback(
    async (index: number, delayDays = 1) => {
      const delayMinutes = delayDays * MINUTES_PER_DAY;
      const next = steps[index];
      if (next) {
        updateStep(next.clientId, { delayMinutes });
        setSelection({ kind: "wait", clientId: next.clientId });
        setPickerOpen(false);
        return;
      }
      if (steps.length >= MAX_STEPS || addingStep) return;
      setAddingStep(true);
      setPickerOpen(false);
      setSaveError("");
      try {
        const label = `Email ${steps.length + 1}`;
        const content = await createStepTemplate(label);
        const step: AutomationStep = {
          ...createEmptyStep(index, delayMinutes),
          clientId: newStepClientId(),
          templateId: content.id,
        };
        pushHistory();
        setTemplateContents((prev) => {
          const map = { ...prev, [content.id]: content };
          refreshTemplateList(map);
          return map;
        });
        setStepsState((prev) => {
          const list = [...prev];
          list.splice(index, 0, step);
          return list.map((s, i) => ({ ...s, order: i }));
        });
        dirtyRef.current = true;
        setSaveStatus("dirty");
        setSelection({ kind: "wait", clientId: step.clientId });
        queueMicrotask(() => captureStepSnapshot(step.clientId));
      } catch (e) {
        setSaveError(e instanceof Error ? e.message : "Failed to add wait");
        setSaveStatus("error");
      } finally {
        setAddingStep(false);
      }
    },
    [
      addingStep,
      captureStepSnapshot,
      pushHistory,
      refreshTemplateList,
      steps,
      updateStep,
    ],
  );

  const clearWait = useCallback(
    (clientId: string) => {
      updateStep(clientId, { delayMinutes: 0 });
      setSelection({ kind: "canvas" });
    },
    [updateStep],
  );

  const ensureExclusiveTemplate = useCallback(
    async (stepClientId: string): Promise<string | null> => {
      const step = snapshotRef.current.steps.find((s) => s.clientId === stepClientId);
      if (!step?.templateId) return null;
      const sharedCount = snapshotRef.current.steps.filter(
        (s) => s.templateId === step.templateId,
      ).length;
      if (sharedCount <= 1) return step.templateId;

      const current = snapshotRef.current.templateContents[step.templateId];
      if (!current) return step.templateId;

      const res = await fetch("/api/v1/advertiser/email/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: current.name,
          subject: current.subject,
          htmlBody: current.htmlBody,
          previewText: current.previewText || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.data) return step.templateId;
      const cloned = toContent(json.data);
      pushHistory();
      setTemplateContents((prev) => {
        const next = { ...prev, [cloned.id]: cloned };
        refreshTemplateList(next);
        return next;
      });
      setStepsState((prev) =>
        prev.map((s) =>
          s.clientId === stepClientId ? { ...s, templateId: cloned.id } : s,
        ),
      );
      dirtyRef.current = true;
      setSaveStatus("dirty");
      return cloned.id;
    },
    [pushHistory, refreshTemplateList],
  );

  const patchTemplateRemote = useCallback(async (content: TemplateContent) => {
    await fetch(`/api/v1/advertiser/email/templates/${content.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: content.name,
        subject: content.subject,
        previewText: content.previewText || null,
        htmlBody: content.htmlBody,
      }),
    });
  }, []);

  const updateStepTemplate = useCallback(
    async (stepClientId: string, patch: Partial<Omit<TemplateContent, "id">>) => {
      const templateId = await ensureExclusiveTemplate(stepClientId);
      if (!templateId) return;

      pushHistory();
      setTemplateContents((prev) => {
        const current = prev[templateId] ?? {
          id: templateId,
          name: "Email",
          subject: "Subject",
          previewText: "",
          htmlBody: DEFAULT_EMAIL_HTML,
        };
        const nextContent = { ...current, ...patch, id: templateId };
        const next = { ...prev, [templateId]: nextContent };
        refreshTemplateList(next);

        window.clearTimeout(templatePatchTimers.current[templateId]);
        templatePatchTimers.current[templateId] = window.setTimeout(() => {
          void patchTemplateRemote(nextContent);
        }, 500);

        return next;
      });
    },
    [ensureExclusiveTemplate, patchTemplateRemote, pushHistory, refreshTemplateList],
  );

  const revertStepContent = useCallback(
    async (clientId: string) => {
      const snap = stepSnapshotsRef.current[clientId];
      if (!snap) return;
      pushHistory();
      setStepsState((prev) =>
        prev.map((s) => (s.clientId === clientId ? { ...snap.step, order: s.order } : s)),
      );
      setTemplateContents((prev) => {
        const next = { ...prev, [snap.template.id]: { ...snap.template } };
        refreshTemplateList(next);
        return next;
      });
      await patchTemplateRemote(snap.template);
      dirtyRef.current = true;
      setSaveStatus("dirty");
    },
    [patchTemplateRemote, pushHistory, refreshTemplateList],
  );

  const saveStepAction = useCallback(
    async (clientId: string) => {
      const step = snapshotRef.current.steps.find((s) => s.clientId === clientId);
      if (!step?.templateId) return false;
      const content = snapshotRef.current.templateContents[step.templateId];
      if (content) {
        window.clearTimeout(templatePatchTimers.current[content.id]);
        await patchTemplateRemote(content);
      }
      const ok = await persist(false);
      if (ok) {
        captureStepSnapshot(clientId);
      }
      return ok;
    },
    [captureStepSnapshot, patchTemplateRemote, persist],
  );

  const applyLibraryTemplate = useCallback(
    async (stepClientId: string, libraryTemplateId: string) => {
      const res = await fetch(`/api/v1/advertiser/email/templates/${libraryTemplateId}`);
      const json = await res.json();
      if (!res.ok || !json.data) {
        setSaveError(json?.error?.message ?? "Failed to load template");
        setSaveStatus("error");
        return false;
      }
      const source = toContent(json.data);
      const createRes = await fetch("/api/v1/advertiser/email/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: source.name,
          subject: source.subject,
          htmlBody: source.htmlBody,
          previewText: source.previewText || null,
        }),
      });
      const created = await createRes.json();
      if (!createRes.ok || !created.data) {
        setSaveError(created?.error?.message ?? "Failed to apply template");
        setSaveStatus("error");
        return false;
      }
      const cloned = toContent(created.data);
      pushHistory();
      setTemplateContents((prev) => {
        const next = { ...prev, [cloned.id]: cloned };
        refreshTemplateList(next);
        return next;
      });
      setStepsState((prev) =>
        prev.map((s) =>
          s.clientId === stepClientId ? { ...s, templateId: cloned.id } : s,
        ),
      );
      dirtyRef.current = true;
      setSaveStatus("dirty");
      return true;
    },
    [pushHistory, refreshTemplateList],
  );

  const runValidate = useCallback(() => {
    setValidateFlash(true);
    if (issues.length === 0) {
      setSaveError("");
      return true;
    }
    setSaveError(`${issues.length} issue${issues.length === 1 ? "" : "s"} to fix`);
    const first = issues.find((i) => i.stepClientId);
    if (first?.stepClientId) {
      setSelection({ kind: "email", clientId: first.stepClientId });
    } else {
      setSelection({ kind: "trigger" });
    }
    return false;
  }, [issues]);

  void historyTick;

  return {
    automationId,
    form,
    setForm,
    steps,
    setSteps,
    templateContents,
    templates,
    tags,
    identities,
    defaultFromEmail,
    lists,
    stats,
    selection,
    setSelection,
    selectTrigger: () => setSelection({ kind: "trigger" }),
    selectEmail: (clientId: string) => {
      setSelection({ kind: "email", clientId });
      if (!stepSnapshotsRef.current[clientId]) {
        captureStepSnapshot(clientId);
      }
    },
    selectWait: (clientId: string) => setSelection({ kind: "wait", clientId }),
    selectCanvas: () => setSelection({ kind: "canvas" }),
    saveStatus,
    saveError,
    setSaveError,
    loading,
    addingStep,
    issues,
    invalidStepIds,
    validateFlash,
    undo,
    redo,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
    historyTick,
    pickerOpen,
    setPickerOpen,
    insertIndex,
    openPicker,
    addEmailAt,
    addWaitAt,
    clearWait,
    removeStep,
    updateStep,
    updateStepTemplate,
    revertStepContent,
    saveStepAction,
    applyLibraryTemplate,
    captureStepSnapshot,
    runValidate,
    persist,
    canSave: canPersist(form, steps, templates, tags, validationOptions),
    maxSteps: MAX_STEPS,
  };
}

export type AutomationBuilderState = ReturnType<typeof useAutomationBuilderState>;
