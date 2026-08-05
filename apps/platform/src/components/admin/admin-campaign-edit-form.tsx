"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import type { CampaignCategory, CampaignStatus } from "@prisma/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CampaignCountryField } from "@/components/advertiser/campaign-country-field";
import { CampaignSearchMultiSelect } from "@/components/advertiser/campaign-search-multi-select";
import { CampaignTrackingPixelPanel } from "@/components/advertiser/campaign-tracking-pixel-panel";
import { SHOW_CAMPAIGN_TRACKING_PIXEL_UI } from "@/lib/campaign-pixel-ui";
import {
  DEVICE_TYPES,
  OPERATING_SYSTEMS,
  VERTICALS,
} from "@/lib/campaign-form";
import {
  buildTargetingPayload,
  parseCampaignTargeting,
} from "@/lib/campaign-targeting";
import {
  canTransitionStatus,
  getAllowedStatusTransitions,
  getEditableFields,
  isFullEditCampaign,
} from "@/lib/campaign-lifecycle";

type CampaignField = {
  fieldName: string;
  label: string;
  fieldType: string;
  required: boolean;
};

interface AdminCampaignEditFormProps {
  campaign: {
    id: string;
    name: string;
    description: string | null;
    category: CampaignCategory;
    cpl: number;
    budget: number | null;
    dailyCap: number | null;
    monthlyCap: number | null;
    status: CampaignStatus;
    targeting: unknown;
    pixelToken: string | null;
    rejectionReason: string | null;
    fields: CampaignField[];
    leadCount: number;
  };
}

const CATEGORIES: CampaignCategory[] = [
  "FINANCE",
  "INSURANCE",
  "EDUCATION",
  "REAL_ESTATE",
  "GENERIC",
];

type StartMode = "now" | "scheduled";
type EndMode = "forever" | "scheduled";
type TrafficMode = "allow" | "block";

