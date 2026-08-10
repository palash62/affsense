export type DigitalProductStatus = "Active" | "Draft";

export type ProductCategoryItem = {
  id: string;
  name: string;
  status: "Active" | "Inactive";
  productCount: number;
};

export interface DigitalProductListItem {
  id: string;
  name: string;
  category: string;
  niche: string;
  productType: string;
  status: DigitalProductStatus;
  price: number;
  frontEndCommission: number;
  featured: boolean;
  isNew: boolean;
  thumbTone: string;
  vendor: string;
  imageUrl?: string;
}

export interface DigitalProductFormValues {
  name: string;
  category: string;
  shortDescription: string;
  productType: string;
  niche: string;
  status: DigitalProductStatus;
  featured: boolean;
  isNew: boolean;
  salesPageUrl: string;
  affiliateTrackingParam: string;
  previewUrl: string;
  frontEndCommission: string;
  upsellCommission: string;
  referralReward: string;
  price: string;
  vendor: string;
  webhookSecret: string;
}

export const DIGITAL_PRODUCT_CATEGORIES = [
  "AI Tools",
  "Marketing",
  "Finance",
  "Health",
  "Productivity",
  "Education",
] as const;

export const DIGITAL_PRODUCT_TYPES = [
  "Digital Download",
  "Membership",
  "Course",
  "Software License",
] as const;

export const DIGITAL_PRODUCT_NICHES = [
  "Productivity",
  "Business",
  "Health & Wellness",
  "Personal Finance",
  "Technology",
] as const;

export const MOCK_WEBHOOK_URL =
  "https://api.leadvix.io/webhooks/digital/ai-prompt-vault-9f2a";

export const DIGITAL_PRODUCTS_STORAGE_KEY = "affsense-digital-products-mock";
export const DIGITAL_PRODUCT_CATEGORIES_STORAGE_KEY =
  "affsense-digital-product-categories-mock";

export const DEFAULT_FORM_VALUES: DigitalProductFormValues = {
  name: "AI Prompt Vault",
  category: "AI Tools",
  shortDescription:
    "Unlock 500+ premium AI prompts for ChatGPT, Claude, and Midjourney. Boost productivity instantly.",
  productType: "Digital Download",
  niche: "Productivity",
  status: "Active",
  featured: true,
  isNew: true,
  salesPageUrl: "https://clickfunnels.com/ai-prompt-vault",
  affiliateTrackingParam: "affsense_id",
  previewUrl: "https://demo.leadvix.io/ai-prompt-vault",
  frontEndCommission: "80",
  upsellCommission: "50",
  referralReward: "10",
  price: "9.95",
  vendor: "Affsense Partners",
  webhookSecret: "whsec_••••••••••••••••",
};

export const MOCK_WEBHOOK_STATS = {
  lastEvent: "May 31, 2025 · 10:42 AM",
  totalEvents: "1,248",
  connected: true,
};

function seedImage(id: string) {
  return `https://picsum.photos/seed/${id}/640/400`;
}

const THUMB_TONES = [
  "from-violet-500 to-indigo-600",
  "from-blue-500 to-cyan-600",
  "from-emerald-500 to-teal-600",
  "from-rose-500 to-pink-600",
  "from-amber-500 to-orange-600",
  "from-slate-600 to-slate-800",
] as const;

export const MOCK_DIGITAL_PRODUCTS: DigitalProductListItem[] = [
  {
    id: "ai-prompt-vault",
    name: "AI Prompt Vault",
    category: "AI Tools",
    niche: "Productivity",
    productType: "Digital Download",
    status: "Active",
    price: 9.95,
    frontEndCommission: 80,
    featured: true,
    isNew: true,
    thumbTone: "from-violet-500 to-indigo-600",
    vendor: "Affsense Partners",
    imageUrl: seedImage("ai-prompt-vault"),
  },
  {
    id: "email-swipe-kit",
    name: "Email Swipe Kit",
    category: "Marketing",
    niche: "Business",
    productType: "Digital Download",
    status: "Active",
    price: 79,
    frontEndCommission: 75,
    featured: true,
    isNew: false,
    thumbTone: "from-blue-500 to-cyan-600",
    vendor: "Affsense Partners",
    imageUrl: seedImage("email-swipe-kit"),
  },
  {
    id: "finance-cpa-pack",
    name: "Finance CPA Pack",
    category: "Finance",
    niche: "Personal Finance",
    productType: "Membership",
    status: "Active",
    price: 49,
    frontEndCommission: 70,
    featured: false,
    isNew: false,
    thumbTone: "from-emerald-500 to-teal-600",
    vendor: "Finance Labs",
    imageUrl: seedImage("finance-cpa-pack"),
  },
  {
    id: "health-wellness-bundle",
    name: "Health & Wellness Bundle",
    category: "Health",
    niche: "Health & Wellness",
    productType: "Course",
    status: "Draft",
    price: 129,
    frontEndCommission: 65,
    featured: false,
    isNew: true,
    thumbTone: "from-rose-500 to-pink-600",
    vendor: "Wellness Co",
    imageUrl: seedImage("health-wellness-bundle"),
  },
  {
    id: "quick-earn-bonus",
    name: "Quick Earn Bonus",
    category: "Productivity",
    niche: "Technology",
    productType: "Digital Download",
    status: "Active",
    price: 12,
    frontEndCommission: 85,
    featured: false,
    isNew: false,
    thumbTone: "from-amber-500 to-orange-600",
    vendor: "Affsense Partners",
    imageUrl: seedImage("quick-earn-bonus"),
  },
  {
    id: "saas-starter-kit",
    name: "SaaS Starter Kit",
    category: "Education",
    niche: "Business",
    productType: "Software License",
    status: "Active",
    price: 199,
    frontEndCommission: 60,
    featured: true,
    isNew: false,
    thumbTone: "from-slate-600 to-slate-800",
    vendor: "BuildFast Inc",
    imageUrl: seedImage("saas-starter-kit"),
  },
];

