"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Check, ChevronDown, ChevronUp, Info, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import {
  TIER_COUNTRIES,
  TIER_COUNTRY_GROUPS,
  TIER_META,
  getCountryName,
  getFullySelectedTiers,
  getPartialTierFromSelection,
  hasPartialAndFullTierMix,
  isTierFullySelectedInList,
  resolveCountryTier,
  type CountryTier,
} from "@/lib/campaign-form";

type CampaignCountryFieldProps = {
  label: string;
  hint?: string;
  selected: string[];
  onChange: (codes: string[]) => void;
  showTierButtons?: boolean;
  singleTierOnly?: boolean;
  searchPlaceholder?: string;
  /** Tiers locked because the opposite Allow/Block list uses them. */
  disabledTiers?: CountryTier[];
  /** Individual countries locked by the opposite list. */
  disabledCountries?: string[];
  conflictLabel?: string;
};

export function CampaignCountryField({
  label,
  hint,
  selected,
  onChange,
  showTierButtons = true,
  singleTierOnly = false,
  searchPlaceholder = "Search countries...",
  disabledTiers = [],
  disabledCountries = [],
  conflictLabel = "the other traffic list",
}: CampaignCountryFieldProps) {
  if (singleTierOnly) {
    return (
      <SingleTierCountryField
        label={label}
        hint={hint}
        selected={selected}
        onChange={onChange}
        showTierButtons={showTierButtons}
        searchPlaceholder={searchPlaceholder}
        disabledTiers={disabledTiers}
        disabledCountries={disabledCountries}
        conflictLabel={conflictLabel}
      />
    );
  }

  return (
    <CountrySearchMultiSelect
      label={label}
      hint={hint}
      selected={selected}
      onChange={onChange}
      showTierButtons={showTierButtons}
      searchPlaceholder={searchPlaceholder}
      disabledTiers={disabledTiers}
      disabledCountries={disabledCountries}
      conflictLabel={conflictLabel}
    />
  );
}