export function AdminCampaignEditForm({ campaign }: AdminCampaignEditFormProps) {
  const router = useRouter();
  const lifecycle = { status: campaign.status, leadCount: campaign.leadCount };
  const fullEdit = isFullEditCampaign(lifecycle);
  const editable = getEditableFields(lifecycle);
  const canEditTargeting = editable.has("targeting");
  const statusOptions = getAllowedStatusTransitions(campaign.status);
  const parsedTargeting = parseCampaignTargeting(campaign.targeting);

  const [name, setName] = useState(campaign.name);
  const [description, setDescription] = useState(campaign.description ?? "");
  const [category, setCategory] = useState(campaign.category);
  const [cpl, setCpl] = useState(String(campaign.cpl));
  const [budget, setBudget] = useState(
    campaign.budget != null && Number(campaign.budget) > 0 ? String(campaign.budget) : "",
  );
  const [dailyCap, setDailyCap] = useState(campaign.dailyCap ? String(campaign.dailyCap) : "");
  const [monthlyCap, setMonthlyCap] = useState(
    campaign.monthlyCap ? String(campaign.monthlyCap) : "",
  );
  const [status, setStatus] = useState(campaign.status);

  const [vertical, setVertical] = useState(
    parsedTargeting.vertical ?? VERTICALS[0].label,
  );
  const [trafficMode, setTrafficMode] = useState<TrafficMode>(parsedTargeting.trafficMode);
  const [selectedCountries, setSelectedCountries] = useState(parsedTargeting.countries);
  const [blacklistedCountries, setBlacklistedCountries] = useState(
    parsedTargeting.blacklistedCountries,
  );
  const [devices, setDevices] = useState(parsedTargeting.devices);
  const [operatingSystems, setOperatingSystems] = useState(parsedTargeting.operatingSystems);
  const [blacklistedDevices, setBlacklistedDevices] = useState(parsedTargeting.blacklistedDevices);
  const [blacklistedOperatingSystems, setBlacklistedOperatingSystems] = useState(
    parsedTargeting.blacklistedOperatingSystems,
  );
  const [excludeBlockedPublishers, setExcludeBlockedPublishers] = useState(
    parsedTargeting.excludeBlockedPublishers,
  );
  const [startMode, setStartMode] = useState<StartMode>(parsedTargeting.scheduling.startMode);
  const [startDate, setStartDate] = useState(
    parsedTargeting.scheduling.startDate ?? format(new Date(), "yyyy-MM-dd"),
  );
  const [endMode, setEndMode] = useState<EndMode>(parsedTargeting.scheduling.endMode);
  const [endDate, setEndDate] = useState(
    parsedTargeting.scheduling.endDate ?? format(new Date(), "yyyy-MM-dd"),
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const body: Record<string, unknown> = {
      description: description.trim() || null,
      dailyCap: dailyCap ? parseInt(dailyCap, 10) : null,
      monthlyCap: monthlyCap ? parseInt(monthlyCap, 10) : null,
    };

    if (fullEdit) {
      body.name = name.trim();
      body.cpl = parseFloat(cpl);
      const parsedBudget = budget.trim() ? parseFloat(budget) : null;
      body.budget =
        parsedBudget != null && Number.isFinite(parsedBudget) && parsedBudget > 0
          ? parsedBudget
          : null;
      body.category = category;
    }

    if (canEditTargeting) {
      body.targeting = buildTargetingPayload(campaign.targeting, {
        vertical,
        trafficMode,
        scheduling: {
          startMode,
          startDate: startMode === "scheduled" ? startDate : null,
          endMode,
          endDate: endMode === "scheduled" ? endDate : null,
        },
        countries: trafficMode === "allow" ? selectedCountries : [],
        blacklistedCountries: trafficMode === "block" ? blacklistedCountries : [],
        devices,
        operatingSystems,
        blacklistedDevices,
        blacklistedOperatingSystems,
        excludeBlockedPublishers,
      });
    }

    if (status !== campaign.status) {
      if (!canTransitionStatus(campaign.status, status)) {
        setError(`Cannot change status from ${campaign.status} to ${status}`);
        setLoading(false);
        return;
      }
      body.status = status;
    }

    const res = await fetch(`/api/v1/campaigns/${campaign.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data?.error?.message ?? "Unable to save campaign");
      return;
    }

    router.push(`/admin/campaigns/${campaign.id}`);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto max-w-4xl space-y-6 rounded-[18px] border border-slate-200 bg-white p-6 shadow-sm"
    >
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Edit campaign</h2>
        <p className="mt-1 text-sm text-slate-500">
          {fullEdit
            ? "Full edit is available for draft and pending campaigns."
            : "Running campaigns allow limited edits. CPL, budget, and category cannot be changed while active."}
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {campaign.rejectionReason && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <span className="font-medium">Rejection note:</span> {campaign.rejectionReason}
        </p>
      )}

      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Basic details
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name">Campaign name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!fullEdit}
              required
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[var(--theme-primary)] focus:ring-2 focus:ring-[var(--theme-primary)]/15"
            />
          </div>
          {fullEdit && (
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={category}
                onValueChange={(v) => v && setCategory(v as CampaignCategory)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="cpl">CPL</Label>
            <Input
              id="cpl"
              type="number"
              step="0.01"
              min="0"
              value={cpl}
              onChange={(e) => setCpl(e.target.value)}
              disabled={!fullEdit}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="budget">Budget</Label>
            <Input
              id="budget"
              type="number"
              step="0.01"
              min="0"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              disabled={!fullEdit}
              placeholder="Unlimited"
            />
            <p className="text-xs text-slate-500">Leave blank for unlimited.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dailyCap">Daily cap</Label>
            <Input
              id="dailyCap"
              type="number"
              min="0"
              value={dailyCap}
              onChange={(e) => setDailyCap(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="monthlyCap">Monthly cap</Label>
            <Input
              id="monthlyCap"
              type="number"
              min="0"
              value={monthlyCap}
              onChange={(e) => setMonthlyCap(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => v && setStatus(v as CampaignStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={campaign.status}>{campaign.status}</SelectItem>
                {statusOptions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {canEditTargeting && (
        <section className="space-y-4 border-t border-slate-100 pt-6">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Targeting & scheduling
          </h3>

          {parsedTargeting.destinationUrl && (
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
              <p className="text-xs text-slate-500">Destination URL (from optin page)</p>
              <p className="break-all text-sm text-slate-800">{parsedTargeting.destinationUrl}</p>
              {parsedTargeting.optinSlug && (
                <p className="mt-1 text-xs text-slate-500">Optin: /o/{parsedTargeting.optinSlug}</p>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Vertical</Label>
              <Select value={vertical} onValueChange={(v) => v && setVertical(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VERTICALS.map((v) => (
                    <SelectItem key={v.label} value={v.label}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <input
                id="excludeBlocked"
                type="checkbox"
                checked={excludeBlockedPublishers}
                onChange={(e) => setExcludeBlockedPublishers(e.target.checked)}
                className="rounded border-slate-300"
              />
              <Label htmlFor="excludeBlocked">Exclude blocked publishers</Label>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Start</Label>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={startMode === "now"}
                    onChange={() => setStartMode("now")}
                  />
                  Start immediately
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={startMode === "scheduled"}
                    onChange={() => setStartMode("scheduled")}
                  />
                  Schedule start date
                </label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={startMode === "now"}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>End</Label>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={endMode === "forever"}
                    onChange={() => setEndMode("forever")}
                  />
                  Run indefinitely
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={endMode === "scheduled"}
                    onChange={() => setEndMode("scheduled")}
                  />
                  Schedule end date
                </label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={endMode === "forever"}
                />
              </div>
            </div>
          </div>

          <Tabs
            value={trafficMode}
            onValueChange={(v) => v && setTrafficMode(v as TrafficMode)}
          >
            <TabsList>
              <TabsTrigger value="allow">Allow list</TabsTrigger>
              <TabsTrigger value="block">Block list</TabsTrigger>
            </TabsList>
            <TabsContent value="allow" className="mt-4 space-y-4">
              <CampaignCountryField
                label="Countries"
                hint="Leave empty for all countries"
                selected={selectedCountries}
                onChange={setSelectedCountries}
              />
              <CampaignSearchMultiSelect
                label="Devices"
                hint="Leave empty for all devices"
                options={[...DEVICE_TYPES]}
                selected={devices}
                onChange={setDevices}
              />
              <CampaignSearchMultiSelect
                label="Operating systems"
                hint="Leave empty for all OS"
                options={[...OPERATING_SYSTEMS]}
                selected={operatingSystems}
                onChange={setOperatingSystems}
              />
            </TabsContent>
            <TabsContent value="block" className="mt-4 space-y-4">
              <CampaignCountryField
                label="Blocked countries"
                selected={blacklistedCountries}
                onChange={setBlacklistedCountries}
                showTierButtons={false}
              />
              <CampaignSearchMultiSelect
                label="Blocked devices"
                options={[...DEVICE_TYPES]}
                selected={blacklistedDevices}
                onChange={setBlacklistedDevices}
              />
              <CampaignSearchMultiSelect
                label="Blocked operating systems"
                options={[...OPERATING_SYSTEMS]}
                selected={blacklistedOperatingSystems}
                onChange={setBlacklistedOperatingSystems}
              />
            </TabsContent>
          </Tabs>
        </section>
      )}

      {campaign.fields.length > 0 && (
        <section className="space-y-3 border-t border-slate-100 pt-6">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Lead fields
          </h3>
          <p className="text-xs text-slate-500">
            Lead fields can only be changed for draft or pending campaigns via full campaign setup.
          </p>
          <div className="flex flex-wrap gap-2">
            {campaign.fields.map((field) => (
              <Badge key={field.fieldName} variant="outline">
                {field.label}
                {field.required ? " *" : ""} ({field.fieldType})
              </Badge>
            ))}
          </div>
        </section>
      )}

      {SHOW_CAMPAIGN_TRACKING_PIXEL_UI && campaign.pixelToken && (
        <section className="space-y-3 border-t border-slate-100 pt-6">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Tracking pixel
          </h3>
          <CampaignTrackingPixelPanel pixelToken={campaign.pixelToken} />
        </section>
      )}

      <div className="flex justify-end gap-2 border-t border-slate-100 pt-6">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
