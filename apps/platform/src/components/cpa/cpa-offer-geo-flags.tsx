"use client";

import { cn } from "@/lib/utils";

export const REGION_FLAG: Record<string, string> = {
  US: "🇺🇸",
  USA: "🇺🇸",
  CA: "🇨🇦",
  CAN: "🇨🇦",
  GB: "🇬🇧",
  UK: "🇬🇧",
  AU: "🇦🇺",
  NZ: "🇳🇿",
  DE: "🇩🇪",
  FR: "🇫🇷",
  ES: "🇪🇸",
  IT: "🇮🇹",
  NL: "🇳🇱",
  BE: "🇧🇪",
  IN: "🇮🇳",
  BR: "🇧🇷",
  MX: "🇲🇽",
  JP: "🇯🇵",
  KR: "🇰🇷",
  SG: "🇸🇬",
  AE: "🇦🇪",
  PH: "🇵🇭",
  MY: "🇲🇾",
  ID: "🇮🇩",
  TH: "🇹🇭",
  VN: "🇻🇳",
  ZA: "🇿🇦",
  NG: "🇳🇬",
  KE: "🇰🇪",
  IE: "🇮🇪",
  SE: "🇸🇪",
  NO: "🇳🇴",
  DK: "🇩🇰",
  FI: "🇫🇮",
  PL: "🇵🇱",
  PT: "🇵🇹",
  CH: "🇨🇭",
  AT: "🇦🇹",
};

export const CPA_COUNTRY_OPTIONS: Array<{ code: string; name: string; flag: string }> = [
  { code: "US", name: "United States", flag: "🇺🇸" },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "AU", name: "Australia", flag: "🇦🇺" },
  { code: "NZ", name: "New Zealand", flag: "🇳🇿" },
  { code: "DE", name: "Germany", flag: "🇩🇪" },
  { code: "FR", name: "France", flag: "🇫🇷" },
  { code: "ES", name: "Spain", flag: "🇪🇸" },
  { code: "IT", name: "Italy", flag: "🇮🇹" },
  { code: "NL", name: "Netherlands", flag: "🇳🇱" },
  { code: "BE", name: "Belgium", flag: "🇧🇪" },
  { code: "IN", name: "India", flag: "🇮🇳" },
  { code: "BR", name: "Brazil", flag: "🇧🇷" },
  { code: "MX", name: "Mexico", flag: "🇲🇽" },
  { code: "JP", name: "Japan", flag: "🇯🇵" },
  { code: "KR", name: "South Korea", flag: "🇰🇷" },
  { code: "SG", name: "Singapore", flag: "🇸🇬" },
  { code: "AE", name: "United Arab Emirates", flag: "🇦🇪" },
  { code: "PH", name: "Philippines", flag: "🇵🇭" },
  { code: "MY", name: "Malaysia", flag: "🇲🇾" },
  { code: "ID", name: "Indonesia", flag: "🇮🇩" },
  { code: "TH", name: "Thailand", flag: "🇹🇭" },
  { code: "VN", name: "Vietnam", flag: "🇻🇳" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦" },
  { code: "NG", name: "Nigeria", flag: "🇳🇬" },
  { code: "KE", name: "Kenya", flag: "🇰🇪" },
  { code: "IE", name: "Ireland", flag: "🇮🇪" },
  { code: "SE", name: "Sweden", flag: "🇸🇪" },
  { code: "NO", name: "Norway", flag: "🇳🇴" },
  { code: "DK", name: "Denmark", flag: "🇩🇰" },
  { code: "FI", name: "Finland", flag: "🇫🇮" },
  { code: "PL", name: "Poland", flag: "🇵🇱" },
  { code: "PT", name: "Portugal", flag: "🇵🇹" },
  { code: "CH", name: "Switzerland", flag: "🇨🇭" },
  { code: "AT", name: "Austria", flag: "🇦🇹" },
];

export function flagForCountry(code: string): string {
  return REGION_FLAG[code.toUpperCase()] ?? "🏳️";
}

export function parseOfferCountries(country: string): string[] {
  return country
    .split(/[,|/+]+/)
    .map((part) => part.trim().toUpperCase())
    .filter(Boolean);
}

export function CpaOfferGeoFlags({
  country,
  maxVisible = 3,
  className,
}: {
  country: string;
  maxVisible?: number;
  className?: string;
}) {
  const codes = parseOfferCountries(country).filter((code) => code !== "ALL");
  if (codes.length === 0) {
    return (
      <span className="rounded-md bg-sky-100 px-1.5 py-0.5 text-[11px] font-semibold text-sky-800">
        Global
      </span>
    );
  }

  const visible = codes.slice(0, maxVisible);
  const overflow = codes.length - visible.length;

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      {visible.map((code) => (
        <span
          key={code}
          title={code}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-1.5 py-0.5 text-[11px] font-medium text-foreground"
        >
          <span aria-hidden>{flagForCountry(code)}</span>
          {code}
        </span>
      ))}
      {overflow > 0 ? (
        <span className="rounded-md bg-sky-100 px-1.5 py-0.5 text-[11px] font-semibold text-sky-800">
          +{overflow} included
        </span>
      ) : null}
    </div>
  );
}
