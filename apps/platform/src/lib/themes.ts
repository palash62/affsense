export const THEME_IDS = [
  "enterprise-blue",
  "marketing-saas",
  "performance-green",
  "marketplace-purple",
  "slate-pro",
  "coral-navy",
  "deep-teal-peach",
  "ocean-blue-mist",
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export const DEFAULT_THEME: ThemeId = "coral-navy";

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
  {
    id: "coral-navy",
    name: "Coral + Navy",
    tagline: "Warm coral accents · deep navy shell",
    inspiredBy: "Modern SaaS with soft warmth and contrast",
  },
  {
    id: "deep-teal-peach",
    name: "Deep Teal + Peach",
    tagline: "Calm teal · soft peach accents",
    inspiredBy: "Fresh, approachable growth dashboard",
  },
  {
    id: "ocean-blue-mist",
    name: "Ocean Blue + Mist",
    tagline: "Ocean primary · mist surfaces",
    inspiredBy: "Clean analytics SaaS, clear and professional",
  },
];

export function isThemeId(value: string): value is ThemeId {
  return THEME_IDS.includes(value as ThemeId);
}
