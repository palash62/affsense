"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Coins, LayoutGrid, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { parseOfferCountries } from "@/components/cpa/cpa-offer-geo-flags";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OfferWallDetailSheet } from "./offer-wall-detail-sheet";
import { OfferWallRow, type OfferWallItem } from "./offer-wall-row";

const PUBLISHER_UNCONFIGURED_HINT =
  "Ask an admin to add the OGAds Offer API key under Platform Settings → Offer Wall.";

function offerCountryCodes(country: string | null): string[] {
  return parseOfferCountries(country ?? "").filter((code) => code !== "ALL");
}

function matchesCountry(country: string | null, selected: string): boolean {
  if (selected === "all") return true;
  const codes = offerCountryCodes(country);
  if (codes.length === 0) return true;
  return codes.includes(selected);
}

export function PublisherOfferWallList({
  apiPath = "/api/v1/publisher/offer-wall",
  unconfiguredHint = PUBLISHER_UNCONFIGURED_HINT,
  settingsHref,
}: {
  apiPath?: string;
  unconfiguredHint?: string;
  settingsHref?: string;
}) {
  const [items, setItems] = useState<OfferWallItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [selected, setSelected] = useState<OfferWallItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(apiPath);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error?.message ?? "Failed to load offers");
        setItems([]);
        return;
      }
      setItems(json.data?.items ?? []);
      setConfigured(Boolean(json.data?.configured));
      setMessage(typeof json.data?.message === "string" ? json.data.message : null);
    } catch {
      toast.error("Failed to load offers");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [apiPath]);

  useEffect(() => {
    void load();
  }, [load]);

  const typeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      if (item.type?.trim()) set.add(item.type.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [items]);

  const countryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      for (const code of offerCountryCodes(item.country)) set.add(code);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = items.filter((item) => {
      if (typeFilter !== "all" && (item.type ?? "") !== typeFilter) return false;
      if (!matchesCountry(item.country, countryFilter)) return false;
      if (!term) return true;
      return (
        item.name.toLowerCase().includes(term) ||
        item.id.toLowerCase().includes(term) ||
        (item.type ?? "").toLowerCase().includes(term) ||
        (item.country ?? "").toLowerCase().includes(term) ||
        (item.description ?? "").toLowerCase().includes(term)
      );
    });
    return [...list].sort((a, b) => (Number(b.payout) || 0) - (Number(a.payout) || 0));
  }, [items, q, typeFilter, countryFilter]);

  const featuredId = filtered[0]?.id ?? null;
  const hasActiveFilters = Boolean(q.trim()) || typeFilter !== "all" || countryFilter !== "all";

  return (
    <>
    <div className="-mx-4 overflow-hidden rounded-[var(--radius-card,0.875rem)] border border-border bg-card shadow-[var(--shadow-card)] sm:mx-0">
      <div className="bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-accent-purple,#713BFF)] px-5 py-7 text-center sm:px-8 sm:py-8">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-white/15 text-white">
          <Coins className="h-5 w-5" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Earn from offers</h2>
        <p className="mx-auto mt-2 max-w-lg text-sm text-white/85">
          Complete a sponsor offer to earn. Payouts credit your wallet.
        </p>
        <p className="mt-3 text-xs font-medium text-white/75">
          {loading
            ? "Loading offers…"
            : `${filtered.length} offer${filtered.length === 1 ? "" : "s"} available`}
        </p>
      </div>

      <div className="flex flex-col gap-2 border-b border-border bg-muted/40 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:px-5">
        <div className="relative min-w-[160px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-9 border-border bg-background pl-8 text-sm"
            placeholder="Search offers…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select
          value={typeFilter}
          onValueChange={(v) => {
            if (v) setTypeFilter(v);
          }}
        >
          <SelectTrigger className="h-9 w-full border-border bg-background sm:w-[150px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {typeOptions.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={countryFilter}
          onValueChange={(v) => {
            if (v) setCountryFilter(v);
          }}
        >
          <SelectTrigger className="h-9 w-full border-border bg-background sm:w-[150px]">
            <SelectValue placeholder="Country" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All countries</SelectItem>
            {countryOptions.map((code) => (
              <SelectItem key={code} value={code}>
                {code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          className="h-9 gap-2"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="space-y-0 divide-y divide-border p-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <div className="h-16 w-16 animate-pulse rounded-md bg-muted" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
              </div>
              <div className="h-11 w-32 animate-pulse rounded-md bg-muted" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[var(--theme-primary-soft)]">
            <LayoutGrid className="h-6 w-6 text-[var(--theme-primary)]" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-foreground">
            {!configured
              ? "Offer Wall not configured"
              : hasActiveFilters
                ? "No offers match your filters"
                : "No offers available"}
          </h3>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {message ||
              (!configured
                ? unconfiguredHint
                : hasActiveFilters
                  ? "Try another type, country, or search."
                  : "Try again later.")}
          </p>
          {!configured && settingsHref ? (
            <Button asChild className="mt-4">
              <Link href={settingsHref}>Open Offer Wall settings</Link>
            </Button>
          ) : null}
        </div>
      ) : (
        <div>
          {filtered.map((offer) => (
            <OfferWallRow
              key={offer.id}
              offer={offer}
              featured={offer.id === featuredId}
              onSelect={() => setSelected(offer)}
            />
          ))}
        </div>
      )}
    </div>
    <OfferWallDetailSheet
      offer={selected}
      featured={Boolean(selected && selected.id === featuredId)}
      open={Boolean(selected)}
      onOpenChange={(open) => {
        if (!open) setSelected(null);
      }}
    />
    </>
  );
}
