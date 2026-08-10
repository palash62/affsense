"use client";

import { useCallback, useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SerializedCpaOffer } from "@/services/cpa-offer.service";

type CpaOfferSelectProps = {
  value: string | null;
  onChange: (offerId: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
  label?: string;
};

const NONE_VALUE = "__none__";

export function CpaOfferSelect({
  value,
  onChange,
  disabled = false,
  placeholder = "Select an offer",
  label = "CPA offer",
}: CpaOfferSelectProps) {
  const [offers, setOffers] = useState<SerializedCpaOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const loadOffers = useCallback(async () => {
    setLoading(true);
    setUnavailable(false);
    const res = await fetch("/api/v1/advertiser/cpa-offers?limit=100");
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setOffers([]);
      setUnavailable(true);
      setLoading(false);
      return;
    }
    const items = (body.data?.items ?? []) as SerializedCpaOffer[];
    if (items.length === 0 && (body.data?.total ?? 0) === 0) {
      setUnavailable(true);
    }
    setOffers(items);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadOffers();
  }, [loadOffers]);

  if (unavailable && !value) {
    return (
      <p className="text-xs text-muted-foreground">
        CPA offers are not available for your account. Use a destination URL instead.
      </p>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold tracking-wide text-emerald-700">
        {label}
      </Label>
      <Select
        value={value ?? NONE_VALUE}
        disabled={disabled || loading}
        onValueChange={(next) => onChange(next === NONE_VALUE ? null : next)}
      >
        <SelectTrigger className="h-9 w-full border-border bg-card text-sm">
          <SelectValue placeholder={loading ? "Loading offers…" : placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_VALUE}>None</SelectItem>
          {offers.map((offer) => (
            <SelectItem key={offer.id} value={offer.id}>
              {offer.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