export function computeCommissionAmount(price: number, percent: number): string {
  const amount = (price * percent) / 100;
  return `$${amount.toFixed(2)}`;
}

export const SHORT_DESCRIPTION_MAX = 160;

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function readStoredProducts(): DigitalProductListItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DIGITAL_PRODUCTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is DigitalProductListItem =>
        Boolean(item && typeof item === "object" && "id" in item && "name" in item),
    );
  } catch {
    return [];
  }
}

/** Merge seeded mocks with localStorage items (local wins on same id). */
export function loadMockDigitalProducts(): DigitalProductListItem[] {
  const stored = readStoredProducts();
  const byId = new Map<string, DigitalProductListItem>();
  for (const item of MOCK_DIGITAL_PRODUCTS) byId.set(item.id, item);
  for (const item of stored) byId.set(item.id, item);
  // Prefer newest custom items first, then seed order
  const seedIds = new Set(MOCK_DIGITAL_PRODUCTS.map((p) => p.id));
  const custom = stored.filter((p) => !seedIds.has(p.id)).reverse();
  const seeds = MOCK_DIGITAL_PRODUCTS.map((p) => byId.get(p.id)!);
  const overriddenSeeds = seeds.map((p) => {
    const local = stored.find((s) => s.id === p.id);
    return local ?? p;
  });
  return [...custom, ...overriddenSeeds];
}

export function saveMockDigitalProduct(item: DigitalProductListItem): void {
  if (typeof window === "undefined") return;
  const stored = readStoredProducts();
  const idx = stored.findIndex((p) => p.id === item.id);
  const next = [...stored];
  if (idx >= 0) next[idx] = item;
  else next.push(item);
  window.localStorage.setItem(DIGITAL_PRODUCTS_STORAGE_KEY, JSON.stringify(next));
}

export function formValuesToListItem(
  values: DigitalProductFormValues,
  imageUrl?: string | null,
): DigitalProductListItem {
  const baseSlug = slugify(values.name) || "product";
  const id = `${baseSlug}-${Date.now().toString(36)}`;
  const toneIndex = Math.abs(id.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % THUMB_TONES.length;

  return {
    id,
    name: values.name.trim() || "Untitled product",
    category: values.category,
    niche: values.niche,
    productType: values.productType,
    status: values.status,
    price: Number.parseFloat(values.price) || 0,
    frontEndCommission: Number.parseFloat(values.frontEndCommission) || 0,
    featured: values.featured,
    isNew: values.isNew,
    thumbTone: THUMB_TONES[toneIndex],
    vendor: values.vendor.trim() || "Affsense Partners",
    imageUrl: imageUrl || undefined,
  };
}

export function readImageDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not read image"));
    };
    reader.onerror = () => reject(reader.error ?? new Error("Could not read image"));
    reader.readAsDataURL(file);
  });
}

export function filterDigitalProducts(
  products: DigitalProductListItem[],
  filters: { q?: string; status?: string; category?: string; type?: string },
): DigitalProductListItem[] {
  const q = filters.q?.trim().toLowerCase() ?? "";
  return products.filter((p) => {
    if (filters.status && filters.status !== "all" && p.status !== filters.status) return false;
    if (filters.category && filters.category !== "all" && p.category !== filters.category) return false;
    if (filters.type && filters.type !== "all" && p.productType !== filters.type) return false;
    if (q) {
      const hay = `${p.name} ${p.vendor} ${p.category} ${p.niche}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function categoryIdFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function countProductsByCategory(categoryName: string): number {
  return MOCK_DIGITAL_PRODUCTS.filter((p) => p.category === categoryName).length;
}

export const SEED_PRODUCT_CATEGORIES: ProductCategoryItem[] = DIGITAL_PRODUCT_CATEGORIES.map(
  (name) => ({
    id: categoryIdFromName(name),
    name,
    status: "Active" as const,
    productCount: countProductsByCategory(name),
  }),
);

function readStoredCategories(): ProductCategoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DIGITAL_PRODUCT_CATEGORIES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is ProductCategoryItem =>
        Boolean(item && typeof item === "object" && "id" in item && "name" in item),
    );
  } catch {
    return [];
  }
}

export function loadMockProductCategories(): ProductCategoryItem[] {
  const stored = readStoredCategories();
  if (stored.length === 0) return SEED_PRODUCT_CATEGORIES;
  const byId = new Map<string, ProductCategoryItem>();
  for (const c of SEED_PRODUCT_CATEGORIES) byId.set(c.id, c);
  for (const c of stored) byId.set(c.id, c);
  return Array.from(byId.values());
}

export function saveMockProductCategory(item: ProductCategoryItem): void {
  if (typeof window === "undefined") return;
  const current = loadMockProductCategories();
  const idx = current.findIndex((c) => c.id === item.id);
  const next = [...current];
  if (idx >= 0) next[idx] = item;
  else next.push(item);
  window.localStorage.setItem(DIGITAL_PRODUCT_CATEGORIES_STORAGE_KEY, JSON.stringify(next));
}

export function deleteMockProductCategory(id: string): void {
  if (typeof window === "undefined") return;
  const next = loadMockProductCategories().filter((c) => c.id !== id);
  window.localStorage.setItem(DIGITAL_PRODUCT_CATEGORIES_STORAGE_KEY, JSON.stringify(next));
}

export function productCategoryNames(): string[] {
  return loadMockProductCategories()
    .filter((c) => c.status === "Active")
    .map((c) => c.name);
}
