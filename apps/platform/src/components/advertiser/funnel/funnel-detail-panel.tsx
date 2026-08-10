"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { SerializedOptinFunnel } from "@/lib/optin-funnel";
import { buildFunnelPublicUrl } from "@/lib/platform-host";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FunnelDetailHeader } from "./funnel-detail-header";
import { FunnelStepsSidebar } from "./funnel-steps-sidebar";
import { FunnelStepOverview } from "./funnel-step-overview";
import { FunnelAddStepDialog } from "./funnel-add-step-dialog";
import { FunnelSettingsSheet } from "./funnel-settings-sheet";
import {
  advertiserFunnelWorkflow,
  buildFunnelSteps,
  toFunnelWorkflowEntityFromFunnel,
  type FunnelStepId,
} from "./funnel-types";

type FunnelDetailPanelProps = {
  initialFunnel: SerializedOptinFunnel;
  appUrl: string;
};

export function FunnelDetailPanel({ initialFunnel, appUrl }: FunnelDetailPanelProps) {
  const workflow = useMemo(() => advertiserFunnelWorkflow(), []);
  const [funnel, setFunnel] = useState(initialFunnel);
  const entity = useMemo(() => toFunnelWorkflowEntityFromFunnel(funnel), [funnel]);
  const [activeStepId, setActiveStepId] = useState<FunnelStepId>("optin");
  const [addStepOpen, setAddStepOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [domainDialogOpen, setDomainDialogOpen] = useState(false);
  const [domainDialogSelection, setDomainDialogSelection] = useState<string | null>(
    funnel.customDomainId,
  );
  const [savingDomain, setSavingDomain] = useState(false);
  const [domainMessage, setDomainMessage] = useState<string | null>(null);
  const [funnelName, setFunnelName] = useState(funnel.name);
  const [thankYouEnabled, setThankYouEnabled] = useState(funnel.thankYouEnabled);
  const [destinationUrl, setDestinationUrl] = useState(funnel.destinationUrl ?? "");
  const [cpaOfferId, setCpaOfferId] = useState<string | null>(funnel.cpaOfferId ?? null);
  const [thankYouPixelHtml, setThankYouPixelHtml] = useState(funnel.thankYouPixelHtml ?? "");
  const [customDomainId, setCustomDomainId] = useState<string | null>(funnel.customDomainId);
  const [verifiedDomains, setVerifiedDomains] = useState<Array<{ id: string; domain: string }>>([]);
  const [thankYouUseCampaignPixel] = useState(funnel.thankYouUseCampaignPixel);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);

  const steps = buildFunnelSteps(thankYouEnabled);

  useEffect(() => {
    let cancelled = false;

    async function refreshFunnel() {
      const res = await fetch(`${workflow.apiBasePath}/${initialFunnel.id}`, {
        cache: "no-store",
      });
      const body = await res.json();
      if (!cancelled && res.ok && body.data) {
        const refreshed = body.data as SerializedOptinFunnel;
        setFunnel(refreshed);
        setFunnelName(refreshed.name);
        setThankYouEnabled(refreshed.thankYouEnabled);
        setDestinationUrl(refreshed.destinationUrl ?? "");
        setCpaOfferId(refreshed.cpaOfferId ?? null);
        setThankYouPixelHtml(refreshed.thankYouPixelHtml ?? "");
        setCustomDomainId(refreshed.customDomainId);
      }
    }

    void refreshFunnel();

    async function loadVerifiedDomains() {
      const res = await fetch("/api/v1/advertiser/domains");
      const body = await res.json();
      if (!cancelled && res.ok && Array.isArray(body.data)) {
        setVerifiedDomains(
          body.data
            .filter((item: { status: string }) => item.status === "VERIFIED")
            .map((item: { id: string; domain: string }) => ({
              id: item.id,
              domain: item.domain,
            })),
        );
      }
    }

    void loadVerifiedDomains();

    function onFocus() {
      void refreshFunnel();
    }

    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
  }, [initialFunnel.id, workflow.apiBasePath]);

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
    cpaOfferId: string | null;
    thankYouPixelHtml: string;
    thankYouUseCampaignPixel: boolean;
    customDomainId: string | null;
  }>) {
    const nextThankYouEnabled = patch?.thankYouEnabled ?? thankYouEnabled;
    const nextDestinationUrl = (patch?.destinationUrl ?? destinationUrl).trim();
    const nextCpaOfferId = patch?.cpaOfferId !== undefined ? patch.cpaOfferId : cpaOfferId;

    if (!nextThankYouEnabled) {
      if (!nextDestinationUrl && !nextCpaOfferId) {
        setSettingsMessage(
          "Enter a destination URL or select a CPA offer when thank-you redirect is off.",
        );
        return false;
      }
      if (nextDestinationUrl && !isValidHttpUrl(nextDestinationUrl)) {
        setSettingsMessage("Enter a valid destination URL (https://...).");
        return false;
      }
    }

    const trimmedName = funnelName.trim();
    if (trimmedName.length < 2) {
      setSettingsMessage("Funnel name must be at least 2 characters.");
      return false;
    }
    if (trimmedName.length > 80) {
      setSettingsMessage("Funnel name must be 80 characters or fewer.");
      return false;
    }

    setSavingSettings(true);
    setSettingsMessage(null);

    const body = {
      name: trimmedName,
      thankYouEnabled: nextThankYouEnabled,
      destinationUrl: nextCpaOfferId ? null : nextDestinationUrl || null,
      cpaOfferId: nextCpaOfferId,
      thankYouPixelHtml: patch?.thankYouPixelHtml ?? thankYouPixelHtml,
      thankYouUseCampaignPixel: patch?.thankYouUseCampaignPixel ?? thankYouUseCampaignPixel,
      customDomainId: patch?.customDomainId !== undefined ? patch.customDomainId : customDomainId,
    };

    const res = await fetch(`${workflow.apiBasePath}/${funnel.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSavingSettings(false);

    if (!res.ok) {
      setSettingsMessage(data?.error?.message ?? "Unable to save settings");
      return false;
    }

    const saved = data.data as SerializedOptinFunnel;
    setFunnel(saved);
    setFunnelName(saved.name);
    setThankYouEnabled(saved.thankYouEnabled);
    setDestinationUrl(saved.destinationUrl ?? "");
    setCpaOfferId(saved.cpaOfferId ?? null);
    setCustomDomainId(saved.customDomainId);
    setSettingsMessage("Settings saved.");
    return true;
  }

  async function handleThankYouToggle(enabled: boolean) {
    if (!enabled && !destinationUrl.trim() && !cpaOfferId) {
      setThankYouEnabled(false);
      setSettingsOpen(true);
      setSettingsMessage(
        "Enter a destination URL or select a CPA offer when thank-you redirect is off.",
      );
      return;
    }

    const ok = await saveSettings({ thankYouEnabled: enabled });
    if (!ok) {
      setThankYouEnabled(funnel.thankYouEnabled);
      return;
    }
    if (enabled) setActiveStepId("thankYou");
  }

  function openDomainDialog() {
    setDomainDialogSelection(customDomainId);
    setDomainMessage(null);
    setDomainDialogOpen(true);
  }

  async function saveCustomDomain() {
    setSavingDomain(true);
    setDomainMessage(null);

    const res = await fetch(`${workflow.apiBasePath}/${funnel.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customDomainId: domainDialogSelection }),
    });
    const data = await res.json();
    setSavingDomain(false);

    if (!res.ok) {
      setDomainMessage(data?.error?.message ?? "Unable to save domain");
      return;
    }

    const saved = data.data as SerializedOptinFunnel;
    setFunnel(saved);
    setCustomDomainId(saved.customDomainId);
    setDomainDialogOpen(false);
    setDomainMessage(null);
  }

  const publicUrl = buildFunnelPublicUrl({
    slug: funnel.slug,
    appUrl,
    customDomain:
      funnel.customDomain?.status === "VERIFIED" ? funnel.customDomain.domain : null,
  });

  const thankYouHint =
    funnel.customDomain?.status === "VERIFIED"
      ? "Users will go to /thank-you after submit."
      : workflow.thankYouRedirectHint?.(funnel.slug);

  return (
    <div className="space-y-6">
      <FunnelDetailHeader
        funnelName={funnel.name}
        backHref={workflow.backHref}
      />

      <Tabs value="steps">
        <TabsList className="h-auto w-full justify-start rounded-none border-b border-border bg-transparent p-0">
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
              onConnectDomainClick={openDomainDialog}
              onEntityUpdated={(data) => {
                const saved = data as SerializedOptinFunnel;
                setFunnel(saved);
                setFunnelName(saved.name);
                setThankYouEnabled(saved.thankYouEnabled);
                setDestinationUrl(saved.destinationUrl ?? "");
                setCpaOfferId(saved.cpaOfferId ?? null);
                setThankYouPixelHtml(saved.thankYouPixelHtml ?? "");
                setCustomDomainId(saved.customDomainId);
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
        name={funnelName}
        onNameChange={setFunnelName}
        urlHint={publicUrl}
        description={workflow.settingsDescription}
        thankYouEnabled={thankYouEnabled}
        destinationUrl={destinationUrl}
        cpaOfferId={cpaOfferId}
        showOfferSelect
        thankYouPixelHtml={thankYouPixelHtml}
        saving={savingSettings}
        message={settingsMessage}
        thankYouRedirectHint={thankYouHint}
        onThankYouEnabledChange={(enabled) => void handleThankYouToggle(enabled)}
        onDestinationUrlChange={(url) => {
          setDestinationUrl(url);
          if (url.trim()) setCpaOfferId(null);
        }}
        onCpaOfferIdChange={(offerId) => {
          setCpaOfferId(offerId);
          if (offerId) setDestinationUrl("");
        }}
        onThankYouPixelHtmlChange={setThankYouPixelHtml}
        onSave={() => void saveSettings()}
      />

      <Dialog open={domainDialogOpen} onOpenChange={setDomainDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect domain</DialogTitle>
            <DialogDescription>
              Choose a verified domain to serve this funnel at the root URL, or use the default
              platform domain.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {funnel.customDomain?.status === "VERIFIED" && (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                    Connected domain
                  </p>
                  <p className="truncate font-mono text-xs text-emerald-900">{publicUrl}</p>
                </div>
                <a
                  href={publicUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-700 hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Preview
                </a>
              </div>
            )}
            <Label className="text-xs font-medium text-muted-foreground">Public URL domain</Label>
            <select
              value={domainDialogSelection ?? ""}
              disabled={savingDomain}
              onChange={(e) => setDomainDialogSelection(e.target.value || null)}
              className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground"
            >
              <option value="">Default (platform domain)</option>
              {verifiedDomains.map((domain) => (
                <option key={domain.id} value={domain.id}>
                  {domain.domain}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              <Link href="/advertiser/domains" className="font-medium text-blue-600 hover:underline">
                + Connect new domain
              </Link>
              {" · "}
              Only verified domains appear here.
            </p>
            {domainMessage && <p className="text-sm text-red-600">{domainMessage}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDomainDialogOpen(false)} disabled={savingDomain}>
              Cancel
            </Button>
            <Button onClick={() => void saveCustomDomain()} disabled={savingDomain}>
              {savingDomain ? "Saving..." : "Save domain"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
