"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SELECT_CLASS, formatUsdCents, soloRequest } from "@/components/solo-ads/solo-ui";
import { cn } from "@/lib/utils";

export type SoloOfferOptionView = { type: "CPA" | "DIGITAL"; id: string; name: string; payoutLabel: string | null };

export type SoloFormConfig = {
  regularCpcCents: number;
  warmCpcCents: number;
  supportedCountries: string[];
  minDailyBudgetCents: number;
  maxDailyBudgetCents: number;
  defaultTimezone: string;
};

export type SoloCampaignFormValue = {
  id?: string;
  name: string;
  offerType: "CPA" | "DIGITAL";
  offerId: string;
  trafficType: "REGULAR" | "WARM";
  destinationMode: "DIRECT" | "EXTERNAL";
  destinationUrl: string;
  countries: string[];
  devices: string[];
  activeHours: number[];
  timezone: string;
  startAt: string;
  endAt: string;
  dailyBudget: string;
  lifetimeBudget: string;
  cpcCentsSnapshot?: number;
  status?: string;
};

const DEVICES = [
  { value: "desktop", label: "Desktop" },
  { value: "mobile", label: "Mobile" },
  { value: "tablet", label: "Tablet" },
];

const COUNTRY_NAMES: Record<string, string> = {
  US: "United States",
  CA: "Canada",
  GB: "United Kingdom",
  AU: "Australia",
  NZ: "New Zealand",
  IE: "Ireland",
};

function timeZones(): string[] {
  try {
    return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf("timeZone");
  } catch {
    return ["UTC", "America/New_York", "America/Chicago", "America/Los_Angeles", "Europe/London", "Asia/Kolkata"];
  }
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="premium-card space-y-4 p-6">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function ChoiceCard({
  active,
  onClick,
  title,
  description,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border p-4 text-left transition-colors",
        active ? "border-[var(--theme-primary)] bg-[var(--theme-primary-soft)] ring-2 ring-[var(--theme-primary)]/15" : "border-border bg-card hover:bg-muted/50",
      )}
    >
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-xs text-muted-foreground">{description}</div>
    </button>
  );
}

