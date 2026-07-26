"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import type { CampaignStatus } from "@prisma/client";
import {
  CalendarClock,
  Crosshair,
  Settings2,
  Target,
  Wallet,
  X,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  DEFAULT_LEAD_FIELDS,
  DEVICE_TYPES,
  OPERATING_SYSTEMS,
  VERTICALS,
  DEFAULT_VERTICAL,
  isValidTierCountrySelection,
  getBidRecommendationsFromTiers,
} from "@/lib/campaign-form";
import {
  getCampaignEditFormDefaults,
  type CampaignEditInitial,
} from "@/lib/campaign-form-edit";
import {
  getEditableFields,
  getAllowedStatusTransitions,
  isFullEditCampaign,
} from "@/lib/campaign-lifecycle";
import { CampaignCountryField } from "@/components/advertiser/campaign-country-field";
import { CampaignSearchMultiSelect } from "@/components/advertiser/campaign-search-multi-select";
import {
  BidRecommendationPanel,
  CampaignSummaryPanel,
  TierPayoutInfoPanel,
} from "@/components/advertiser/create-campaign-sidebar";
import type { PayoutTiersDisplay } from "@/lib/platform-settings";
import { CampaignTrackingPixelPanel } from "@/components/advertiser/campaign-tracking-pixel-panel";
import { SHOW_CAMPAIGN_TRACKING_PIXEL_UI } from "@/lib/campaign-pixel-ui";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type StartMode = "now" | "scheduled";
type EndMode = "forever" | "scheduled";
type TrafficMode = "allow" | "block";
type CampaignStatusChoice = CampaignStatus;

type AdvertiserOption = {
  id: string;
  name: string;
  email: string;
  wallet?: { balance: unknown; holdBalance?: unknown } | null;
};

type OptinPageOption = {
  id: string;
  title: string;
  slug: string;
  isPublished: boolean;
  name?: string;
  editorType?: string;
};

function formatOptinPageLabel(page: OptinPageOption) {
  const label = page.name ?? page.title;
  const type = page.editorType === "BUILDER" ? "Builder" : "Template";
  return `${label} (${type}) · /o/${page.slug}`;
}

type CreateCampaignFormProps = {
  mode?: "advertiser" | "admin";
  payoutTiers: PayoutTiersDisplay;
  editCampaign?: CampaignEditInitial;
  initialOptinPageId?: string;
  returnTo?: string;
};

const SECTION_ACCENTS = [
  "var(--theme-gradient-approved)",
  "var(--theme-gradient-leads)",
  "var(--theme-gradient-revenue)",
  "var(--theme-gradient-approved)",
] as const;

function todayInputValue() {
  return format(new Date(), "yyyy-MM-dd");
}

function todayLabel() {
  return format(new Date(), "MMMM d, yyyy");
}

function SectionCard({
  step,
  title,
  icon: Icon,
  accentIndex,
  children,
}: {
  step: number;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  accentIndex: number;
  children: React.ReactNode;
}) {
  return (
    <div className="premium-card overflow-hidden">
      <div className="h-1" style={{ background: SECTION_ACCENTS[accentIndex % SECTION_ACCENTS.length] }} />
      <div className="flex items-center gap-3 border-b border-slate-100 bg-[var(--theme-primary-soft)] px-5 py-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-bold text-[var(--theme-primary)] shadow-sm">
          {step}
        </span>
        <Icon className="h-4 w-4 text-[var(--theme-primary)]" />
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      </div>
      <div className="space-y-4 p-5">{children}</div>
    </div>
  );
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-slate-500">{children}</p>;
}

function CurrencyInput({
  id,
  value,
  onChange,
  placeholder,
  min,
  max,
  step,
  required,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex h-10 w-full items-stretch overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm",
        "transition-colors focus-within:border-[var(--theme-primary)] focus-within:ring-2 focus-within:ring-[var(--theme-primary)]/15",
        disabled && "opacity-60",
      )}
    >
      <span className="flex w-10 shrink-0 items-center justify-center border-r border-slate-200 bg-slate-50 text-sm font-semibold text-slate-600">
        $
      </span>
      <input
        id={id}
        type="number"
        step={step}
        min={min}
        max={max}
        required={required}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 border-0 bg-white px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <span className="flex w-12 shrink-0 items-center justify-center border-l border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
        USD
      </span>
    </div>
  );
}

function RadioOption({
  name,
  value,
  checked,
  onChange,
  label,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
        className="h-4 w-4 accent-[var(--theme-primary)]"
      />
      {label}
    </label>
  );
}

