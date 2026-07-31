import { describe, it, expect, afterEach, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  pageTemplateHasThankYouScalars: vi.fn((_client?: unknown) => true),
}));

vi.mock("@/lib/prisma", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/prisma")>();
  return {
    ...actual,
    pageTemplateHasThankYouScalars: (...args: Parameters<typeof actual.pageTemplateHasThankYouScalars>) =>
      prismaMocks.pageTemplateHasThankYouScalars(...args),
  };
});

import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { createBlankCraftState } from "@/modules/page-builder/lib/serialize";
import {
  createOptinFunnelTemplateByAdmin,
  duplicateOptinFunnelTemplateByAdmin,
  updateOptinFunnelTemplateByAdmin,
  deleteOptinFunnelTemplateByAdmin,
  listOptinFunnelTemplatesForAdvertiser,
  listOptinFunnelTemplatesForAdmin,
} from "@/services/optin-funnel.service";

const createdIds: string[] = [];

afterEach(async () => {
  prismaMocks.pageTemplateHasThankYouScalars.mockReturnValue(true);
  while (createdIds.length > 0) {
    const id = createdIds.pop();
    if (!id) continue;
    try {
      await deleteOptinFunnelTemplateByAdmin(id);
    } catch {
      // already removed
    }
  }
});

describe("Admin optin funnel templates", () => {
  it("creates a template with thank-you enabled by default", async () => {
    const created = await createOptinFunnelTemplateByAdmin({ name: "Vitest Admin Template" });
    createdIds.push(created.id);

    expect(created.thankYouEnabled).toBe(true);
    expect(created.category).toBe("optin_funnel");
    expect(created.isSystem).toBe(true);
    expect(created.isPublished).toBe(false);
  });

  it("hides draft templates from advertisers until published", async () => {
    const draft = await createOptinFunnelTemplateByAdmin({ name: "Vitest Draft Visibility" });
    createdIds.push(draft.id);

    const adminList = await listOptinFunnelTemplatesForAdmin();
    expect(adminList.some((t) => t.id === draft.id)).toBe(true);

    let advertiserList = await listOptinFunnelTemplatesForAdvertiser();
    expect(advertiserList.some((t) => t.id === draft.id)).toBe(false);

    const published = await updateOptinFunnelTemplateByAdmin(draft.id, { isPublished: true });
    expect(published.isPublished).toBe(true);

    advertiserList = await listOptinFunnelTemplatesForAdvertiser();
    expect(advertiserList.some((t) => t.id === draft.id)).toBe(true);

    const duplicated = await duplicateOptinFunnelTemplateByAdmin(draft.id);
    createdIds.push(duplicated.id);
    expect(duplicated.isPublished).toBe(false);
  });

  it("duplicates craft and thank-you settings from source template", async () => {
    const source = await createOptinFunnelTemplateByAdmin({
      name: "Vitest Source Template",
      destinationUrl: "https://example.com/thanks",
    });
    createdIds.push(source.id);

    await updateOptinFunnelTemplateByAdmin(source.id, {
      thankYouEnabled: false,
      destinationUrl: "https://example.com/offer",
    });

    const duplicated = await duplicateOptinFunnelTemplateByAdmin(source.id);
    createdIds.push(duplicated.id);

    expect(duplicated.name).toContain("(Copy)");
    expect(duplicated.thankYouEnabled).toBe(false);
    expect(duplicated.destinationUrl).toBe("https://example.com/offer");
  });

  it("allows craft-only PATCH without destination URL", async () => {
    const created = await createOptinFunnelTemplateByAdmin({ name: "Vitest Craft Save" });
    createdIds.push(created.id);

    const updated = await updateOptinFunnelTemplateByAdmin(created.id, {
      craftState: createBlankCraftState(),
      step: "optin",
      autosave: true,
    });

    expect(updated.id).toBe(created.id);
  });

  it("validates destination URL on settings PATCH when thank-you is off", async () => {
    const created = await createOptinFunnelTemplateByAdmin({ name: "Vitest Settings Validation" });
    createdIds.push(created.id);

    await expect(
      updateOptinFunnelTemplateByAdmin(created.id, {
        thankYouEnabled: false,
        destinationUrl: null,
      }),
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Destination URL is required when thank-you redirect is off.",
    } satisfies Partial<AppError>);
  });

  it("stores thank-you settings in themeJson when Prisma scalars are unavailable", async () => {
    prismaMocks.pageTemplateHasThankYouScalars.mockReturnValue(false);

    const created = await createOptinFunnelTemplateByAdmin({
      name: "Vitest JSON Fallback",
      destinationUrl: "https://example.com/json-fallback",
    });
    createdIds.push(created.id);

    expect(created.destinationUrl).toBe("https://example.com/json-fallback");

    const row = await prisma.pageTemplate.findUnique({ where: { id: created.id } });
    const theme = row?.themeJson as { funnelSettings?: { destinationUrl?: string } } | null;
    expect(theme?.funnelSettings?.destinationUrl).toBe("https://example.com/json-fallback");
  });
});