function SingleTierCountryField({
  label,
  hint,
  selected,
  onChange,
  showTierButtons,
  searchPlaceholder,
  disabledTiers = [],
  disabledCountries = [],
  conflictLabel = "the other traffic list",
}: Pick<
  CampaignCountryFieldProps,
  | "label"
  | "hint"
  | "selected"
  | "onChange"
  | "showTierButtons"
  | "searchPlaceholder"
  | "disabledTiers"
  | "disabledCountries"
  | "conflictLabel"
>) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(true);
  const [tierNotice, setTierNotice] = useState<string | null>(null);

  const partialTier = getPartialTierFromSelection(selected);
  const fullTiers = getFullySelectedTiers(selected);
  const hasInvalidSelection = hasPartialAndFullTierMix(selected);
  const disabledTierSet = useMemo(() => new Set(disabledTiers), [disabledTiers]);
  const disabledCountrySet = useMemo(
    () => new Set(disabledCountries.map((code) => code.trim().toUpperCase())),
    [disabledCountries],
  );

  const filteredGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    return TIER_COUNTRY_GROUPS.map((group) => ({
      ...group,
      countries: group.countries.filter(
        (code) =>
          !term ||
          code.toLowerCase().includes(term) ||
          getCountryName(code).toLowerCase().includes(term),
      ),
    })).filter((group) => group.countries.length > 0);
  }, [search]);

  function isExternallyDisabledTier(tier: CountryTier) {
    return disabledTierSet.has(tier);
  }

  function isExternallyDisabledCountry(code: string) {
    const upper = code.trim().toUpperCase();
    if (disabledCountrySet.has(upper)) return true;
    const tier = resolveCountryTier(upper);
    return tier !== null && disabledTierSet.has(tier);
  }

  function isTierFullySelected(tier: CountryTier) {
    return isTierFullySelectedInList(tier, selected);
  }

  function removeTierCountries(tier: CountryTier) {
    const tierSet = new Set<string>(TIER_COUNTRIES[tier]);
    return selected.filter((code) => !tierSet.has(code));
  }

  function canUseSelectAll(tier: CountryTier) {
    if (isExternallyDisabledTier(tier)) return false;
    if (hasInvalidSelection) return false;
    if (partialTier && partialTier !== tier) return false;
    return true;
  }

  function toggleCountry(code: string) {
    setTierNotice(null);
    const countryTier = resolveCountryTier(code);
    if (!countryTier) return;

    if (selected.includes(code)) {
      if (fullTiers.length > 0 && isTierFullySelectedInList(countryTier, selected)) {
        onChange(removeTierCountries(countryTier));
        return;
      }
      onChange(selected.filter((item) => item !== code));
      return;
    }

    if (isExternallyDisabledCountry(code) || isExternallyDisabledTier(countryTier)) {
      setTierNotice(
        `${TIER_META[countryTier].label} is already used in ${conflictLabel}. Choose a different tier.`,
      );
      return;
    }

    if (hasInvalidSelection) {
      setTierNotice("Invalid selection. Clear all and start again.");
      return;
    }

    if (fullTiers.length > 0) {
      setTierNotice(
        `Use "Select all" to add full ${TIER_META[countryTier].label}. Individual countries from other tiers are not allowed.`,
      );
      return;
    }

    if (partialTier && partialTier !== countryTier) {
      setTierNotice(
        `Only ${TIER_META[partialTier].label} countries can be selected until you complete or clear this tier.`,
      );
      return;
    }

    onChange([...selected, code]);
  }

  function selectFullTier(tier: CountryTier) {
    setTierNotice(null);

    if (isExternallyDisabledTier(tier)) {
      setTierNotice(
        `${TIER_META[tier].label} is already used in ${conflictLabel}. Choose a different tier.`,
      );
      return;
    }

    if (hasInvalidSelection) {
      onChange([...TIER_COUNTRIES[tier]]);
      return;
    }

    if (isTierFullySelected(tier)) {
      onChange(removeTierCountries(tier));
      return;
    }

    if (partialTier && partialTier !== tier) {
      setTierNotice(
        `Complete or clear your ${TIER_META[partialTier].label} selection before adding full ${TIER_META[tier].label}.`,
      );
      return;
    }

    onChange(Array.from(new Set([...selected, ...TIER_COUNTRIES[tier]])));
  }

  function removeCountry(code: string) {
    setTierNotice(null);
    const countryTier = resolveCountryTier(code);
    if (countryTier && fullTiers.includes(countryTier) && isTierFullySelectedInList(countryTier, selected)) {
      onChange(removeTierCountries(countryTier));
      return;
    }
    onChange(selected.filter((item) => item !== code));
  }

  function isCountryClickable(tier: CountryTier) {
    if (isExternallyDisabledTier(tier)) return false;
    if (hasInvalidSelection) return false;
    if (selected.length === 0) return true;
    if (fullTiers.length > 0) return false;
    if (partialTier) return tier === partialTier;
    return true;
  }

  function isTierSelectAllOnly(tier: CountryTier) {
    if (fullTiers.length > 0 && !fullTiers.includes(tier)) return true;
    return false;
  }

  function isTierLockedForSelectAll(tier: CountryTier) {
    if (isExternallyDisabledTier(tier)) return true;
    return partialTier !== null && partialTier !== tier;
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}

      {disabledTiers.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
          <p>
            Unavailable here (used in {conflictLabel}):{" "}
            <strong>{disabledTiers.map((tier) => TIER_META[tier].label).join(", ")}</strong>
          </p>
        </div>
      )}

      {hasInvalidSelection && (
        <Alert className="border-red-200 bg-red-50 text-red-900">
          <AlertTriangle className="text-red-600" />
          <AlertTitle className="text-red-900">Invalid selection</AlertTitle>
          <AlertDescription className="text-red-800">
            Partial and full tiers are mixed. Clear all and select again.
          </AlertDescription>
        </Alert>
      )}

      {selected.length > 0 && !hasInvalidSelection && (
        <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-600" />
          <p>
            {fullTiers.length > 0 ? (
              <>
                Full tier{fullTiers.length > 1 ? "s" : ""}:{" "}
                <strong>{fullTiers.map((t) => TIER_META[t].label).join(", ")}</strong>. Use
                &quot;Select all&quot; to add more full tiers. Individual countries from other tiers
                are not allowed.
              </>
            ) : partialTier ? (
              <>
                Partial <strong>{TIER_META[partialTier].label}</strong> selection (
                {selected.length} countries). Other tiers are locked until you complete or clear this
                tier.
              </>
            ) : null}
          </p>
        </div>
      )}

      {tierNotice && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-900">
          <AlertTriangle className="text-amber-600" />
          <AlertTitle className="text-amber-900">Tier selection rule</AlertTitle>
          <AlertDescription className="text-amber-800">{tierNotice}</AlertDescription>
        </Alert>
      )}

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((code) => (
            <Badge
              key={code}
              variant="outline"
              className="gap-1 border-slate-200 bg-slate-50 pr-1 text-xs font-normal text-slate-700"
            >
              {getCountryName(code)} ({code})
              <button
                type="button"
                onClick={() => removeCountry(code)}
                className="rounded p-0.5 hover:bg-slate-200"
                aria-label={`Remove ${getCountryName(code)}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="flex shrink-0 items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            {expanded ? (
              <>
                Hide list <ChevronUp className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                Show list <ChevronDown className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </div>

        {expanded && (
          <div className="max-h-72 overflow-y-auto p-3">
            {filteredGroups.length === 0 ? (
              <p className="px-1 py-4 text-center text-sm text-slate-500">
                No countries match your search.
              </p>
            ) : (
              <div className="space-y-4">
                {filteredGroups.map((group) => {
                  const fullySelected = isTierFullySelected(group.tier);
                  const externallyDisabled = isExternallyDisabledTier(group.tier);
                  const selectAllEnabled = canUseSelectAll(group.tier);
                  const countriesInteractive = isCountryClickable(group.tier);
                  const selectAllOnly = isTierSelectAllOnly(group.tier);
                  const locked = isTierLockedForSelectAll(group.tier);

                  return (
                    <div
                      key={group.tier}
                      className={cn(
                        "rounded-lg border border-t-2 bg-slate-50/40",
                        group.accent,
                        locked && "opacity-60",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                          {group.label}
                          {externallyDisabled && (
                            <span className="ml-2 font-normal normal-case text-amber-700">
                              (used in {conflictLabel})
                            </span>
                          )}
                          {!externallyDisabled && locked && (
                            <span className="ml-2 font-normal normal-case text-slate-400">
                              (locked)
                            </span>
                          )}
                          {selectAllOnly && !externallyDisabled && (
                            <span className="ml-2 font-normal normal-case text-slate-400">
                              (Select all to add)
                            </span>
                          )}
                          {fullySelected && (
                            <span className="ml-2 font-normal normal-case text-emerald-600">
                              (full)
                            </span>
                          )}
                        </p>
                        {selectAllEnabled || fullySelected ? (
                          <button
                            type="button"
                            onClick={() => selectFullTier(group.tier)}
                            className="text-xs font-medium text-[var(--theme-primary)] hover:underline"
                          >
                            {fullySelected ? "Remove tier" : "Select all"}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">Select all</span>
                        )}
                      </div>
                      <div className="grid gap-1 p-2 sm:grid-cols-2">
                        {group.countries.map((code) => {
                          const active = selected.includes(code);
                          const canToggle =
                            !externallyDisabled &&
                            (countriesInteractive || (active && partialTier === group.tier));

                          if (!canToggle) {
                            return (
                              <div
                                key={code}
                                className={cn(
                                  "flex items-center gap-2 rounded-md border border-transparent px-2.5 py-2 text-left text-sm",
                                  active
                                    ? "text-[var(--theme-primary)]"
                                    : "cursor-not-allowed text-slate-400",
                                )}
                              >
                                <span
                                  className={cn(
                                    "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                                    active
                                      ? "border-[var(--theme-primary)] bg-[var(--theme-primary)] text-white"
                                      : "border-slate-200 bg-slate-100",
                                  )}
                                >
                                  {active && <Check className="h-3 w-3" />}
                                </span>
                                <span className="min-w-0 truncate">
                                  {getCountryName(code)}{" "}
                                  <span className="text-xs">({code})</span>
                                </span>
                              </div>
                            );
                          }

                          return (
                            <button
                              key={code}
                              type="button"
                              onClick={() => toggleCountry(code)}
                              className={cn(
                                "flex items-center gap-2 rounded-md border px-2.5 py-2 text-left text-sm transition-colors",
                                active
                                  ? "border-[var(--theme-primary)] bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]"
                                  : "border-transparent text-slate-700 hover:border-slate-200 hover:bg-white",
                              )}
                            >
                              <span
                                className={cn(
                                  "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                                  active
                                    ? "border-[var(--theme-primary)] bg-[var(--theme-primary)] text-white"
                                    : "border-slate-300 bg-white",
                                )}
                              >
                                {active && <Check className="h-3 w-3" />}
                              </span>
                              <span className="min-w-0 truncate">
                                {getCountryName(code)}{" "}
                                <span className="text-xs text-slate-500">({code})</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {showTierButtons && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-500">Full tier</span>
          {(Object.keys(TIER_META) as CountryTier[]).map((tier) => (
            <button
              key={tier}
              type="button"
              onClick={() => selectFullTier(tier)}
              disabled={
                isExternallyDisabledTier(tier) ||
                (!canUseSelectAll(tier) && !isTierFullySelected(tier))
              }
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                isTierFullySelected(tier)
                  ? "border-[var(--theme-primary)] bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]"
                  : "border-slate-200 text-slate-600 hover:bg-slate-50",
              )}
            >
              {TIER_META[tier].label}
              {isTierFullySelected(tier) ? " ✓" : ""}
            </button>
          ))}
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setTierNotice(null);
                onChange([]);
              }}
              className="text-xs font-medium text-slate-500 hover:text-slate-700 hover:underline"
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function CountrySearchMultiSelect({
  label,
  hint,
  selected,
  onChange,
  showTierButtons,
  searchPlaceholder,
  disabledTiers = [],
  disabledCountries = [],
  conflictLabel = "the other traffic list",
}: Pick<
  CampaignCountryFieldProps,
  | "label"
  | "hint"
  | "selected"
  | "onChange"
  | "showTierButtons"
  | "searchPlaceholder"
  | "disabledTiers"
  | "disabledCountries"
  | "conflictLabel"
>) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(true);
  const disabledTierSet = useMemo(() => new Set(disabledTiers), [disabledTiers]);
  const disabledCountrySet = useMemo(
    () => new Set(disabledCountries.map((code) => code.trim().toUpperCase())),
    [disabledCountries],
  );

  const filteredGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    return TIER_COUNTRY_GROUPS.map((group) => ({
      ...group,
      countries: group.countries.filter(
        (code) =>
          !term ||
          code.toLowerCase().includes(term) ||
          getCountryName(code).toLowerCase().includes(term),
      ),
    })).filter((group) => group.countries.length > 0);
  }, [search]);

  function isExternallyDisabledTier(tier: CountryTier) {
    return disabledTierSet.has(tier);
  }

  function isExternallyDisabledCountry(code: string) {
    const upper = code.trim().toUpperCase();
    if (disabledCountrySet.has(upper)) return true;
    const tier = resolveCountryTier(upper);
    return tier !== null && disabledTierSet.has(tier);
  }

  function toggleCountry(code: string) {
    if (selected.includes(code)) {
      onChange(selected.filter((item) => item !== code));
      return;
    }
    if (isExternallyDisabledCountry(code)) return;
    onChange([...selected, code]);
  }

  function removeCountry(code: string) {
    onChange(selected.filter((item) => item !== code));
  }

  function addTier(tier: CountryTier) {
    if (isExternallyDisabledTier(tier)) return;
    onChange(Array.from(new Set([...selected, ...TIER_COUNTRIES[tier]])));
  }

  function clearTier(tier: CountryTier) {
    const tierCodes = new Set<string>(TIER_COUNTRIES[tier]);
    onChange(selected.filter((code) => !tierCodes.has(code)));
  }

  function isTierFullySelected(tier: CountryTier) {
    return isTierFullySelectedInList(tier, selected);
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {hint && <p className="text-xs text-slate-500">{hint}</p>}

      {disabledTiers.length > 0 && (
        <p className="text-xs text-amber-800">
          Unavailable here (used in {conflictLabel}):{" "}
          {disabledTiers.map((tier) => TIER_META[tier].label).join(", ")}
        </p>
      )}

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((code) => (
            <Badge
              key={code}
              variant="outline"
              className="gap-1 border-slate-200 bg-slate-50 pr-1 text-xs font-normal text-slate-700"
            >
              {getCountryName(code)} ({code})
              <button
                type="button"
                onClick={() => removeCountry(code)}
                className="rounded p-0.5 hover:bg-slate-200"
                aria-label={`Remove ${getCountryName(code)}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="flex shrink-0 items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            {expanded ? (
              <>
                Hide list <ChevronUp className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                Show list <ChevronDown className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </div>

        {expanded && (
          <div className="max-h-72 overflow-y-auto p-3">
            <div className="space-y-4">
              {filteredGroups.map((group) => {
                const fullySelected = isTierFullySelected(group.tier);
                const externallyDisabled = isExternallyDisabledTier(group.tier);
                return (
                  <div
                    key={group.tier}
                    className={cn(
                      "rounded-lg border border-t-2 bg-slate-50/40",
                      group.accent,
                      externallyDisabled && "opacity-60",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                        {group.label}
                        {externallyDisabled && (
                          <span className="ml-2 font-normal normal-case text-amber-700">
                            (used in {conflictLabel})
                          </span>
                        )}
                      </p>
                      {showTierButtons && !externallyDisabled && (
                        <button
                          type="button"
                          onClick={() => (fullySelected ? clearTier(group.tier) : addTier(group.tier))}
                          className="text-xs font-medium text-[var(--theme-primary)] hover:underline"
                        >
                          {fullySelected ? "Clear tier" : "Select all"}
                        </button>
                      )}
                    </div>
                    <div className="grid gap-1 p-2 sm:grid-cols-2">
                      {group.countries.map((code) => {
                        const active = selected.includes(code);
                        const disabled = externallyDisabled || isExternallyDisabledCountry(code);
                        if (disabled && !active) {
                          return (
                            <div
                              key={code}
                              className="flex cursor-not-allowed items-center gap-2 rounded-md border border-transparent px-2.5 py-2 text-left text-sm text-slate-400"
                            >
                              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-slate-200 bg-slate-100" />
                              <span className="min-w-0 truncate">
                                {getCountryName(code)}{" "}
                                <span className="text-xs">({code})</span>
                              </span>
                            </div>
                          );
                        }
                        return (
                          <button
                            key={code}
                            type="button"
                            onClick={() => toggleCountry(code)}
                            className={cn(
                              "flex items-center gap-2 rounded-md border px-2.5 py-2 text-left text-sm transition-colors",
                              active
                                ? "border-[var(--theme-primary)] bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]"
                                : "border-transparent text-slate-700 hover:border-slate-200 hover:bg-white",
                            )}
                          >
                            <span
                              className={cn(
                                "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                                active
                                  ? "border-[var(--theme-primary)] bg-[var(--theme-primary)] text-white"
                                  : "border-slate-300 bg-white",
                              )}
                            >
                              {active && <Check className="h-3 w-3" />}
                            </span>
                            <span className="min-w-0 truncate">
                              {getCountryName(code)}{" "}
                              <span className="text-xs text-slate-500">({code})</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