export function CreateCampaignForm({
  mode = "advertiser",
  payoutTiers,
  editCampaign,
  initialOptinPageId,
  returnTo,
}: CreateCampaignFormProps) {
  const isAdmin = mode === "admin";
  const isEdit = Boolean(editCampaign);
  const editDefaults = editCampaign ? getCampaignEditFormDefaults(editCampaign) : null;
  const backHref = isEdit
    ? `/admin/campaigns/${editCampaign!.id}`
    : isAdmin
      ? "/admin/campaigns"
      : returnTo || "/advertiser/campaigns";
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [error, setError] = useState("");

  const lifecycle = editCampaign
    ? { status: editCampaign.status, leadCount: editCampaign.leadCount }
    : null;
  const editableFields = lifecycle && isAdmin ? getEditableFields(lifecycle) : null;
  const fullEdit = !lifecycle || !isAdmin || isFullEditCampaign(lifecycle);
  const canEditField = (field: string) => !editableFields || editableFields.has(field);

  const [advertisers, setAdvertisers] = useState<AdvertiserOption[]>([]);
  const [loadingAdvertisers, setLoadingAdvertisers] = useState(isAdmin);
  const [advertiserId, setAdvertiserId] = useState(editDefaults?.advertiserId ?? "");
  const [campaignStatus, setCampaignStatus] = useState<CampaignStatusChoice>(
    (editDefaults?.campaignStatus as CampaignStatusChoice) ?? "ACTIVE",
  );

  const [name, setName] = useState(editDefaults?.name ?? "");
  const [optinPageId, setOptinPageId] = useState(editDefaults?.optinPageId ?? "");
  const [optinPages, setOptinPages] = useState<OptinPageOption[]>([]);
  const [loadingOptinPages, setLoadingOptinPages] = useState(!isAdmin && !isEdit);
  const [startMode, setStartMode] = useState<StartMode>(editDefaults?.startMode ?? "now");
  const [startDate, setStartDate] = useState(editDefaults?.startDate ?? todayInputValue());
  const [endMode, setEndMode] = useState<EndMode>(editDefaults?.endMode ?? "forever");
  const [endDate, setEndDate] = useState(editDefaults?.endDate ?? todayInputValue());
  const [trafficMode, setTrafficMode] = useState<TrafficMode>(editDefaults?.trafficMode ?? "allow");
  const [vertical, setVertical] = useState(editDefaults?.vertical ?? DEFAULT_VERTICAL);
  const [selectedCountries, setSelectedCountries] = useState<string[]>(
    editDefaults?.selectedCountries ?? [],
  );
  const [blacklistedCountries, setBlacklistedCountries] = useState<string[]>(
    editDefaults?.blacklistedCountries ?? [],
  );
  const [devices, setDevices] = useState<string[]>(editDefaults?.devices ?? []);
  const [operatingSystems, setOperatingSystems] = useState<string[]>(
    editDefaults?.operatingSystems ?? [],
  );
  const [blacklistedDevices, setBlacklistedDevices] = useState<string[]>(
    editDefaults?.blacklistedDevices ?? [],
  );
  const [blacklistedOperatingSystems, setBlacklistedOperatingSystems] = useState<string[]>(
    editDefaults?.blacklistedOperatingSystems ?? [],
  );
  const [excludeBlockedPublishers, setExcludeBlockedPublishers] = useState(
    editDefaults?.excludeBlockedPublishers ?? false,
  );
  const [cpl, setCpl] = useState(editDefaults?.cpl ?? "");
  const [totalBudget, setTotalBudget] = useState(editDefaults?.totalBudget ?? "");
  const [dailyBudget, setDailyBudget] = useState(editDefaults?.dailyBudget ?? "");
  const [createdPixelToken, setCreatedPixelToken] = useState<string | null>(
    editDefaults?.pixelToken ?? null,
  );
  const [siteOrigin, setSiteOrigin] = useState("");

  useEffect(() => {
    setSiteOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetch("/api/v1/admin/users?role=ADVERTISER&limit=500")
        .then((res) => res.json())
        .then((data) => setAdvertisers(data.data ?? []))
        .catch(() => setAdvertisers([]))
        .finally(() => setLoadingAdvertisers(false));
      if (isEdit && editCampaign?.advertiserId) {
        setLoadingOptinPages(true);
        fetch(`/api/v1/optin-page-options?advertiserId=${encodeURIComponent(editCampaign.advertiserId)}`)
          .then((res) => res.json())
          .then((data) => setOptinPages((data.pages ?? []) as OptinPageOption[]))
          .catch(() => setOptinPages([]))
          .finally(() => setLoadingOptinPages(false));
      }
      return;
    }

    fetch("/api/v1/wallet")
      .then((res) => res.json())
      .then((data) => setWalletBalance(Number(data.availableBalance ?? data.balance ?? 0)))
      .catch(() => setWalletBalance(0));

    setLoadingOptinPages(true);
    fetch("/api/v1/optin-page-options")
      .then((res) => res.json())
      .then((data) => {
        const pages = (data.pages ?? []) as OptinPageOption[];
        setOptinPages(pages);
        if (initialOptinPageId && pages.some((p) => p.id === initialOptinPageId)) {
          setOptinPageId(initialOptinPageId);
        } else if (pages.length === 1) {
          setOptinPageId(pages[0].id);
        }
      })
      .catch(() => setOptinPages([]))
      .finally(() => setLoadingOptinPages(false));
  }, [isAdmin, initialOptinPageId]);

  useEffect(() => {
    if (!isAdmin || !advertiserId) {
      if (isAdmin) {
        setOptinPages([]);
        setOptinPageId("");
      }
      return;
    }

    setLoadingOptinPages(true);
    fetch(`/api/v1/optin-page-options?advertiserId=${encodeURIComponent(advertiserId)}`)
      .then((res) => res.json())
      .then((data) => {
        const pages = (data.pages ?? []) as OptinPageOption[];
        setOptinPages(pages);
        setOptinPageId(pages.length === 1 ? pages[0].id : "");
      })
      .catch(() => {
        setOptinPages([]);
        setOptinPageId("");
      })
      .finally(() => setLoadingOptinPages(false));
  }, [isAdmin, advertiserId]);

  const selectedAdvertiser = advertisers.find((item) => item.id === advertiserId);
  const effectiveWalletBalance = isAdmin
    ? Math.max(
        0,
        Number(selectedAdvertiser?.wallet?.balance ?? 0) -
          Number(selectedAdvertiser?.wallet?.holdBalance ?? 0),
      )
    : walletBalance;

  const cplValue = parseFloat(cpl) || 0;
  const totalBudgetValue =
    totalBudget.trim() && !Number.isNaN(parseFloat(totalBudget)) && parseFloat(totalBudget) > 0
      ? parseFloat(totalBudget)
      : null;
  const dailyBudgetValue = dailyBudget.trim() ? parseFloat(dailyBudget) : null;
  const selectedVertical = VERTICALS.find((item) => item.label === vertical);
  const previousBudget =
    editCampaign == null || editCampaign.budget == null || Number(editCampaign.budget) <= 0
      ? null
      : Number(editCampaign.budget);
  const budgetChanged =
    !isEdit ||
    editCampaign == null ||
    (totalBudgetValue === null) !== (previousBudget === null) ||
    (totalBudgetValue !== null &&
      previousBudget !== null &&
      Math.abs(totalBudgetValue - previousBudget) > 0.0001);

  const minCpl = 0.1;
  const cplInvalid = cplValue > 0 && (cplValue < minCpl || cplValue > 100);
  const tierBidGuidance = getBidRecommendationsFromTiers(payoutTiers, selectedCountries);
  const cplBelowTierGuidance =
    cplValue > 0 && !cplInvalid && cplValue < tierBidGuidance.minimum;
  const cplAboveTierGuidance =
    cplValue > 0 && !cplInvalid && cplValue > tierBidGuidance.maximum;
  const budgetInvalid =
    totalBudget.trim() !== "" &&
    (totalBudgetValue === null || Number.isNaN(totalBudgetValue) || totalBudgetValue <= 0);
  const insufficientBalance = cplValue > 0 && effectiveWalletBalance < cplValue;

  const selectedOptinPage = optinPages.find((page) => page.id === optinPageId);

  async function handleSubmit(intent: "draft" | "submit") {
    setError("");

    if (!name.trim()) {
      setError("Campaign name is required.");
      return;
    }
    if (!optinPageId) {
      setError("Select an optin page for this campaign.");
      return;
    }
    if (!vertical || !selectedVertical) {
      setError("Please select a vertical.");
      return;
    }
    if (isAdmin && !advertiserId) {
      setError("Please select an advertiser.");
      return;
    }
    if (!cplValue || cplValue < minCpl || cplValue > 100) {
      if (canEditField("cpl")) {
        setError(`CPL bid must be between $${minCpl.toFixed(2)} and $100.00.`);
        return;
      }
    }
    if (canEditField("budget")) {
      if (budgetInvalid) {
        setError("Total budget must be a positive amount, or leave blank for unlimited.");
        return;
      }
    }
    if (intent === "submit" && insufficientBalance) {
      setError("You do not have enough balance to create a campaign. Please add funds to your account.");
      return;
    }
    if (
      trafficMode === "allow" &&
      selectedCountries.length > 0 &&
      !isValidTierCountrySelection(selectedCountries)
    ) {
      setError(
        "Invalid country selection. Use specific countries within one tier, or select full tier(s) only.",
      );
      return;
    }

    setLoading(true);

    const targeting = {
      scheduling: {
        startMode,
        startDate: startMode === "scheduled" ? startDate : null,
        endMode,
        endDate: endMode === "scheduled" ? endDate : null,
      },
      trafficMode,
      vertical,
      countries: trafficMode === "allow" ? selectedCountries : [],
      blacklistedCountries: trafficMode === "block" ? blacklistedCountries : [],
      devices: trafficMode === "allow" ? devices : [],
      operatingSystems: trafficMode === "allow" ? operatingSystems : [],
      blacklistedDevices: trafficMode === "block" ? blacklistedDevices : [],
      blacklistedOperatingSystems: trafficMode === "block" ? blacklistedOperatingSystems : [],
      excludeBlockedPublishers,
    };

    if (isEdit && editCampaign) {
      const patchBody: Record<string, unknown> = {
        targeting,
      };

      if (canEditField("description")) {
        patchBody.description = selectedOptinPage
          ? `Optin funnel: ${selectedOptinPage.title}`
          : editCampaign.name;
      }
      if (canEditField("dailyCap")) {
        // null clears daily budget; omit is not enough when an existing cap must be removed
        patchBody.dailyCap = dailyBudgetValue ? Math.round(dailyBudgetValue) : null;
      }
      if (intent === "draft") {
        patchBody.status = "DRAFT";
      } else if (!isAdmin && editCampaign.status === "DRAFT") {
        patchBody.status = "PENDING";
      } else if (canEditField("status")) {
        patchBody.status = campaignStatus;
      }
      if (canEditField("name")) patchBody.name = name.trim();
      if (canEditField("cpl")) patchBody.cpl = cplValue;
      if (canEditField("budget") && budgetChanged) {
        patchBody.budget = totalBudgetValue;
      }
      if (canEditField("category")) patchBody.category = selectedVertical?.category;
      if (fullEdit) {
        patchBody.optinPageId = optinPageId;
        patchBody.vertical = vertical;
        patchBody.fields = DEFAULT_LEAD_FIELDS;
      }

      const res = await fetch(`/api/v1/campaigns/${editCampaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchBody),
      });

      setLoading(false);

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error?.message ?? "Failed to save campaign. Please try again.");
        return;
      }

      router.push(backHref);
      router.refresh();
      return;
    }

    const payload = isAdmin
      ? {
          advertiserId,
          name: name.trim(),
          optinPageId,
          vertical,
          category: selectedVertical.category,
          cpl: cplValue,
          budget: totalBudgetValue,
          dailyCap: dailyBudgetValue ? Math.round(dailyBudgetValue) : undefined,
          status: intent === "draft" ? "DRAFT" : campaignStatus,
          description: selectedOptinPage
            ? `Optin funnel: ${selectedOptinPage.title}`
            : undefined,
          targeting,
          fields: DEFAULT_LEAD_FIELDS,
        }
      : {
          name: name.trim(),
          optinPageId,
          description: selectedOptinPage
            ? `Optin funnel: ${selectedOptinPage.title}`
            : undefined,
          category: selectedVertical.category,
          cpl: cplValue,
          budget: totalBudgetValue,
          dailyCap: dailyBudgetValue ? Math.round(dailyBudgetValue) : undefined,
          ...(intent === "draft" ? { status: "DRAFT" as const } : {}),
          targeting,
          fields: DEFAULT_LEAD_FIELDS,
        };

    const res = await fetch("/api/v1/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error?.message ?? "Failed to create campaign. Please try again.");
      return;
    }

    if (intent === "draft") {
      router.push(backHref);
      router.refresh();
      return;
    }

    const body = await res.json();
    const pixelToken = body?.data?.pixelToken as string | undefined;

    if (pixelToken) {
      setCreatedPixelToken(pixelToken);
      document.getElementById("campaign-tracking-pixel")?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    router.push(backHref);
    router.refresh();
  }

  const statusOptions =
    isEdit && lifecycle
      ? Array.from(new Set([lifecycle.status, ...getAllowedStatusTransitions(lifecycle.status)]))
      : undefined;

  const canSubmitForm =
    name.trim() &&
    optinPageId &&
    vertical &&
    (cplValue >= minCpl || isEdit) &&
    !budgetInvalid &&
    !cplInvalid &&
    !loadingOptinPages &&
    (!isAdmin || (advertiserId && !loadingAdvertisers));

  const canSubmitForReview = canSubmitForm && !insufficientBalance;
  const showDraftActions = !isEdit || editCampaign?.status === "DRAFT";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmit("submit");
      }}
      noValidate
      className="space-y-6"
    >
      <div
        className="relative overflow-hidden rounded-[18px] px-6 py-5 shadow-md"
        style={{
          backgroundImage: "linear-gradient(to right, var(--theme-hero-from), var(--theme-hero-to))",
        }}
      >
        <div className="pointer-events-none absolute inset-0 opacity-[0.06]">
          <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white" />
        </div>
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-white/70">
              {isAdmin ? "Admin Portal" : "Advertiser Portal"}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">
              {isEdit ? "Edit Campaign" : "Create Campaign"}
            </h1>
            <p className="mt-1.5 max-w-lg text-sm text-white/80">
              {isEdit
                ? fullEdit
                  ? "Update campaign settings, targeting, budget, and scheduling. Full edit is available for draft and pending campaigns."
                  : "Running campaigns allow limited edits. CPL and budget cannot be changed while active."
                : isAdmin
                  ? "Create a full campaign on behalf of an advertiser with the same targeting and budget options."
                  : "Set up targeting, budget, scheduling, and tracking for your next lead campaign. Submissions are reviewed by admin before going live."}
            </p>
          </div>
          <Link
            href={backHref}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center self-end rounded-xl bg-white/15 text-white hover:bg-white/25 sm:self-center"
          >
            <X className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <SectionCard step={1} title="Basic Campaign Settings" icon={Settings2} accentIndex={0}>
            {isAdmin && (
              <div className="space-y-2">
                <Label htmlFor="advertiser">Advertiser*</Label>
                <Select
                  value={advertiserId}
                  onValueChange={(value) => value && setAdvertiserId(value)}
                  disabled={loadingAdvertisers || isEdit}
                >
                  <SelectTrigger id="advertiser" className="h-10 w-full">
                    <SelectValue
                      placeholder={
                        loadingAdvertisers ? "Loading advertisers..." : "Select advertiser"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {advertisers.map((advertiser) => (
                      <SelectItem key={advertiser.id} value={advertiser.id}>
                        {advertiser.name} ({advertiser.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldHint>Campaign will be created under this advertiser account.</FieldHint>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Campaign Name*</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter campaign name"
                required
                disabled={!canEditField("name")}
              />
              <FieldHint>This is the name of your campaign that will be displayed in the dashboard</FieldHint>
            </div>

            <div className="space-y-2">
              <Label htmlFor="optinPageId">Optin funnel*</Label>
              {loadingOptinPages ? (
                <div className="flex h-11 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">
                  Loading optin pages...
                </div>
              ) : optinPages.length === 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {isAdmin ? (
                    "This advertiser has no optin page yet. They need to create one before you can launch a campaign."
                  ) : (
                    <>
                      No optin page found.{" "}
                      <Link href="/advertiser/optin-pages" className="font-semibold underline">
                        Create one first
                      </Link>
                      , then return here to launch your campaign.
                    </>
                  )}
                </div>
              ) : (
                <>
                  <Select
                    value={optinPageId}
                    onValueChange={(value) => setOptinPageId(value ?? "")}
                    disabled={!fullEdit}
                  >
                    <SelectTrigger id="optinPageId" className="h-11 w-full bg-white">
                      {selectedOptinPage ? (
                        <span className="truncate text-left text-sm text-slate-900">
                          {formatOptinPageLabel(selectedOptinPage)}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Select optin funnel</span>
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      {optinPages.map((page) => (
                        <SelectItem key={page.id} value={page.id}>
                          {formatOptinPageLabel(page)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedOptinPage && (
                    <FieldHint>
                      Optin landing URL:{" "}
                      <span className="font-mono text-slate-700">
                        {siteOrigin
                          ? `${siteOrigin}/o/${selectedOptinPage.slug}`
                          : `/o/${selectedOptinPage.slug}`}
                      </span>
                      {selectedOptinPage.isPublished ? "" : " · Page is still a draft"}
                    </FieldHint>
                  )}
                </>
              )}
              <FieldHint>
                Publishers will send traffic to your selected optin page instead of an external URL.
              </FieldHint>
            </div>
          </SectionCard>

          <div className={cn(!canEditField("targeting") && "pointer-events-none opacity-60")}>
          <SectionCard step={2} title="Scheduling" icon={CalendarClock} accentIndex={1}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/40 p-4">
                <p className="text-sm font-medium text-slate-800">Start Date</p>
                <RadioOption
                  name="startMode"
                  value="now"
                  checked={startMode === "now"}
                  onChange={(v) => setStartMode(v as StartMode)}
                  label="Start Campaign Now"
                />
                <RadioOption
                  name="startMode"
                  value="scheduled"
                  checked={startMode === "scheduled"}
                  onChange={(v) => setStartMode(v as StartMode)}
                  label="Scheduled Start"
                />
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  disabled={startMode === "now"}
                  className="h-9 bg-white"
                />
                <FieldHint>Date Format: yyyy-mm-dd</FieldHint>
              </div>

              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/40 p-4">
                <p className="text-sm font-medium text-slate-800">End Date</p>
                <RadioOption
                  name="endMode"
                  value="forever"
                  checked={endMode === "forever"}
                  onChange={(v) => setEndMode(v as EndMode)}
                  label="No End Date - Campaign will run indefinitely"
                />
                <RadioOption
                  name="endMode"
                  value="scheduled"
                  checked={endMode === "scheduled"}
                  onChange={(v) => setEndMode(v as EndMode)}
                  label="Scheduled End"
                />
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={endMode === "forever"}
                  className="h-9 bg-white"
                />
                <FieldHint>Date Format: yyyy-mm-dd</FieldHint>
              </div>
            </div>
          </SectionCard>

          <SectionCard step={3} title="Targeting" icon={Target} accentIndex={2}>
            <div className="space-y-2">
              <Label htmlFor="vertical">Vertical</Label>
              <div
                id="vertical"
                className="flex h-9 w-full items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-800"
              >
                {DEFAULT_VERTICAL}
              </div>
              <FieldHint>Make Money Online campaigns only.</FieldHint>
            </div>

            <Tabs value={trafficMode} onValueChange={(v) => v && setTrafficMode(v as TrafficMode)}>
              <TabsList className="w-full justify-start bg-slate-100">
                <TabsTrigger value="allow" className="flex-1">
                  Allow Traffic
                </TabsTrigger>
                <TabsTrigger value="block" className="flex-1">
                  Block Traffic (Blacklisted)
                </TabsTrigger>
              </TabsList>

              <TabsContent value="allow" className="mt-4 space-y-4">
                <CampaignCountryField
                  label="Specific Countries"
                  hint="Leave empty for all countries. Pick specific countries within one tier, or use Select all to add full tiers (Tier 1 + Tier 2 + Tier 3 together)."
                  selected={selectedCountries}
                  onChange={setSelectedCountries}
                  singleTierOnly
                />

                <TierPayoutInfoPanel payoutTiers={payoutTiers} />

                <CampaignSearchMultiSelect
                  label="Device Types (Keep empty to target all device types)"
                  options={DEVICE_TYPES}
                  selected={devices}
                  onChange={setDevices}
                  searchPlaceholder="Search Devices..."
                />

                <CampaignSearchMultiSelect
                  label="Device Operating Systems (keep empty for all OS)"
                  options={OPERATING_SYSTEMS}
                  selected={operatingSystems}
                  onChange={setOperatingSystems}
                  searchPlaceholder="Search Operating Systems..."
                />
              </TabsContent>

              <TabsContent value="block" className="mt-4 space-y-4">
                <CampaignCountryField
                  label="Blacklisted Countries"
                  selected={blacklistedCountries}
                  onChange={setBlacklistedCountries}
                  showTierButtons={false}
                  searchPlaceholder="Search countries..."
                />

                <CampaignSearchMultiSelect
                  label="Blacklisted Device Types"
                  options={DEVICE_TYPES}
                  selected={blacklistedDevices}
                  onChange={setBlacklistedDevices}
                  searchPlaceholder="Search Devices..."
                />

                <CampaignSearchMultiSelect
                  label="Blacklisted Device Operating Systems"
                  options={OPERATING_SYSTEMS}
                  selected={blacklistedOperatingSystems}
                  onChange={setBlacklistedOperatingSystems}
                  searchPlaceholder="Search Operating Systems..."
                />
              </TabsContent>
            </Tabs>

            <div className="space-y-2">
              <Label htmlFor="excludeBlockedPublishers">Blacklisted publishers</Label>
              <Select
                value={excludeBlockedPublishers ? "exclude" : "allow"}
                onValueChange={(value) => setExcludeBlockedPublishers(value === "exclude")}
              >
                <SelectTrigger
                  id="excludeBlockedPublishers"
                  className="h-9 w-full bg-white *:data-[slot=select-value]:line-clamp-none *:data-[slot=select-value]:whitespace-normal"
                >
                  <SelectValue placeholder="Select option" />
                </SelectTrigger>
                <SelectContent
                  alignItemWithTrigger={false}
                  className="min-w-[min(100%,22rem)]"
                >
                  <SelectItem value="allow">Allow all publishers</SelectItem>
                  <SelectItem value="exclude">Don&apos;t allow blacklisted publishers</SelectItem>
                </SelectContent>
              </Select>
              <FieldHint>
                When enabled, publishers you blocked on the Leads page will not receive this
                campaign in their Smart Link rotation.
              </FieldHint>
            </div>
          </SectionCard>
          </div>

          <SectionCard step={4} title="Budget" icon={Wallet} accentIndex={3}>
            <div className="space-y-2">
              <Label htmlFor="cpl">CPL Bid (your maximum cost per lead) *</Label>
              <CurrencyInput
                id="cpl"
                value={cpl}
                onChange={setCpl}
                placeholder="0.00"
                min={minCpl}
                max={100}
                step={0.01}
                required
                disabled={!canEditField("cpl")}
              />
              <FieldHint>Min. {minCpl.toFixed(2)} and Max. 100.00</FieldHint>
              {cplBelowTierGuidance ? (
                <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                  <AlertTriangle className="text-amber-600" />
                  <AlertTitle className="text-amber-900">Bid below tier guidance</AlertTitle>
                  <AlertDescription className="text-amber-800">
                    Your CPL bid is below the recommended range for the selected countries ($
                    {tierBidGuidance.minimum.toFixed(2)}–${tierBidGuidance.maximum.toFixed(2)} based
                    on admin tier guidance). Raise your bid for better delivery.
                  </AlertDescription>
                </Alert>
              ) : null}
              {cplAboveTierGuidance ? (
                <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                  <AlertTriangle className="text-amber-600" />
                  <AlertTitle className="text-amber-900">Bid above tier guidance</AlertTitle>
                  <AlertDescription className="text-amber-800">
                    Your CPL bid is above the recommended range for the selected countries ($
                    {tierBidGuidance.minimum.toFixed(2)}–${tierBidGuidance.maximum.toFixed(2)} based
                    on admin tier guidance). You can still save, but consider a lower bid if you want
                    to stay within guidance.
                  </AlertDescription>
                </Alert>
              ) : null}
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/30 p-4">
                <Label htmlFor="totalBudget" className="leading-snug">
                  Total Budget
                </Label>
                <FieldHint>
                  Leave blank for unlimited. Campaign runs while your wallet has funds.
                </FieldHint>
                <div className="pt-1">
                  <CurrencyInput
                    id="totalBudget"
                    value={totalBudget}
                    onChange={setTotalBudget}
                    placeholder="Unlimited"
                    min={1}
                    step={1}
                    disabled={!canEditField("budget")}
                  />
                </div>
              </div>
              <div className="space-y-2 rounded-xl border border-slate-100 bg-slate-50/30 p-4">
                <Label htmlFor="dailyBudget" className="leading-snug">
                  Daily Budget
                </Label>
                <FieldHint>Maximum spend per day — leave empty for unlimited</FieldHint>
                <div className="pt-1">
                  <CurrencyInput
                    id="dailyBudget"
                    value={dailyBudget}
                    onChange={setDailyBudget}
                    placeholder="Unlimited"
                    min={1}
                    step={1}
                    disabled={!canEditField("dailyCap")}
                  />
                </div>
              </div>
            </div>
          </SectionCard>

          {SHOW_CAMPAIGN_TRACKING_PIXEL_UI ? (
            <SectionCard
              step={5}
              title="Tracking Pixel"
              icon={Crosshair}
              accentIndex={3}
            >
              <div id="campaign-tracking-pixel">
                {createdPixelToken ? (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                      {isAdmin
                        ? "Campaign created. Copy the tracking pixel below and share it with the advertiser."
                        : "Campaign submitted for admin review. Copy your tracking pixel below and place it on your conversion page once approved."}
                    </div>
                    <CampaignTrackingPixelPanel pixelToken={createdPixelToken} />
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-5 text-sm text-slate-600">
                    <p className="font-medium text-slate-800">Auto-generated on save</p>
                    <p className="mt-1">
                      A unique tracking pixel will be created when you save this campaign. Use it on
                      your thank-you or conversion page to track confirmed sales.
                    </p>
                  </div>
                )}
              </div>
            </SectionCard>
          ) : null}
        </div>

        <aside className="space-y-5 xl:sticky xl:top-6 xl:self-start">
          <CampaignSummaryPanel
            name={name}
            startMode={startMode}
            startDate={startDate}
            endMode={endMode}
            endDate={endDate}
            vertical={vertical}
            selectedCountries={selectedCountries}
            totalBudgetValue={totalBudgetValue}
            dailyBudgetValue={dailyBudgetValue}
            cplValue={cplValue}
            todayLabel={todayLabel()}
            mode={mode}
            status={campaignStatus}
            onStatusChange={setCampaignStatus}
            statusOptions={statusOptions}
            statusDisabled={!canEditField("status")}
            isEdit={isEdit}
            editCampaignStatus={editCampaign?.status}
          />

          <BidRecommendationPanel
            cplValue={cplValue}
            payoutTiers={payoutTiers}
            selectedCountries={selectedCountries}
          />

          <TierPayoutInfoPanel payoutTiers={payoutTiers} />

          <div className="rounded-[18px] border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
              <span className="text-xs text-slate-500">
                {isAdmin ? "Advertiser wallet" : "Wallet balance"}
              </span>
              <span className="text-sm font-bold text-[var(--theme-primary)]">
                ${effectiveWalletBalance.toFixed(2)}
              </span>
            </div>

            {isAdmin && advertiserId && effectiveWalletBalance < cplValue && cplValue > 0 && (
              <p className="mb-3 text-sm text-amber-700">
                This advertiser’s available balance is below the CPL bid.
              </p>
            )}

            {insufficientBalance && (
              <p className="mb-3 text-sm text-red-600">
                You do not have enough balance to create a campaign. Please add funds to your account.
              </p>
            )}
            {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

            {showDraftActions ? (
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={loading || !canSubmitForm || (!isEdit && !!createdPixelToken)}
                  onClick={() => void handleSubmit("draft")}
                  className="h-10 w-full rounded-lg font-semibold"
                >
                  {loading ? "Saving..." : "Save as draft"}
                </Button>
                <Button
                  type="submit"
                  disabled={loading || !canSubmitForReview || (!isEdit && !!createdPixelToken)}
                  className="h-10 w-full rounded-lg bg-[var(--theme-primary)] font-semibold hover:opacity-90 disabled:opacity-50"
                >
                  {loading
                    ? isAdmin
                      ? "Creating..."
                      : "Submitting..."
                    : isEdit
                      ? isAdmin
                        ? "Save changes"
                        : "Submit for Review"
                      : createdPixelToken
                        ? isAdmin
                          ? "Campaign created"
                          : "Campaign submitted"
                        : isAdmin
                          ? "Create Campaign"
                          : "Submit for Review"}
                </Button>
              </div>
            ) : (
              <Button
                type="submit"
                disabled={loading || !canSubmitForReview}
                className="h-10 w-full rounded-lg bg-[var(--theme-primary)] font-semibold hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Saving..." : "Save changes"}
              </Button>
            )}
            {createdPixelToken && !isEdit ? (
              <ButtonLink
                href={backHref}
                className="mt-2 h-10 w-full rounded-lg bg-[var(--theme-primary)] font-semibold text-white hover:opacity-90"
              >
                Go to campaigns
              </ButtonLink>
            ) : (
              <ButtonLink href={backHref} variant="outline" className="mt-2 h-10 w-full">
                Cancel
              </ButtonLink>
            )}
            {!canSubmitForm && !error && (
              <p className="mt-3 text-center text-xs text-slate-500">
                {isAdmin
                  ? "Select an advertiser and fill required fields to continue"
                  : "Fill required fields to save or submit your campaign"}
              </p>
            )}
          </div>
        </aside>
      </div>
    </form>
  );
}