export function SoloCampaignForm({
  offers,
  config,
  initial,
}: {
  offers: SoloOfferOptionView[];
  config: SoloFormConfig;
  initial?: SoloCampaignFormValue;
}) {
  const router = useRouter();
  const editing = Boolean(initial?.id);
  const [value, setValue] = useState<SoloCampaignFormValue>(
    initial ?? {
      name: "",
      offerType: offers[0]?.type ?? "CPA",
      offerId: offers[0]?.id ?? "",
      trafficType: "REGULAR",
      destinationMode: "DIRECT",
      destinationUrl: "",
      countries: config.supportedCountries.includes("US") ? ["US"] : config.supportedCountries.slice(0, 1),
      devices: [],
      activeHours: [],
      timezone: config.defaultTimezone,
      startAt: "",
      endAt: "",
      dailyBudget: (config.minDailyBudgetCents / 100).toFixed(2),
      lifetimeBudget: ((config.minDailyBudgetCents * 5) / 100).toFixed(2),
    },
  );
  const [saving, setSaving] = useState(false);
  const zones = useMemo(timeZones, []);

  const set = <K extends keyof SoloCampaignFormValue>(key: K, v: SoloCampaignFormValue[K]) => setValue((s) => ({ ...s, [key]: v }));
  const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

  const cpc =
    editing && initial?.trafficType === value.trafficType && initial.cpcCentsSnapshot
      ? initial.cpcCentsSnapshot
      : value.trafficType === "WARM"
        ? config.warmCpcCents
        : config.regularCpcCents;
  const lifetimeCents = Math.round(Number(value.lifetimeBudget || 0) * 100);
  const dailyCents = Math.round(Number(value.dailyBudget || 0) * 100);
  const estClicks = cpc > 0 ? Math.floor(lifetimeCents / cpc) : 0;
  const estDailyClicks = cpc > 0 ? Math.floor(dailyCents / cpc) : 0;
  const selectedOffer = offers.find((o) => o.id === value.offerId && o.type === value.offerType);

  async function save(submitAfter: boolean) {
    setSaving(true);
    const body = {
      name: value.name,
      offerType: value.offerType,
      offerId: value.offerId,
      trafficType: value.trafficType,
      destinationMode: value.destinationMode,
      destinationUrl: value.destinationMode === "EXTERNAL" ? value.destinationUrl : null,
      countries: value.countries,
      devices: value.devices,
      activeHours: value.activeHours,
      timezone: value.timezone,
      startAt: value.startAt || null,
      endAt: value.endAt || null,
      dailyBudget: value.dailyBudget,
      lifetimeBudget: value.lifetimeBudget,
    };
    try {
      const campaign = editing
        ? await soloRequest<{ id: string; status: string }>(`/api/v1/publisher/solo-ads/campaigns/${initial!.id}`, { method: "PATCH", body })
        : await soloRequest<{ id: string; status: string }>("/api/v1/publisher/solo-ads/campaigns", { body });
      if (submitAfter && ["DRAFT", "REJECTED"].includes(campaign.status)) {
        await soloRequest(`/api/v1/publisher/solo-ads/campaigns/${campaign.id}/status`, { body: { action: "submit" } });
        toast.success("Campaign submitted for review");
      } else if (campaign.status === "PENDING_REVIEW" && editing && initial?.status !== "PENDING_REVIEW") {
        toast.success("Changes saved. The campaign will be reviewed again before it receives traffic.");
      } else {
        toast.success(editing ? "Changes saved" : "Draft saved");
      }
      router.push(`/publisher/solo-ads/campaigns/${campaign.id}`);
      router.refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (offers.length === 0 && !editing) {
    return (
      <div className="premium-card p-8 text-center text-sm text-muted-foreground">
        You don&apos;t have access to any active offers yet. Request access to a CPA offer or digital product first, then come
        back to create a campaign.
      </div>
    );
  }

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        void save(!editing || ["DRAFT", "REJECTED"].includes(initial?.status ?? ""));
      }}
    >
      <Section title="Campaign and offer">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="c-name">Campaign name</Label>
            <Input id="c-name" required minLength={3} maxLength={120} value={value.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Keto offer - US desktop" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-offer">Offer to promote</Label>
            <select
              id="c-offer"
              className={SELECT_CLASS}
              value={`${value.offerType}:${value.offerId}`}
              onChange={(e) => {
                const [type, ...rest] = e.target.value.split(":");
                setValue((s) => ({ ...s, offerType: type as "CPA" | "DIGITAL", offerId: rest.join(":") }));
              }}
            >
              {offers.some((o) => o.type === "CPA") ? (
                <optgroup label="CPA offers">
                  {offers.filter((o) => o.type === "CPA").map((o) => (
                    <option key={o.id} value={`CPA:${o.id}`}>
                      {o.name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {offers.some((o) => o.type === "DIGITAL") ? (
                <optgroup label="Digital products">
                  {offers.filter((o) => o.type === "DIGITAL").map((o) => (
                    <option key={o.id} value={`DIGITAL:${o.id}`}>
                      {o.name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {!selectedOffer && value.offerId ? <option value={`${value.offerType}:${value.offerId}`}>Current offer (no longer available)</option> : null}
            </select>
            {selectedOffer?.payoutLabel ? <p className="text-xs text-muted-foreground">{selectedOffer.payoutLabel}</p> : null}
          </div>
        </div>
      </Section>

      <Section title="Traffic type" description="The price per click is locked when the campaign is created.">
        <div className="grid gap-3 sm:grid-cols-2">
          <ChoiceCard
            active={value.trafficType === "REGULAR"}
            onClick={() => set("trafficType", "REGULAR")}
            title={`Regular · ${formatUsdCents(editing && initial?.trafficType === "REGULAR" ? initial.cpcCentsSnapshot : config.regularCpcCents)} per click`}
            description="Solo email traffic from vetted list owners."
          />
          <ChoiceCard
            active={value.trafficType === "WARM"}
            onClick={() => set("trafficType", "WARM")}
            title={`Warm · ${formatUsdCents(editing && initial?.trafficType === "WARM" ? initial.cpcCentsSnapshot : config.warmCpcCents)} per click`}
            description="Higher-intent subscribers who recently bought or engaged."
          />
        </div>
      </Section>

      <Section title="Where should visitors go?">
        <div className="grid gap-3 sm:grid-cols-2">
          <ChoiceCard
            active={value.destinationMode === "DIRECT"}
            onClick={() => set("destinationMode", "DIRECT")}
            title="Straight to the offer"
            description="Visitors go to the offer page with your affiliate link. Tracking works automatically."
          />
          <ChoiceCard
            active={value.destinationMode === "EXTERNAL"}
            onClick={() => set("destinationMode", "EXTERNAL")}
            title="My own opt-in page"
            description="Visitors land on your page first. Requires the Affsense tracking script on your site."
          />
        </div>
        {value.destinationMode === "EXTERNAL" ? (
          <div className="space-y-1.5">
            <Label htmlFor="c-url">Landing page URL</Label>
            <Input id="c-url" type="url" required placeholder="https://yourdomain.com/optin" value={value.destinationUrl} onChange={(e) => set("destinationUrl", e.target.value)} />
            <p className="text-xs text-muted-foreground">
              Must be https. Install the tracking script from <strong>Solo Ads → Tracking setup</strong> on this page and on the
              pages where visitors click through to the offer. Traffic starts only after the script is detected.
            </p>
          </div>
        ) : null}
      </Section>

      <Section title="Targeting">
        <div className="space-y-2">
          <Label>Countries</Label>
          <div className="flex flex-wrap gap-3">
            {config.supportedCountries.map((code) => (
              <label key={code} className="flex items-center gap-2 text-sm">
                <Checkbox checked={value.countries.includes(code)} onCheckedChange={() => set("countries", toggle(value.countries, code))} />
                {COUNTRY_NAMES[code] ?? code}
              </label>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label>Devices</Label>
          <div className="flex flex-wrap gap-3">
            {DEVICES.map((d) => (
              <label key={d.value} className="flex items-center gap-2 text-sm">
                <Checkbox checked={value.devices.includes(d.value)} onCheckedChange={() => set("devices", toggle(value.devices, d.value))} />
                {d.label}
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Leave all unticked to accept every device.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="c-tz">Timezone</Label>
            <select id="c-tz" className={SELECT_CLASS} value={value.timezone} onChange={(e) => set("timezone", e.target.value)}>
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-start">Start (optional, campaign timezone)</Label>
            <Input id="c-start" type="datetime-local" value={value.startAt} onChange={(e) => set("startAt", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-end">End (optional, campaign timezone)</Label>
            <Input id="c-end" type="datetime-local" value={value.endAt} onChange={(e) => set("endAt", e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Delivery hours ({value.timezone})</Label>
          <div className="grid grid-cols-8 gap-1 sm:grid-cols-12 lg:grid-cols-24">
            {Array.from({ length: 24 }, (_, h) => (
              <button
                key={h}
                type="button"
                onClick={() => set("activeHours", toggle(value.activeHours, h))}
                className={cn(
                  "rounded-md border py-1 text-xs tabular-nums",
                  value.activeHours.includes(h) ? "border-[var(--theme-primary)] bg-[var(--theme-primary)] text-white" : "border-border bg-card",
                )}
              >
                {String(h).padStart(2, "0")}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">No hours selected means traffic can arrive at any time.</p>
        </div>
      </Section>

      <Section title="Budget (USD)">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="c-daily">Daily budget</Label>
            <Input
              id="c-daily"
              type="number"
              step="0.01"
              min={(config.minDailyBudgetCents / 100).toFixed(2)}
              max={(config.maxDailyBudgetCents / 100).toFixed(2)}
              required
              value={value.dailyBudget}
              onChange={(e) => set("dailyBudget", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              About {estDailyClicks.toLocaleString()} clicks per day. Allowed: {formatUsdCents(config.minDailyBudgetCents)} –{" "}
              {formatUsdCents(config.maxDailyBudgetCents)}.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-total">Total budget</Label>
            <Input id="c-total" type="number" step="0.01" min="1" required value={value.lifetimeBudget} onChange={(e) => set("lifetimeBudget", e.target.value)} />
            <p className="text-xs text-muted-foreground">About {estClicks.toLocaleString()} clicks in total at {formatUsdCents(cpc)} per click.</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          You are charged only for clicks that pass our quality checks. Clicks are paid from your Solo Ads wallet; the campaign pauses
          automatically when funds run out and resumes when you add more.
        </p>
      </Section>

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        {!editing ? (
          <Button type="button" variant="outline" disabled={saving} onClick={() => void save(false)}>
            Save as draft
          </Button>
        ) : null}
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : editing && !["DRAFT", "REJECTED"].includes(initial?.status ?? "") ? "Save changes" : "Submit for review"}
        </Button>
      </div>
    </form>
  );
}
