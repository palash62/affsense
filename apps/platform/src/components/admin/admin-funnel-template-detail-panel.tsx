"use client";

import { useEffect, useMemo, useState } from "react";
import type { OptinFunnelTemplate } from "@/services/optin-funnel.service";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FunnelDetailHeader } from "@/components/advertiser/funnel/funnel-detail-header";
import { FunnelStepsSidebar } from "@/components/advertiser/funnel/funnel-steps-sidebar";
import { FunnelStepOverview } from "@/components/advertiser/funnel/funnel-step-overview";
import { FunnelAddStepDialog } from "@/components/advertiser/funnel/funnel-add-step-dialog";
import { FunnelSettingsSheet } from "@/components/advertiser/funnel/funnel-settings-sheet";
import {
  adminFunnelWorkflow,
  buildFunnelSteps,
  toFunnelWorkflowEntityFromAdminTemplate,
  type FunnelStepId,
} from "@/components/advertiser/funnel/funnel-types";

export function AdminFunnelTemplateDetailPanel({
  initialTemplate,
  appUrl,
}: {
  initialTemplate: OptinFunnelTemplate;
  appUrl: string;
}) {
  const workflow = useMemo(() => adminFunnelWorkflow(initialTemplate.id), [initialTemplate.id]);
  const [template, setTemplate] = useState(initialTemplate);
  const entity = useMemo(() => toFunnelWorkflowEntityFromAdminTemplate(template), [template]);
  const [activeStepId, setActiveStepId] = useState<FunnelStepId>("optin");
  const [addStepOpen, setAddStepOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [thankYouEnabled, setThankYouEnabled] = useState(template.thankYouEnabled);
  const [destinationUrl, setDestinationUrl] = useState(template.destinationUrl ?? "");
  const [thankYouPixelHtml, setThankYouPixelHtml] = useState(template.thankYouPixelHtml ?? "");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function refreshTemplate() {
      const res = await fetch(`${workflow.apiBasePath}/${initialTemplate.id}`, {
        cache: "no-store",
      });
      const body = await res.json();
      if (!cancelled && res.ok && body.data) {
        setTemplate(body.data as OptinFunnelTemplate);
      }
    }

    void refreshTemplate();

    function onFocus() {
      void refreshTemplate();
    }

    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
  }, [initialTemplate.id, workflow.apiBasePath]);

  const steps = buildFunnelSteps(thankYouEnabled);

  function isValidHttpUrl(value: string) {
    try {
      const url = new URL(value);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }

  async function saveSettings(patch?: Partial<{
    thankYouEnabled: boolean;
    destinationUrl: string;
    thankYouPixelHtml: string;
  }>) {
    const nextThankYouEnabled = patch?.thankYouEnabled ?? thankYouEnabled;
    const nextDestinationUrl = (patch?.destinationUrl ?? destinationUrl).trim();

    if (!nextThankYouEnabled) {
      if (!nextDestinationUrl) {
        setSettingsMessage("Destination URL is required when thank-you redirect is off.");
        return false;
      }
      if (!isValidHttpUrl(nextDestinationUrl)) {
        setSettingsMessage("Enter a valid destination URL (https://...).");
        return false;
      }
    }

    setSavingSettings(true);
    setSettingsMessage(null);

    const res = await fetch(`${workflow.apiBasePath}/${template.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        thankYouEnabled: nextThankYouEnabled,
        destinationUrl: nextDestinationUrl || null,
        thankYouPixelHtml: patch?.thankYouPixelHtml ?? thankYouPixelHtml,
      }),
    });
    const data = await res.json();
    setSavingSettings(false);

    if (!res.ok) {
      setSettingsMessage(data?.error?.message ?? "Unable to save settings");
      return false;
    }

    const saved = data.data as OptinFunnelTemplate;
    setTemplate(saved);
    setThankYouEnabled(saved.thankYouEnabled);
    setDestinationUrl(saved.destinationUrl ?? "");
    setThankYouPixelHtml(saved.thankYouPixelHtml ?? "");
    setSettingsMessage("Settings saved.");
    return true;
  }

  async function handleThankYouToggle(enabled: boolean) {
    if (!enabled && !destinationUrl.trim()) {
      setThankYouEnabled(false);
      setSettingsOpen(true);
      setSettingsMessage("Destination URL is required when thank-you redirect is off.");
      return;
    }

    const ok = await saveSettings({ thankYouEnabled: enabled });
    if (!ok) {
      setThankYouEnabled(template.thankYouEnabled);
      return;
    }
    if (enabled) setActiveStepId("thankYou");
    if (!enabled && activeStepId === "thankYou") setActiveStepId("optin");
  }

  return (
    <div className="space-y-6">
      <FunnelDetailHeader
        funnelName={template.name}
        backHref={workflow.backHref}
        statusLabel={template.isPublished ? "Published" : "Draft"}
        statusClassName={
          template.isPublished
            ? "rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700"
            : "rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700"
        }
      />

      <Tabs value="steps">
        <TabsList className="h-auto w-full justify-start rounded-none border-b border-slate-200 bg-transparent p-0">
          <TabsTrigger
            value="steps"
            className="rounded-none border-b-2 border-transparent px-4 py-2.5 data-[state=active]:border-blue-600 data-[state=active]:bg-transparent data-[state=active]:text-blue-600 data-[state=active]:shadow-none"
          >
            Steps
          </TabsTrigger>
        </TabsList>

        <TabsContent value="steps" className="mt-6 flex-none">
          <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
            <FunnelStepsSidebar
              steps={steps}
              activeStepId={activeStepId}
              onSelectStep={setActiveStepId}
              onAddStep={() => setAddStepOpen(true)}
            />
            <FunnelStepOverview
              entity={entity}
              workflow={workflow}
              stepId={activeStepId}
              appUrl={appUrl}
              onSettingsClick={() => setSettingsOpen(true)}
              onEntityUpdated={(data) => {
                const saved = data as OptinFunnelTemplate;
                setTemplate(saved);
                setThankYouEnabled(saved.thankYouEnabled);
                setDestinationUrl(saved.destinationUrl ?? "");
                setThankYouPixelHtml(saved.thankYouPixelHtml ?? "");
              }}
              onStepDeleted={() => setActiveStepId("optin")}
            />
          </div>
        </TabsContent>
      </Tabs>

      <FunnelAddStepDialog open={addStepOpen} onOpenChange={setAddStepOpen} />

      <FunnelSettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        entityName={template.name}
        urlHint={`/admin/funnel-templates/${template.id}/preview`}
        description={workflow.settingsDescription}
        thankYouEnabled={thankYouEnabled}
        destinationUrl={destinationUrl}
        thankYouPixelHtml={thankYouPixelHtml}
        saving={savingSettings}
        message={settingsMessage}
        thankYouRedirectHint={workflow.thankYouRedirectHint?.(template.slug)}
        onThankYouEnabledChange={(enabled) => void handleThankYouToggle(enabled)}
        onDestinationUrlChange={setDestinationUrl}
        onThankYouPixelHtmlChange={setThankYouPixelHtml}
        onSave={() => void saveSettings()}
      />
    </div>
  );
}
