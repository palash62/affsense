"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { toast } from "sonner";
import { AffiliateSearchSelect, type SelectedAffiliate } from "@/components/admin/affiliate-search-select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { soloRequest } from "@/components/solo-ads/solo-ui";

export type SoloSettingsValue = {
  enabled: boolean;
  betaOnly: boolean;
  betaPublisherIds: string[];
  regularCpcCents: number;
  warmCpcCents: number;
  regularProviderCostCents: number;
  warmProviderCostCents: number;
  minDepositCents: number;
  minDailyBudgetCents: number;
  maxDailyBudgetCents: number;
  supportedCountries: string[];
  attributionWindowDays: number;
  uniqueVisitorWindowHours: number;
  validationDelayMinutes: number;
  maxClicksPerIpPerHour: number;
  maxClicksPerTokenPerMinute: number;
  blockBots: boolean;
  fallbackUrl: string;
  defaultTimezone: string;
  transferEnabled: boolean;
  lowBalanceAlertCents: number;
  cpaApprovalDays: number;
};

type BetaPublisher = { id: string; name: string; email: string; memberNo: number };

const dollars = (cents: number) => (cents / 100).toFixed(2);
const toCents = (value: string) => Math.round(Number(value) * 100);

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Toggle({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm font-medium">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(Boolean(v))} />
      {label}
    </label>
  );
}

