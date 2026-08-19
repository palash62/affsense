// Types, constants, and pure utilities for digital products.
// No mock data, no localStorage.

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

export const SHORT_DESCRIPTION_MAX = 160;

export const DEFAULT_FORM_VALUES: DigitalProductFormValues = {
  name: "",
  category: "",
  shortDescription: "",
  productType: "Digital Download",
  niche: "Productivity",
  status: "Draft",
  featured: false,
  isNew: false,
  salesPageUrl: "",
  affiliateTrackingParam: "affsense_id",
  previewUrl: "",
  frontEndCommission: "50",
  upsellCommission: "",
  referralReward: "",
  price: "",
  vendor: "",
  webhookSecret: "",
};

export function computeCommissionAmount(price: number, percent: number): string {
  const amount = (price * percent) / 100;
  return `$${amount.toFixed(2)}`;
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
  let result = products;

  if (filters.status) {
    result = result.filter((p) => p.status === filters.status);
  }
  if (filters.category) {
    result = result.filter(
      (p) => p.category.toLowerCase() === filters.category!.toLowerCase(),
    );
  }
  if (filters.type) {
    result = result.filter(
      (p) => p.productType.toLowerCase() === filters.type!.toLowerCase(),
    );
  }
  if (filters.q) {
    const q = filters.q.toLowerCase();
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.vendor.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q),
    );
  }

  return result;
}
