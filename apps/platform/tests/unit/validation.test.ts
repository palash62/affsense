import { describe, it, expect } from "vitest";
import { validateLead } from "@/lib/lead-validation";
import { adminPublisherSmartLinkCampaignsSchema, adminUpdateStaffUserSchema, isValidEmail, isValidPhone } from "@/lib/validations";

describe("Lead Validation", () => {
  const baseFields = [
    { fieldName: "first_name", required: true, fieldType: "text" },
    { fieldName: "email", required: true, fieldType: "email" },
    { fieldName: "phone", required: true, fieldType: "phone" },
  ];

  it("passes valid lead", () => {
    const result = validateLead({
      data: { first_name: "Jane", email: "jane@example.com", phone: "+15551234567" },
      campaignFields: baseFields,
      existingEmails: [],
      existingPhones: [],
    });
    expect(result.passed).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(50);
  });

  it("records duplicate email as passed (handled by fraud module)", () => {
    const result = validateLead({
      data: { first_name: "Jane", email: "jane@example.com", phone: "+15551234567" },
      campaignFields: baseFields,
      existingEmails: ["jane@example.com"],
      existingPhones: [],
    });
    expect(result.passed).toBe(true);
    expect(result.results.some((r) => r.rule === "duplicate_email" && r.passed)).toBe(true);
  });

  it("rejects honeypot", () => {
    const result = validateLead({
      data: { email: "test@example.com" },
      campaignFields: baseFields,
      existingEmails: [],
      existingPhones: [],
      honeypot: "bot",
    });
    expect(result.passed).toBe(false);
    expect(result.score).toBe(0);
  });

  it("rejects invalid email format", () => {
    const result = validateLead({
      data: { first_name: "Jane", email: "not-an-email", phone: "+15551234567" },
      campaignFields: baseFields,
      existingEmails: [],
      existingPhones: [],
    });
    expect(result.results.some((r) => r.rule === "email_format" && !r.passed)).toBe(true);
  });
});

describe("Validation utilities", () => {
  it("validates email", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
    expect(isValidEmail("invalid")).toBe(false);
  });

  it("validates phone", () => {
    expect(isValidPhone("+1 555 123 4567")).toBe(true);
    expect(isValidPhone("123")).toBe(false);
  });
});

describe("adminUpdateStaffUserSchema", () => {
  it("accepts Promotion and Support menu hrefs", () => {
    const result = adminUpdateStaffUserSchema.safeParse({
      menuAccess: ["/admin/promotion", "/admin/support"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.menuAccess).toEqual(["/admin/promotion", "/admin/support"]);
    }
  });

  it("rejects unknown menu hrefs", () => {
    const result = adminUpdateStaffUserSchema.safeParse({
      menuAccess: ["/admin/users"],
    });
    expect(result.success).toBe(false);
  });
});

describe("adminPublisherSmartLinkCampaignsSchema", () => {
  it("accepts restrict off with no campaigns", () => {
    const result = adminPublisherSmartLinkCampaignsSchema.safeParse({
      restrictSmartLinkCampaigns: false,
      campaignIds: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects enabling with an empty campaign list", () => {
    const result = adminPublisherSmartLinkCampaignsSchema.safeParse({
      restrictSmartLinkCampaigns: true,
      campaignIds: [],
    });
    expect(result.success).toBe(false);
  });

  it("accepts restrict on with at least one campaign", () => {
    const result = adminPublisherSmartLinkCampaignsSchema.safeParse({
      restrictSmartLinkCampaigns: true,
      campaignIds: ["camp_a"],
    });
    expect(result.success).toBe(true);
  });
});
