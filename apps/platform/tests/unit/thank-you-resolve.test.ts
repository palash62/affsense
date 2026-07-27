import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindFirst = vi.fn();
const mockFindUnique = vi.fn();
const mockLeadFindFirst = vi.fn();
const mockVersionFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    advertiserOptinPage: {
      findFirst: (...args: unknown[]) => mockFindFirst(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
    lead: {
      findFirst: (...args: unknown[]) => mockLeadFindFirst(...args),
    },
    optinFunnelVersion: {
      findUnique: (...args: unknown[]) => mockVersionFindUnique(...args),
    },
  },
}));

import { resolveThankYouPageForRequest } from "@/services/optin-funnel.service";

const draftPage = {
  id: "funnel-1",
  slug: "test-funnel-2",
  advertiserId: "adv-1",
  campaignId: null,
  isPublished: false,
  thankYouEnabled: true,
  thankYouCraftState: null,
  thankYouThemeJson: null,
  thankYouPixelHtml: null,
  thankYouUseCampaignPixel: true,
  publishedVersionId: null,
  campaign: null,
};

const publishedPage = {
  ...draftPage,
  isPublished: true,
  campaignId: "camp-1",
  campaign: { status: "ACTIVE", pixelToken: "px_test" },
};

describe("resolveThankYouPageForRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns draft preview for bare slug without lead_id (unpublished test URL)", async () => {
    mockFindFirst.mockResolvedValue(draftPage);

    const result = await resolveThankYouPageForRequest({ slug: "test-funnel-2" });

    expect(result).not.toBeNull();
    expect(result?.slug).toBe("test-funnel-2");
    expect(result?.previewMode).toBe(true);
    expect(result?.leadId).toBeNull();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("returns draft preview when preview=1", async () => {
    mockFindFirst.mockResolvedValue(draftPage);

    const result = await resolveThankYouPageForRequest({
      slug: "test-funnel-2",
      preview: "1",
    });

    expect(result?.previewMode).toBe(true);
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("prefers live payload when lead_id matches published active campaign", async () => {
    mockFindUnique.mockResolvedValue(publishedPage);
    mockLeadFindFirst.mockResolvedValue({ id: "lead-1" });

    const result = await resolveThankYouPageForRequest({
      slug: "test-funnel-2",
      leadId: "lead-1",
    });

    expect(result?.previewMode).toBe(false);
    expect(result?.leadId).toBe("lead-1");
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it("falls back to draft when lead_id is present but public lookup fails", async () => {
    mockFindUnique.mockResolvedValue(draftPage);
    mockFindFirst.mockResolvedValue(draftPage);

    const result = await resolveThankYouPageForRequest({
      slug: "test-funnel-2",
      leadId: "missing-lead",
    });

    expect(result?.previewMode).toBe(true);
    expect(mockFindFirst).toHaveBeenCalled();
  });

  it("returns null when slug does not exist", async () => {
    mockFindFirst.mockResolvedValue(null);

    const result = await resolveThankYouPageForRequest({ slug: "missing-funnel" });

    expect(result).toBeNull();
  });
});
