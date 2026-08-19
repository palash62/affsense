export const THEME_IDS = [
  "enterprise-blue",
  "marketing-saas",
  "performance-green",
  "marketplace-purple",
  "slate-pro",
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export const DEFAULT_THEME: ThemeId = "marketing-saas";

export const THEME_STORAGE_KEY = "cpl-theme";

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  tagline: string;
  inspiredBy: string;
}

export const THEMES: ThemeMeta[] = [
  {
    id: "enterprise-blue",
    name: "Enterprise Blue",
    tagline: "Stripe · HubSpot · MaxBounty clean",
    inspiredBy: "Corporate CRM, trustworthy B2B",
  },
  {
    id: "marketing-saas",
    name: "Marketing SaaS",
    tagline: "Black + electric orange · performance marketing",
    inspiredBy: "Premium growth platform, confident and conversion-focused",
  },
  {
    id: "performance-green",
    name: "Performance Green",
    tagline: "Earnings-first CPA dashboard",
    inspiredBy: "Publisher payouts & growth",
  },
  {
    id: "marketplace-purple",
    name: "Marketplace Purple",
    tagline: "Monday.com · ClickUp energy",
    inspiredBy: "Offer marketplace & discovery",
  },
  {
    id: "slate-pro",
    name: "Affsense",
    tagline: "Deep navy sidebar · indigo + purple accents",
    inspiredBy: "Affsense premium SaaS dashboard",
  },
];

export function isThemeId(value: string): value is ThemeId {
  return THEME_IDS.includes(value as ThemeId);
}