export function SoloSettingsForm({ initial, betaPublishers }: { initial: SoloSettingsValue; betaPublishers: BetaPublisher[] }) {
  const router = useRouter();
  const [config, setConfig] = useState(initial);
  const [money, setMoney] = useState({
    regularCpc: dollars(initial.regularCpcCents),
    warmCpc: dollars(initial.warmCpcCents),
    regularProviderCost: dollars(initial.regularProviderCostCents),
    warmProviderCost: dollars(initial.warmProviderCostCents),
    minDeposit: dollars(initial.minDepositCents),
    minDaily: dollars(initial.minDailyBudgetCents),
    maxDaily: dollars(initial.maxDailyBudgetCents),
    lowBalance: dollars(initial.lowBalanceAlertCents),
  });
  const [countries, setCountries] = useState(initial.supportedCountries.join(", "));
  const [beta, setBeta] = useState<Array<{ id: string; label: string }>>(
    betaPublishers.map((p) => ({ id: p.id, label: `${p.name} (${p.email})` })),
  );
  const [picker, setPicker] = useState<SelectedAffiliate | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof SoloSettingsValue>(key: K, value: SoloSettingsValue[K]) =>
    setConfig((c) => ({ ...c, [key]: value }));
  const num = (key: keyof SoloSettingsValue) => (e: React.ChangeEvent<HTMLInputElement>) =>
    set(key, Math.round(Number(e.target.value)) as never);

  function addBeta(value: SelectedAffiliate | null) {
    setPicker(null);
    if (!value || beta.some((b) => b.id === value.id)) return;
    setBeta((list) => [...list, { id: value.id, label: `${value.name} (${value.email})` }]);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const next = await soloRequest<SoloSettingsValue>("/api/v1/admin/solo-ads/settings", {
        method: "PUT",
        body: {
          ...config,
          regularCpcCents: toCents(money.regularCpc),
          warmCpcCents: toCents(money.warmCpc),
          regularProviderCostCents: toCents(money.regularProviderCost),
          warmProviderCostCents: toCents(money.warmProviderCost),
          minDepositCents: toCents(money.minDeposit),
          minDailyBudgetCents: toCents(money.minDaily),
          maxDailyBudgetCents: toCents(money.maxDaily),
          lowBalanceAlertCents: toCents(money.lowBalance),
          supportedCountries: countries
            .split(/[\s,]+/)
            .map((c) => c.trim().toUpperCase())
            .filter(Boolean),
          betaPublisherIds: beta.map((b) => b.id),
        },
      });
      setConfig(next);
      setCountries(next.supportedCountries.join(", "));
      toast.success("Solo Ads settings saved");
      router.refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <section className="premium-card space-y-4 p-6">
        <h2 className="text-base font-semibold">Availability</h2>
        <div className="flex flex-wrap gap-6">
          <Toggle id="solo-enabled" label="Solo Ads enabled" checked={config.enabled} onChange={(v) => set("enabled", v)} />
          <Toggle id="solo-beta" label="Beta: only listed affiliates" checked={config.betaOnly} onChange={(v) => set("betaOnly", v)} />
          <Toggle
            id="solo-transfer"
            label="Allow transfers from earnings"
            checked={config.transferEnabled}
            onChange={(v) => set("transferEnabled", v)}
          />
        </div>
        {config.betaOnly ? (
          <div className="space-y-2">
            <Label>Beta affiliates</Label>
            <AffiliateSearchSelect value={picker} onChange={addBeta} placeholder="Add affiliate by name, email or ID..." />
            <div className="flex flex-wrap gap-2">
              {beta.length === 0 ? <p className="text-sm text-muted-foreground">No beta affiliates yet.</p> : null}
              {beta.map((b) => (
                <span key={b.id} className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs">
                  {b.label}
                  <button
                    type="button"
                    aria-label={`Remove ${b.label}`}
                    onClick={() => setBeta((list) => list.filter((x) => x.id !== b.id))}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className="premium-card space-y-4 p-6">
        <h2 className="text-base font-semibold">Pricing and budgets (USD)</h2>
        <p className="text-sm text-muted-foreground">
          Price changes apply to new campaigns only. Existing campaigns keep the price they were created with.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field id="regular-cpc" label="Regular traffic cost per click">
            <Input id="regular-cpc" type="number" step="0.01" min="0.01" value={money.regularCpc} onChange={(e) => setMoney((m) => ({ ...m, regularCpc: e.target.value }))} />
          </Field>
          <Field id="warm-cpc" label="Warm traffic cost per click">
            <Input id="warm-cpc" type="number" step="0.01" min="0.01" value={money.warmCpc} onChange={(e) => setMoney((m) => ({ ...m, warmCpc: e.target.value }))} />
          </Field>
          <Field id="regular-provider-cost" label="Regular provider cost per click" hint="What we pay the traffic provider. Used for the profit report only; affiliates never see it.">
            <Input id="regular-provider-cost" type="number" step="0.01" min="0" value={money.regularProviderCost} onChange={(e) => setMoney((m) => ({ ...m, regularProviderCost: e.target.value }))} />
          </Field>
          <Field id="warm-provider-cost" label="Warm provider cost per click" hint="What we pay the traffic provider. Used for the profit report only; affiliates never see it.">
            <Input id="warm-provider-cost" type="number" step="0.01" min="0" value={money.warmProviderCost} onChange={(e) => setMoney((m) => ({ ...m, warmProviderCost: e.target.value }))} />
          </Field>
          <Field id="min-deposit" label="Minimum card deposit">
            <Input id="min-deposit" type="number" step="0.01" min="1" value={money.minDeposit} onChange={(e) => setMoney((m) => ({ ...m, minDeposit: e.target.value }))} />
          </Field>
          <Field id="min-daily" label="Minimum daily budget">
            <Input id="min-daily" type="number" step="0.01" min="1" value={money.minDaily} onChange={(e) => setMoney((m) => ({ ...m, minDaily: e.target.value }))} />
          </Field>
          <Field id="max-daily" label="Maximum daily budget">
            <Input id="max-daily" type="number" step="0.01" min="1" value={money.maxDaily} onChange={(e) => setMoney((m) => ({ ...m, maxDaily: e.target.value }))} />
          </Field>
          <Field id="low-balance" label="Low balance alert" hint="Affiliates are notified when available funds fall below this.">
            <Input id="low-balance" type="number" step="0.01" min="0" value={money.lowBalance} onChange={(e) => setMoney((m) => ({ ...m, lowBalance: e.target.value }))} />
          </Field>
        </div>
      </section>

      <section className="premium-card space-y-4 p-6">
        <h2 className="text-base font-semibold">Targeting and attribution</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field id="countries" label="Supported countries" hint="Two-letter codes, comma separated.">
            <Input id="countries" value={countries} onChange={(e) => setCountries(e.target.value)} />
          </Field>
          <Field id="tz" label="Default timezone">
            <Input id="tz" value={config.defaultTimezone} onChange={(e) => set("defaultTimezone", e.target.value)} />
          </Field>
          <Field id="fallback" label="Fallback URL" hint="Where traffic goes when no campaign can take it.">
            <Input id="fallback" type="url" value={config.fallbackUrl} onChange={(e) => set("fallbackUrl", e.target.value)} />
          </Field>
          <Field id="attr-window" label="Attribution window (days)">
            <Input id="attr-window" type="number" min="1" max="90" value={config.attributionWindowDays} onChange={num("attributionWindowDays")} />
          </Field>
          <Field id="cpa-hold" label="CPA conversion hold (days)" hint="CPA sales are approved after this hold.">
            <Input id="cpa-hold" type="number" min="0" max="90" value={config.cpaApprovalDays} onChange={num("cpaApprovalDays")} />
          </Field>
        </div>
      </section>

      <section className="premium-card space-y-4 p-6">
        <h2 className="text-base font-semibold">Traffic quality</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field id="unique-window" label="Unique visitor window (hours)" hint="A repeat visitor is not sent to the same campaign again.">
            <Input id="unique-window" type="number" min="1" max="720" value={config.uniqueVisitorWindowHours} onChange={num("uniqueVisitorWindowHours")} />
          </Field>
          <Field id="validation-delay" label="Billing review delay (minutes)">
            <Input id="validation-delay" type="number" min="0" max="1440" value={config.validationDelayMinutes} onChange={num("validationDelayMinutes")} />
          </Field>
          <Field id="ip-rate" label="Max clicks per IP per hour">
            <Input id="ip-rate" type="number" min="1" value={config.maxClicksPerIpPerHour} onChange={num("maxClicksPerIpPerHour")} />
          </Field>
          <Field id="token-rate" label="Max clicks per provider link per minute">
            <Input id="token-rate" type="number" min="1" value={config.maxClicksPerTokenPerMinute} onChange={num("maxClicksPerTokenPerMinute")} />
          </Field>
        </div>
        <Toggle id="block-bots" label="Block known bots and automated browsers" checked={config.blockBots} onChange={(v) => set("blockBots", v)} />
      </section>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save settings"}
        </Button>
      </div>
    </form>
  );
}
