import {
  prisma,
  isStalePrismaClientError,
  resetPrismaClient,
  pageTemplateHasThankYouScalars,
} from "@/lib/prisma";
import { Errors } from "@/lib/errors";
import { assertVerifiedDomainForAdvertiser } from "@/services/advertiser-domain.service";
import { Prisma } from "@prisma/client";
import { slugifyOptinAddress, isValidOptinSlug } from "@/lib/optin-slug";
import type { OptinTemplateId } from "@/lib/optin-templates";
import {
  DEFAULT_OPTIN_PAGE,
  serializeOptinPage,
} from "@/lib/optin-page";
import {
  buildPublicOptinFunnel,
  serializeOptinFunnel,
  serializePublicOptinFunnel,
  usesBuilderRenderer,
  type PublicThankYouFunnel,
  type SerializedOptinFunnel,
} from "@/lib/optin-funnel";
import {
  createEmptyCraftState,
  createBlankCraftState,
  normalizeCraftState,
  parseStoredCraftState,
  toPrismaJson,
} from "@/modules/page-builder/lib/serialize";
import { extractFormJson } from "@/modules/page-builder/lib/extract-form-json";
import { DEFAULT_THEME, normalizeThemeJson, type ThemeJson } from "@/modules/page-builder/lib/theme";
import type { CraftSerializedState } from "@/modules/page-builder/types/page-document";
import type { FormJson } from "@/modules/page-builder/types/form-field";
import type { OptinFunnelEditorType } from "@prisma/client";
import { sanitizeHtml } from "@/modules/page-builder/lib/sanitize";
import { getActiveCpaOfferById } from "@/services/cpa-offer.service";

export type OptinFunnelOption = {
  id: string;
  name: string;
  title: string;
  slug: string;
  editorType: OptinFunnelEditorType;
  isPublished: boolean;
};

export type OptinFunnelTemplate = {
  id: string;
  slug: string;
  name: string;
  category: string;
  craftState: CraftSerializedState;
  themeJson: ThemeJson;
  thankYouEnabled: boolean;
  destinationUrl: string | null;
  thankYouPixelHtml: string | null;
  thankYouUseCampaignPixel: boolean;
  thankYouCraftState: CraftSerializedState | null;
  thankYouThemeJson: ThemeJson | null;
  isSystem: boolean;
  isPublished: boolean;
  createdAt: string;
};

type AdminTemplateCraftDocument = {
  craft?: CraftSerializedState;
  meta?: { schemaVersion?: number; editorBreakPoint?: string };
  thankYouCraft?: CraftSerializedState;
};

type AdminTemplateThemeDocument = ThemeJson & {
  thankYouThemeJson?: ThemeJson | null;
  funnelSettings?: {
    thankYouEnabled?: boolean;
    destinationUrl?: string | null;
    thankYouPixelHtml?: string | null;
    thankYouUseCampaignPixel?: boolean;
  };
};

type AdminFunnelSettings = {
  thankYouEnabled: boolean;
  destinationUrl: string | null;
  thankYouPixelHtml: string | null;
  thankYouUseCampaignPixel: boolean;
};

function resolveAdminFunnelSettings(template: {
  thankYouEnabled?: boolean;
  destinationUrl?: string | null;
  thankYouPixelHtml?: string | null;
  thankYouUseCampaignPixel?: boolean;
  themeJson: unknown;
}): AdminFunnelSettings {
  const extra =
    template.themeJson && typeof template.themeJson === "object"
      ? (template.themeJson as AdminTemplateThemeDocument)
      : null;
  const fromJson = extra?.funnelSettings;

  return {
    thankYouEnabled: template.thankYouEnabled ?? fromJson?.thankYouEnabled ?? true,
    destinationUrl: template.destinationUrl ?? fromJson?.destinationUrl ?? null,
    thankYouPixelHtml: template.thankYouPixelHtml ?? fromJson?.thankYouPixelHtml ?? null,
    thankYouUseCampaignPixel:
      template.thankYouUseCampaignPixel ?? fromJson?.thankYouUseCampaignPixel ?? true,
  };
}

function buildAdminThemeEnvelope(
  themeJson: ThemeJson,
  thankYouThemeJson: ThemeJson | null | undefined,
  funnelSettings: AdminFunnelSettings,
  persistSettingsInTheme: boolean,
) {
  const envelope: AdminTemplateThemeDocument = {
    ...themeJson,
    ...(thankYouThemeJson ? { thankYouThemeJson } : {}),
  };

  if (persistSettingsInTheme) {
    envelope.funnelSettings = funnelSettings;
  } else if (envelope.funnelSettings) {
    delete envelope.funnelSettings;
  }

  return toPrismaJson(envelope);
}

function buildThankYouScalarFields(funnelSettings: AdminFunnelSettings) {
  if (!pageTemplateHasThankYouScalars()) return {};
  return {
    thankYouEnabled: funnelSettings.thankYouEnabled,
    destinationUrl: funnelSettings.destinationUrl,
    thankYouPixelHtml: funnelSettings.thankYouPixelHtml,
    thankYouUseCampaignPixel: funnelSettings.thankYouUseCampaignPixel,
  };
}

function parseAdminTemplateCraft(raw: unknown): {
  craftState: CraftSerializedState;
  thankYouCraftState: CraftSerializedState | null;
} {
  const parsed = parseStoredCraftState(raw);
  const extra = raw && typeof raw === "object" ? (raw as AdminTemplateCraftDocument) : null;
  return {
    craftState: parsed.craft,
    thankYouCraftState:
      extra?.thankYouCraft && typeof extra.thankYouCraft === "object"
        ? normalizeCraftState(extra.thankYouCraft)
        : null,
  };
}

function parseAdminTemplateTheme(raw: unknown): {
  themeJson: ThemeJson;
  thankYouThemeJson: ThemeJson | null;
} {
  const normalized = normalizeThemeJson(raw);
  const extra = raw && typeof raw === "object" ? (raw as AdminTemplateThemeDocument) : null;
  return {
    themeJson: normalized,
    thankYouThemeJson: extra?.thankYouThemeJson ? normalizeThemeJson(extra.thankYouThemeJson) : null,
  };
}

function serializeAdminTemplate(template: {
  id: string;
  slug: string;
  name: string;
  category: string;
  isSystem: boolean;
  isPublished?: boolean;
  createdAt: Date;
  craftState: unknown;
  themeJson: unknown;
  thankYouEnabled?: boolean;
  destinationUrl?: string | null;
  thankYouPixelHtml?: string | null;
  thankYouUseCampaignPixel?: boolean;
}): OptinFunnelTemplate {
  const parsedCraft = parseAdminTemplateCraft(template.craftState);
  const parsedTheme = parseAdminTemplateTheme(template.themeJson);
  const funnelSettings = resolveAdminFunnelSettings(template);
  return {
    ...parsedCraft,
    ...parsedTheme,
    id: template.id,
    slug: template.slug,
    name: template.name,
    category: template.category,
    thankYouEnabled: funnelSettings.thankYouEnabled,
    destinationUrl: funnelSettings.destinationUrl,
    thankYouPixelHtml: funnelSettings.thankYouPixelHtml,
    thankYouUseCampaignPixel: funnelSettings.thankYouUseCampaignPixel,
    isSystem: template.isSystem,
    isPublished: Boolean(template.isPublished),
    createdAt: template.createdAt.toISOString(),
  };
}

async function withStalePrismaRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (isStalePrismaClientError(error)) {
      resetPrismaClient();
      return await fn();
    }
    throw error;
  }
}

async function createUniqueSlug(advertiserId: string, seed: string, excludeFunnelId?: string) {
  const base = slugifyOptinAddress(seed) || "optin";
  let slug = base;
  let attempt = 0;
  while (true) {
    const existing = await prisma.advertiserOptinPage.findUnique({ where: { slug } });
    if (!existing || existing.id === excludeFunnelId) return slug;
    attempt += 1;
    slug = `${base}-${attempt}`;
  }
}

function syncPublishFlags(isPublished: boolean) {
  return {
    isPublished,
    status: isPublished ? ("PUBLISHED" as const) : ("DRAFT" as const),
  };
}

export async function listOptinFunnels(advertiserId: string) {
  const pages = await prisma.advertiserOptinPage.findMany({
    where: { advertiserId, status: { not: "ARCHIVED" } },
    orderBy: { updatedAt: "desc" },
  });
  return pages.map(serializeOptinFunnel);
}

export async function listOptinFunnelTemplatesForAdvertiser(): Promise<OptinFunnelTemplate[]> {
  const templates = await prisma.pageTemplate.findMany({
    where: { category: "optin_funnel", isSystem: true, isPublished: true },
    orderBy: { createdAt: "desc" },
  });

  return templates.map(serializeAdminTemplate);
}

export async function listOptinFunnelTemplatesForAdmin(): Promise<OptinFunnelTemplate[]> {
  const templates = await prisma.pageTemplate.findMany({
    where: { category: "optin_funnel", isSystem: true },
    orderBy: { createdAt: "desc" },
  });

  return templates.map(serializeAdminTemplate);
}

export async function createOptinFunnelTemplateByAdmin(input: {
  name: string;
  primaryColor?: string;
  secondaryColor?: string;
  sourceTemplateId?: string;
  thankYouEnabled?: boolean;
  destinationUrl?: string | null;
  thankYouPixelHtml?: string | null;
  thankYouUseCampaignPixel?: boolean;
  isPublished?: boolean;
}) {
  const name = input.name.trim().slice(0, 80);
  if (name.length < 2) {
    throw Errors.validation("Template name must be at least 2 characters.");
  }
  const slugBase = slugifyOptinAddress(name) || "optin-template";
  let slug = `optin-template-${slugBase}`;
  let suffix = 1;

  while (await prisma.pageTemplate.findUnique({ where: { slug } })) {
    slug = `optin-template-${slugBase}-${suffix}`;
    suffix += 1;
  }

  let craftState = createBlankCraftState();
  let thankYouCraftState: CraftSerializedState | null = null;
  let themeJson: ThemeJson = {
    ...DEFAULT_THEME,
    ...(input.primaryColor ? { primaryColor: input.primaryColor } : {}),
    ...(input.secondaryColor ? { secondaryColor: input.secondaryColor } : {}),
  };
  let thankYouThemeJson: ThemeJson | null = null;
  let thankYouEnabled = input.thankYouEnabled ?? true;
  let destinationUrl = input.destinationUrl?.trim() || null;
  let thankYouPixelHtml = input.thankYouPixelHtml?.trim() || null;
  let thankYouUseCampaignPixel = input.thankYouUseCampaignPixel ?? true;

  if (input.sourceTemplateId) {
    const source = await prisma.pageTemplate.findFirst({
      where: { id: input.sourceTemplateId, category: "optin_funnel", isSystem: true },
    });
    if (source) {
      const sourceCraft = parseAdminTemplateCraft(source.craftState);
      const sourceTheme = parseAdminTemplateTheme(source.themeJson);
      const sourceSettings = resolveAdminFunnelSettings(source);
      craftState = sourceCraft.craftState;
      thankYouCraftState = sourceCraft.thankYouCraftState;
      themeJson = sourceTheme.themeJson ?? themeJson;
      thankYouThemeJson = sourceTheme.thankYouThemeJson;
      thankYouEnabled = sourceSettings.thankYouEnabled;
      destinationUrl = sourceSettings.destinationUrl;
      thankYouPixelHtml = sourceSettings.thankYouPixelHtml;
      thankYouUseCampaignPixel = sourceSettings.thankYouUseCampaignPixel;
    }
  }

  const funnelSettings: AdminFunnelSettings = {
    thankYouEnabled,
    destinationUrl,
    thankYouPixelHtml,
    thankYouUseCampaignPixel,
  };
  const persistSettingsInTheme = !pageTemplateHasThankYouScalars();

  const created = await withStalePrismaRetry(() =>
    prisma.pageTemplate.create({
      data: {
        slug,
        name,
        category: "optin_funnel",
        craftState: toPrismaJson({
          craft: normalizeCraftState(craftState),
          meta: { schemaVersion: 1, editorBreakPoint: "desktop" },
          thankYouCraft: thankYouCraftState ? normalizeCraftState(thankYouCraftState) : undefined,
        }),
        themeJson: buildAdminThemeEnvelope(
          themeJson,
          thankYouThemeJson,
          funnelSettings,
          persistSettingsInTheme,
        ),
        ...buildThankYouScalarFields(funnelSettings),
        isSystem: true,
        isPublished: input.isPublished ?? false,
        advertiserId: null,
      },
    }),
  );

  return serializeAdminTemplate(created);
}

export async function getOptinFunnelTemplateByAdmin(id: string): Promise<OptinFunnelTemplate> {
  const template = await prisma.pageTemplate.findFirst({
    where: { id, category: "optin_funnel", isSystem: true },
  });
  if (!template) throw Errors.notFound("Funnel template");

  return serializeAdminTemplate(template);
}

export async function duplicateOptinFunnelTemplateByAdmin(id: string): Promise<OptinFunnelTemplate> {
  const source = await prisma.pageTemplate.findFirst({
    where: { id, category: "optin_funnel", isSystem: true },
  });
  if (!source) throw Errors.notFound("Funnel template");

  const copyName = `${source.name} (Copy)`.trim().slice(0, 80);
  return createOptinFunnelTemplateByAdmin({
    name: copyName.length >= 2 ? copyName : "Template (Copy)",
    sourceTemplateId: id,
  });
}

export async function updateOptinFunnelTemplateByAdmin(
  id: string,
  input: {
    name?: string;
    craftState?: CraftSerializedState;
    themeJson?: ThemeJson;
    thankYouCraftState?: CraftSerializedState | null;
    thankYouThemeJson?: ThemeJson;
    thankYouEnabled?: boolean;
    destinationUrl?: string | null;
    thankYouPixelHtml?: string | null;
    thankYouUseCampaignPixel?: boolean;
    step?: "optin" | "thankYou";
    autosave?: boolean;
    isPublished?: boolean;
  },
) {
  const existing = await prisma.pageTemplate.findFirst({
    where: { id, category: "optin_funnel", isSystem: true },
  });
  if (!existing) throw Errors.notFound("Funnel template");

  const existingSettings = resolveAdminFunnelSettings(existing);
  const nextFunnelSettings: AdminFunnelSettings = {
    thankYouEnabled:
      input.thankYouEnabled !== undefined ? input.thankYouEnabled : existingSettings.thankYouEnabled,
    destinationUrl:
      input.destinationUrl !== undefined
        ? input.destinationUrl?.trim() || null
        : existingSettings.destinationUrl,
    thankYouPixelHtml:
      input.thankYouPixelHtml !== undefined
        ? input.thankYouPixelHtml
          ? sanitizeHtml(input.thankYouPixelHtml.trim())
          : null
        : existingSettings.thankYouPixelHtml,
    thankYouUseCampaignPixel:
      input.thankYouUseCampaignPixel !== undefined
        ? input.thankYouUseCampaignPixel
        : existingSettings.thankYouUseCampaignPixel,
  };
  const persistSettingsInTheme = !pageTemplateHasThankYouScalars();

  const isSettingsPatch =
    input.thankYouEnabled !== undefined ||
    input.destinationUrl !== undefined ||
    input.thankYouPixelHtml !== undefined ||
    input.thankYouUseCampaignPixel !== undefined;

  if (isSettingsPatch) {
    if (!nextFunnelSettings.thankYouEnabled && !nextFunnelSettings.destinationUrl) {
      throw Errors.validation("Destination URL is required when thank-you redirect is off.");
    }
    if (!nextFunnelSettings.thankYouEnabled && nextFunnelSettings.destinationUrl) {
      try {
        const parsed = new URL(nextFunnelSettings.destinationUrl);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
          throw new Error("invalid");
        }
      } catch {
        throw Errors.validation("Enter a valid destination URL (https://...).");
      }
    }
  }

  const craftEnvelope = input.craftState
    ? {
        craft: normalizeCraftState(input.craftState),
        meta: { schemaVersion: 1 as const, editorBreakPoint: "desktop" as const },
      }
    : undefined;
  const currentParsedCraft = parseAdminTemplateCraft(existing.craftState);
  const nextThankYouCraft =
    input.thankYouCraftState === null
      ? null
      : input.thankYouCraftState
        ? normalizeCraftState(input.thankYouCraftState)
        : currentParsedCraft.thankYouCraftState;
  const nextCraftEnvelope =
    craftEnvelope || nextThankYouCraft !== currentParsedCraft.thankYouCraftState
      ? toPrismaJson({
          craft: craftEnvelope?.craft ?? currentParsedCraft.craftState,
          meta: craftEnvelope?.meta ?? { schemaVersion: 1 as const, editorBreakPoint: "desktop" as const },
          ...(nextThankYouCraft ? { thankYouCraft: nextThankYouCraft } : {}),
        })
      : undefined;

  const currentParsedTheme = parseAdminTemplateTheme(existing.themeJson);
  const nextTheme = input.themeJson ?? currentParsedTheme.themeJson;
  const nextThankYouTheme = input.thankYouThemeJson ?? currentParsedTheme.thankYouThemeJson;
  let nextThemeJsonEnvelope =
    input.themeJson || input.thankYouThemeJson
      ? buildAdminThemeEnvelope(
          nextTheme,
          nextThankYouTheme,
          nextFunnelSettings,
          persistSettingsInTheme,
        )
      : undefined;

  if (isSettingsPatch && persistSettingsInTheme) {
    nextThemeJsonEnvelope = buildAdminThemeEnvelope(
      nextTheme,
      nextThankYouTheme,
      nextFunnelSettings,
      true,
    );
  }

  const updated = await withStalePrismaRetry(() =>
    prisma.pageTemplate.update({
      where: { id },
      data: {
        ...(input.name ? { name: input.name.trim() } : {}),
        ...(nextCraftEnvelope ? { craftState: nextCraftEnvelope } : {}),
        ...(nextThemeJsonEnvelope ? { themeJson: nextThemeJsonEnvelope } : {}),
        ...(isSettingsPatch ? buildThankYouScalarFields(nextFunnelSettings) : {}),
        ...(input.isPublished !== undefined ? { isPublished: input.isPublished } : {}),
      },
    }),
  );

  return serializeAdminTemplate(updated);
}

export async function deleteOptinFunnelTemplateByAdmin(id: string) {
  const template = await prisma.pageTemplate.findFirst({
    where: { id, category: "optin_funnel", isSystem: true },
  });
  if (!template) throw Errors.notFound("Funnel template");

  await prisma.pageTemplate.delete({ where: { id } });
  return { deleted: true };
}

export async function getOptinFunnel(id: string, advertiserId: string) {
  const page = await prisma.advertiserOptinPage.findFirst({
    where: { id, advertiserId },
    include: {
      customDomain: { select: { id: true, domain: true, status: true } },
    },
  });
  if (!page) throw Errors.notFound("Optin funnel");
  return serializeOptinFunnel(page);
}

export async function listOptinFunnelOptions(advertiserId: string): Promise<OptinFunnelOption[]> {
  const pages = await prisma.advertiserOptinPage.findMany({
    where: { advertiserId, status: { not: "ARCHIVED" } },
    select: {
      id: true,
      name: true,
      title: true,
      slug: true,
      editorType: true,
      isPublished: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  return pages.map((page) => ({
    id: page.id,
    name: page.name,
    title: page.title,
    slug: page.slug,
    editorType: page.editorType,
    isPublished: page.isPublished,
  }));
}

export async function createOptinFunnel(
  advertiserId: string,
  input: {
    name: string;
    editorType: OptinFunnelEditorType;
    templateId?: string;
    pageTemplateId?: string;
  },
) {
  const slug = await createUniqueSlug(advertiserId, input.name);
  const user = await prisma.user.findUnique({
    where: { id: advertiserId },
    select: { advertiserProfile: { select: { company: true } }, name: true },
  });

  let craftState: CraftSerializedState = createEmptyCraftState();
  let themeJson: ThemeJson = DEFAULT_THEME;
  let thankYouEnabled = false;
  let destinationUrl: string | null = null;
  let thankYouCraftState: CraftSerializedState | null = null;
  let thankYouThemeJson: ThemeJson = DEFAULT_THEME;
  let thankYouPixelHtml: string | null = null;
  let thankYouUseCampaignPixel = true;
  let templateId: string | undefined;
  let templateName: string | undefined;

  const selectedTemplateId = input.pageTemplateId ?? input.templateId;
  if (selectedTemplateId) {
    const pageTemplate = await prisma.pageTemplate.findFirst({
      where: {
        id: selectedTemplateId,
        category: "optin_funnel",
        isSystem: true,
        isPublished: true,
      },
    });
    if (!pageTemplate) {
      throw Errors.notFound("Funnel template");
    }
    templateId = pageTemplate.id;
    templateName = pageTemplate.name;
    const templateCraft = parseAdminTemplateCraft(pageTemplate.craftState);
    const templateTheme = parseAdminTemplateTheme(pageTemplate.themeJson);
    craftState = templateCraft.craftState;
    themeJson = templateTheme.themeJson ?? DEFAULT_THEME;
    thankYouEnabled = pageTemplate.thankYouEnabled;
    destinationUrl = pageTemplate.destinationUrl?.trim() || null;
    thankYouCraftState = templateCraft.thankYouCraftState;
    thankYouThemeJson = templateTheme.thankYouThemeJson ?? templateTheme.themeJson ?? themeJson;
    thankYouPixelHtml = pageTemplate.thankYouPixelHtml?.trim() || null;
    thankYouUseCampaignPixel = pageTemplate.thankYouUseCampaignPixel;
  }

  const title =
    input.name.trim() ||
    templateName ||
    user?.advertiserProfile?.company ||
    "New Optin Funnel";

  const page = await prisma.advertiserOptinPage.create({
    data: {
      advertiserId,
      slug,
      name: title,
      title,
      editorType: "BUILDER",
      templateId: templateId,
      headline: DEFAULT_OPTIN_PAGE.headline,
      subheadline: DEFAULT_OPTIN_PAGE.subheadline,
      description: DEFAULT_OPTIN_PAGE.description,
      ctaText: DEFAULT_OPTIN_PAGE.ctaText,
      successTitle: DEFAULT_OPTIN_PAGE.successTitle,
      successMessage: DEFAULT_OPTIN_PAGE.successMessage,
      badgeText: null,
      bulletPoints: DEFAULT_OPTIN_PAGE.bulletPoints,
      primaryColor: themeJson.primaryColor ?? DEFAULT_OPTIN_PAGE.primaryColor,
      accentColor: themeJson.secondaryColor ?? DEFAULT_OPTIN_PAGE.accentColor,
      craftState: toPrismaJson({
        craft: normalizeCraftState(craftState),
        meta: { schemaVersion: 1, editorBreakPoint: "desktop" },
      }),
      themeJson: toPrismaJson(themeJson),
      thankYouEnabled,
      destinationUrl,
      thankYouCraftState: thankYouCraftState
        ? toPrismaJson({
            craft: normalizeCraftState(thankYouCraftState),
            meta: { schemaVersion: 1, editorBreakPoint: "desktop" },
          })
        : undefined,
      thankYouThemeJson: toPrismaJson(thankYouThemeJson),
      thankYouPixelHtml,
      thankYouUseCampaignPixel,
    },
  });

  return serializeOptinFunnel(page);
}

async function getNextVersionNumber(funnelId: string) {
  const latest = await prisma.optinFunnelVersion.findFirst({
    where: { funnelId },
    orderBy: { versionNumber: "desc" },
  });
  return (latest?.versionNumber ?? 0) + 1;
}

export async function createFunnelVersionSnapshot(
  funnelId: string,
  createdById: string,
  input: {
    craftState: CraftSerializedState;
    themeJson: ThemeJson;
    formJson: FormJson | null;
    thankYouCraftState?: CraftSerializedState | null;
    thankYouThemeJson?: ThemeJson | null;
    label: string;
  },
) {
  const versionNumber = await getNextVersionNumber(funnelId);
  return prisma.optinFunnelVersion.create({
    data: {
      funnelId,
      versionNumber,
      label: input.label,
      craftState: toPrismaJson(input.craftState),
      themeJson: toPrismaJson(input.themeJson),
      formJson: input.formJson ? toPrismaJson(input.formJson) : undefined,
      thankYouCraftState: input.thankYouCraftState
        ? toPrismaJson(input.thankYouCraftState)
        : undefined,
      thankYouThemeJson: input.thankYouThemeJson
        ? toPrismaJson(input.thankYouThemeJson)
        : undefined,
      createdById,
    },
  });
}

export async function updateOptinFunnel(
  id: string,
  advertiserId: string,
  input: {
    name?: string;
    title?: string;
    slug?: string;
    campaignId?: string | null;
    destinationUrl?: string | null;
    cpaOfferId?: string | null;
    templateId?: OptinTemplateId;
    headline?: string;
    subheadline?: string;
    description?: string | null;
    ctaText?: string;
    successTitle?: string;
    successMessage?: string;
    badgeText?: string | null;
    bulletPoints?: string[];
    primaryColor?: string;
    accentColor?: string;
    isPublished?: boolean;
    craftState?: CraftSerializedState;
    themeJson?: ThemeJson;
    thankYouEnabled?: boolean;
    thankYouCraftState?: CraftSerializedState | null;
    thankYouThemeJson?: ThemeJson;
    thankYouPixelHtml?: string | null;
    thankYouUseCampaignPixel?: boolean;
    customDomainId?: string | null;
    step?: "optin" | "thankYou";
    autosave?: boolean;
  },
) {
  const existing = await prisma.advertiserOptinPage.findFirst({ where: { id, advertiserId } });
  if (!existing) throw Errors.notFound("Optin funnel");

  const nextThankYouEnabled =
    input.thankYouEnabled !== undefined ? input.thankYouEnabled : existing.thankYouEnabled;

  let nextDestinationUrl =
    input.destinationUrl !== undefined
      ? input.destinationUrl?.trim() || null
      : existing.destinationUrl?.trim() || null;
  let nextCpaOfferId =
    input.cpaOfferId !== undefined ? input.cpaOfferId?.trim() || null : existing.cpaOfferId ?? null;

  if (input.cpaOfferId !== undefined && nextCpaOfferId) {
    try {
      await getActiveCpaOfferById(nextCpaOfferId);
    } catch {
      throw Errors.validation("Selected CPA offer is invalid or not active.");
    }
    nextDestinationUrl = null;
  } else if (input.destinationUrl !== undefined && nextDestinationUrl) {
    nextCpaOfferId = null;
  }

  if (!nextThankYouEnabled && !nextDestinationUrl && !nextCpaOfferId) {
    throw Errors.validation(
      "Enter a destination URL or select a CPA offer when thank-you redirect is off.",
    );
  }
  if (!nextThankYouEnabled && nextDestinationUrl) {
    try {
      const parsed = new URL(nextDestinationUrl);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error("invalid");
      }
    } catch {
      throw Errors.validation("Enter a valid destination URL (https://...).");
    }
  }

  if (input.campaignId !== undefined && input.campaignId !== null) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: input.campaignId, advertiserId },
      select: { id: true },
    });
    if (!campaign) {
      throw Errors.validation("Selected campaign is invalid for this advertiser.");
    }
  }

  let nextCustomDomainId = existing.customDomainId;
  if (input.customDomainId !== undefined) {
    if (input.customDomainId === null) {
      nextCustomDomainId = null;
    } else {
      const domain = await assertVerifiedDomainForAdvertiser(advertiserId, input.customDomainId);
      nextCustomDomainId = domain?.id ?? null;
      if (domain) {
        await prisma.advertiserOptinPage.updateMany({
          where: {
            advertiserId,
            customDomainId: domain.id,
            NOT: { id },
          },
          data: { customDomainId: null },
        });
      }
    }
  }

  let slug = existing.slug;
  if (input.slug) {
    slug = slugifyOptinAddress(input.slug);
    if (!isValidOptinSlug(slug)) {
      throw Errors.validation("Slug must be at least 2 characters, lowercase letters, numbers, or hyphens.");
    }
    const taken = await prisma.advertiserOptinPage.findUnique({ where: { slug } });
    if (taken && taken.id !== id) {
      throw Errors.validation("This page address is already taken.");
    }
  }

  const campaignId = input.campaignId !== undefined ? input.campaignId : existing.campaignId;
  let formJson: FormJson | null = (existing.formJson as FormJson | null) ?? null;

  if (input.craftState && campaignId) {
    formJson = extractFormJson(input.craftState, campaignId);
  } else if (input.craftState) {
    formJson = extractFormJson(input.craftState, existing.campaignId ?? "");
  }

  const craftEnvelope = input.craftState
    ? toPrismaJson({
        craft: normalizeCraftState(input.craftState),
        meta: { schemaVersion: 1 as const, editorBreakPoint: "desktop" as const },
      })
    : undefined;

  const clearThankYouCraft = input.thankYouCraftState === null;
  const thankYouCraftEnvelope =
    input.thankYouCraftState && !clearThankYouCraft
      ? toPrismaJson({
          craft: normalizeCraftState(input.thankYouCraftState),
          meta: { schemaVersion: 1 as const, editorBreakPoint: "desktop" as const },
        })
      : undefined;

  const publishFlags =
    input.isPublished !== undefined ? syncPublishFlags(input.isPublished) : {};

  const page = await prisma.advertiserOptinPage.update({
    where: { id },
    data: {
      ...(input.name ? { name: input.name.trim(), title: input.name.trim() } : {}),
      ...(input.title ? { title: input.title.trim() } : {}),
      slug,
      ...(input.campaignId !== undefined ? { campaignId: input.campaignId } : {}),
      ...(input.customDomainId !== undefined ? { customDomainId: nextCustomDomainId } : {}),
      ...(input.destinationUrl !== undefined || input.cpaOfferId !== undefined
        ? {
            destinationUrl: nextDestinationUrl,
            cpaOfferId: nextCpaOfferId,
          }
        : {}),
      ...(input.templateId ? { templateId: input.templateId } : {}),
      ...(input.headline ? { headline: input.headline.trim() } : {}),
      ...(input.subheadline ? { subheadline: input.subheadline.trim() } : {}),
      ...(input.description !== undefined
        ? { description: input.description?.trim() || null }
        : {}),
      ...(input.ctaText ? { ctaText: input.ctaText.trim() } : {}),
      ...(input.successTitle ? { successTitle: input.successTitle.trim() } : {}),
      ...(input.successMessage ? { successMessage: input.successMessage.trim() } : {}),
      ...(input.badgeText !== undefined ? { badgeText: input.badgeText?.trim() || null } : {}),
      ...(input.bulletPoints ? { bulletPoints: input.bulletPoints } : {}),
      ...(input.primaryColor ? { primaryColor: input.primaryColor } : {}),
      ...(input.accentColor ? { accentColor: input.accentColor } : {}),
      ...publishFlags,
      ...(craftEnvelope ? { craftState: craftEnvelope } : {}),
      ...(input.themeJson ? { themeJson: toPrismaJson(input.themeJson) } : {}),
      ...(formJson !== undefined ? { formJson: formJson ? toPrismaJson(formJson) : undefined } : {}),
      ...(input.thankYouEnabled !== undefined ? { thankYouEnabled: input.thankYouEnabled } : {}),
      ...(clearThankYouCraft
        ? { thankYouCraftState: Prisma.DbNull }
        : thankYouCraftEnvelope
          ? { thankYouCraftState: thankYouCraftEnvelope }
          : {}),
      ...(input.thankYouThemeJson ? { thankYouThemeJson: toPrismaJson(input.thankYouThemeJson) } : {}),
      ...(input.thankYouPixelHtml !== undefined
        ? { thankYouPixelHtml: input.thankYouPixelHtml ? sanitizeHtml(input.thankYouPixelHtml) : null }
        : {}),
      ...(input.thankYouUseCampaignPixel !== undefined
        ? { thankYouUseCampaignPixel: input.thankYouUseCampaignPixel }
        : {}),
      ...(craftEnvelope || thankYouCraftEnvelope ? { editorType: "BUILDER" as const } : {}),
      autosaveAt: new Date(),
    },
    include: {
      customDomain: { select: { id: true, domain: true, status: true } },
    },
  });

  const isAutosave = Boolean(input.autosave);
  const shouldSnapshot = !isAutosave || (await prisma.optinFunnelVersion.count({ where: { funnelId: id } })) === 0;

  if (shouldSnapshot) {
    if (input.step === "thankYou" && input.thankYouCraftState) {
      await createFunnelVersionSnapshot(id, advertiserId, {
        craftState: parseStoredCraftState(page.craftState).craft,
        themeJson: (page.themeJson as ThemeJson) ?? DEFAULT_THEME,
        formJson,
        thankYouCraftState: input.thankYouCraftState,
        thankYouThemeJson: (input.thankYouThemeJson ?? page.thankYouThemeJson) as ThemeJson,
        label: isAutosave ? "Initial autosave" : "Thank you save",
      });
    } else if (input.craftState) {
      await createFunnelVersionSnapshot(id, advertiserId, {
        craftState: input.craftState,
        themeJson: (input.themeJson ?? page.themeJson) as ThemeJson,
        formJson,
        thankYouCraftState: input.thankYouCraftState ?? null,
        thankYouThemeJson: (input.thankYouThemeJson ?? page.thankYouThemeJson) as ThemeJson,
        label: isAutosave ? "Initial autosave" : "Manual save",
      });
    }
  }

  return serializeOptinFunnel(page);
}

export async function listFunnelVersions(funnelId: string, advertiserId: string) {
  await getOptinFunnel(funnelId, advertiserId);
  return prisma.optinFunnelVersion.findMany({
    where: { funnelId },
    orderBy: { versionNumber: "desc" },
    select: {
      id: true,
      versionNumber: true,
      label: true,
      createdAt: true,
      createdById: true,
    },
  });
}

export async function restoreFunnelVersion(
  funnelId: string,
  versionId: string,
  advertiserId: string,
) {
  await getOptinFunnel(funnelId, advertiserId);
  const version = await prisma.optinFunnelVersion.findFirst({
    where: { id: versionId, funnelId },
  });
  if (!version) throw Errors.notFound("Version");

  const craft = parseStoredCraftState(version.craftState).craft;
  const theme = (version.themeJson as ThemeJson) ?? DEFAULT_THEME;
  const formJson = version.formJson as FormJson | null;
  const thankYouCraft = version.thankYouCraftState
    ? parseStoredCraftState(version.thankYouCraftState).craft
    : null;
  const thankYouTheme = (version.thankYouThemeJson as ThemeJson) ?? DEFAULT_THEME;

  await prisma.advertiserOptinPage.update({
    where: { id: funnelId },
    data: {
      craftState: toPrismaJson({
        craft: normalizeCraftState(craft),
        meta: { schemaVersion: 1, editorBreakPoint: "desktop" },
      }),
      themeJson: toPrismaJson(theme),
      formJson: formJson ? toPrismaJson(formJson) : undefined,
      ...(thankYouCraft
        ? {
            thankYouCraftState: toPrismaJson({
              craft: normalizeCraftState(thankYouCraft),
              meta: { schemaVersion: 1, editorBreakPoint: "desktop" },
            }),
          }
        : {}),
      thankYouThemeJson: toPrismaJson(thankYouTheme),
      autosaveAt: new Date(),
    },
  });

  await createFunnelVersionSnapshot(funnelId, advertiserId, {
    craftState: craft,
    themeJson: theme,
    formJson,
    thankYouCraftState: thankYouCraft,
    thankYouThemeJson: thankYouTheme,
    label: "Restored",
  });

  return { restored: true };
}

export async function deleteOptinFunnel(id: string, advertiserId: string) {
  const page = await prisma.advertiserOptinPage.findFirst({ where: { id, advertiserId } });
  if (!page) throw Errors.notFound("Optin funnel");
  await prisma.advertiserOptinPage.update({
    where: { id },
    data: { status: "ARCHIVED", isPublished: false },
  });
}

export async function duplicateOptinFunnel(id: string, advertiserId: string) {
  const page = await prisma.advertiserOptinPage.findFirst({ where: { id, advertiserId } });
  if (!page) throw Errors.notFound("Optin funnel");
  const slug = await createUniqueSlug(advertiserId, `${page.slug}-copy`);
  const copy = await prisma.advertiserOptinPage.create({
    data: {
      advertiserId,
      slug,
      name: `${page.name} (Copy)`,
      title: `${page.title} (Copy)`,
      editorType: page.editorType,
      destinationUrl: page.destinationUrl,
      cpaOfferId: page.cpaOfferId,
      campaignId: page.campaignId,
      templateId: page.templateId,
      headline: page.headline,
      subheadline: page.subheadline,
      description: page.description,
      ctaText: page.ctaText,
      successTitle: page.successTitle,
      successMessage: page.successMessage,
      badgeText: page.badgeText,
      bulletPoints: page.bulletPoints as object,
      primaryColor: page.primaryColor,
      accentColor: page.accentColor,
      craftState: page.craftState ? (page.craftState as object) : undefined,
      themeJson: page.themeJson ? (page.themeJson as object) : undefined,
      formJson: page.formJson ? (page.formJson as object) : undefined,
      thankYouEnabled: page.thankYouEnabled,
      thankYouCraftState: page.thankYouCraftState ? (page.thankYouCraftState as object) : undefined,
      thankYouThemeJson: page.thankYouThemeJson ? (page.thankYouThemeJson as object) : undefined,
      thankYouPixelHtml: page.thankYouPixelHtml,
      thankYouUseCampaignPixel: page.thankYouUseCampaignPixel,
      status: "DRAFT",
      isPublished: false,
    },
  });
  return serializeOptinFunnel(copy);
}

export async function publishOptinFunnel(id: string, advertiserId: string) {
  const page = await prisma.advertiserOptinPage.findFirst({
    where: { id, advertiserId },
  });
  if (!page) throw Errors.notFound("Optin funnel");

  // Campaign is linked when the advertiser creates/attaches a campaign — not required to publish the funnel.
  if (!page.thankYouEnabled && !page.destinationUrl?.trim() && !page.cpaOfferId) {
    throw Errors.validation(
      "Set a destination URL, select a CPA offer, or enable thank-you redirect in funnel settings before publishing.",
    );
  }

  if (usesBuilderRenderer({ editorType: page.editorType, craftState: parseStoredCraftState(page.craftState) })) {
    const doc = parseStoredCraftState(page.craftState);
    const formJson = extractFormJson(doc.craft, page.campaignId ?? "");
    if (!formJson?.fields.length) {
      throw Errors.validation("Add at least one form field before publishing.");
    }

    const thankYouDoc = page.thankYouEnabled && page.thankYouCraftState
      ? parseStoredCraftState(page.thankYouCraftState).craft
      : null;

    const version = await createFunnelVersionSnapshot(id, advertiserId, {
      craftState: doc.craft,
      themeJson: (page.themeJson as ThemeJson) ?? DEFAULT_THEME,
      formJson,
      thankYouCraftState: thankYouDoc,
      thankYouThemeJson: (page.thankYouThemeJson as ThemeJson) ?? DEFAULT_THEME,
      label: "Published",
    });

    const updated = await prisma.advertiserOptinPage.update({
      where: { id },
      data: {
        editorType: "BUILDER",
        status: "PUBLISHED",
        isPublished: true,
        publishedVersionId: version.id,
        formJson,
      },
    });
    return serializeOptinFunnel(updated);
  }

  const updated = await prisma.advertiserOptinPage.update({
    where: { id },
    data: { status: "PUBLISHED", isPublished: true },
  });
  return serializeOptinFunnel(updated);
}

export async function getPublishedBuilderFunnel(slug: string) {
  const page = await prisma.advertiserOptinPage.findUnique({
    where: { slug },
    include: {
      publishedVersion: true,
      campaign: { include: { fields: { orderBy: { sortOrder: "asc" } } } },
    },
  });

  if (!page || page.status !== "PUBLISHED" || !page.publishedVersion) {
    return null;
  }

  const publishedCraft = parseStoredCraftState(page.publishedVersion.craftState);

  if (!usesBuilderRenderer({ editorType: page.editorType, craftState: publishedCraft })) {
    return null;
  }

  const doc = publishedCraft;
  const thankYouDoc = page.thankYouEnabled && page.publishedVersion.thankYouCraftState
    ? parseStoredCraftState(page.publishedVersion.thankYouCraftState)
    : null;

  return {
    funnel: serializeOptinFunnel(page),
    slug: page.slug,
    campaignId: page.campaignId,
    craftState: doc.craft,
    themeJson: (page.publishedVersion.themeJson as ThemeJson) ?? DEFAULT_THEME,
    formJson: page.publishedVersion.formJson as FormJson | null,
    thankYouCraftState: thankYouDoc?.craft ?? null,
    thankYouThemeJson: (page.publishedVersion.thankYouThemeJson as ThemeJson) ?? DEFAULT_THEME,
    pixelToken: page.campaign?.pixelToken ?? null,
  };
}

export async function getPublicOptinFunnel(slug: string) {
  const page = await prisma.advertiserOptinPage.findUnique({
    where: { slug },
    include: {
      campaign: {
        include: { fields: { orderBy: { sortOrder: "asc" } } },
      },
    },
  });

  if (!page?.isPublished) {
    return null;
  }

  // Published funnel pages are viewable without a campaign; lead submit still requires
  // an ACTIVE campaign (linked when creating the campaign).
  if (page.campaign) {
    return serializePublicOptinFunnel({
      ...page,
      campaign: {
        name: page.campaign.name,
        pixelToken: page.campaign.pixelToken,
        fields: page.campaign.fields,
      },
    });
  }

  return buildPublicOptinFunnel(page, null);
}

export async function getAdvertiserOptinFunnelPreview(slug: string, advertiserId: string) {
  const page = await prisma.advertiserOptinPage.findFirst({
    where: { slug, advertiserId },
    include: {
      campaign: { include: { fields: { orderBy: { sortOrder: "asc" } } } },
    },
  });
  if (!page) return null;
  return buildPublicOptinFunnel(page, page.campaign, { previewMode: true });
}

export async function getOptinFunnelPreviewBySlug(slug: string) {
  const page = await prisma.advertiserOptinPage.findFirst({
    where: { slug },
    include: {
      campaign: { include: { fields: { orderBy: { sortOrder: "asc" } } } },
    },
  });
  if (!page) return null;
  return buildPublicOptinFunnel(page, page.campaign, { previewMode: true });
}

function buildThankYouFunnelPayload(
  page: {
    id: string;
    slug: string;
    advertiserId: string;
    campaignId: string | null;
    thankYouCraftState: unknown;
    thankYouThemeJson: unknown;
    thankYouPixelHtml: string | null;
    thankYouUseCampaignPixel: boolean;
    campaign: { pixelToken: string | null } | null;
  },
  options: { leadId: string | null; previewMode: boolean },
): PublicThankYouFunnel {
  return {
    funnelId: page.id,
    slug: page.slug,
    campaignId: page.campaignId ?? "",
    advertiserId: page.advertiserId,
    pixelToken: page.campaign?.pixelToken ?? null,
    thankYouUseCampaignPixel: page.thankYouUseCampaignPixel,
    thankYouPixelHtml: page.thankYouPixelHtml,
    thankYouCraftState: page.thankYouCraftState
      ? parseStoredCraftState(page.thankYouCraftState)
      : null,
    thankYouThemeJson: (page.thankYouThemeJson as ThemeJson) ?? DEFAULT_THEME,
    leadId: options.leadId,
    previewMode: options.previewMode,
  };
}

export async function getAdvertiserThankYouFunnelPreview(
  slug: string,
  advertiserId: string,
): Promise<PublicThankYouFunnel | null> {
  const page = await prisma.advertiserOptinPage.findFirst({
    where: { slug, advertiserId },
    include: { campaign: true },
  });
  if (!page) return null;

  return buildThankYouFunnelPayload(page, {
    leadId: null,
    previewMode: true,
  });
}

export async function getThankYouFunnelPreviewBySlug(
  slug: string,
): Promise<PublicThankYouFunnel | null> {
  const page = await prisma.advertiserOptinPage.findFirst({
    where: { slug },
    include: { campaign: true },
  });
  if (!page) return null;

  return buildThankYouFunnelPayload(page, {
    leadId: null,
    previewMode: true,
  });
}

/**
 * Resolve thank-you page for a public request.
 * Prefer live lead-aware payload when possible; otherwise fall back to draft
 * preview so unpublished URLs remain testable without preview=1 / lead_id.
 */
export async function resolveThankYouPageForRequest(input: {
  slug: string;
  leadId?: string | null;
  preview?: string | null;
}): Promise<PublicThankYouFunnel | null> {
  if (input.preview === "1") {
    return getThankYouFunnelPreviewBySlug(input.slug);
  }

  if (input.leadId) {
    const live = await getPublicThankYouFunnel(input.slug, input.leadId);
    if (live) return live;
  }

  return getThankYouFunnelPreviewBySlug(input.slug);
}

export async function getPublicThankYouFunnel(
  slug: string,
  leadId: string,
): Promise<PublicThankYouFunnel | null> {
  const page = await prisma.advertiserOptinPage.findUnique({
    where: { slug },
    include: { campaign: true },
  });

  if (
    !page?.isPublished ||
    !page.thankYouEnabled ||
    !page.campaignId ||
    !page.campaign ||
    page.campaign.status !== "ACTIVE"
  ) {
    return null;
  }

  const lead = await prisma.lead.findFirst({
    where: { id: leadId, campaignId: page.campaignId },
    select: { id: true },
  });
  if (!lead) return null;

  let thankYouCraftState = page.thankYouCraftState;
  let thankYouThemeJson = page.thankYouThemeJson;

  if (page.publishedVersionId) {
    const version = await prisma.optinFunnelVersion.findUnique({
      where: { id: page.publishedVersionId },
    });
    if (version?.thankYouCraftState) {
      thankYouCraftState = version.thankYouCraftState;
      thankYouThemeJson = version.thankYouThemeJson;
    }
  }

  return buildThankYouFunnelPayload(
    {
      ...page,
      thankYouCraftState,
      thankYouThemeJson,
    },
    { leadId: lead.id, previewMode: false },
  );
}

export async function linkOptinFunnelToCampaign(
  funnelId: string,
  campaignId: string,
  advertiserId: string,
) {
  const page = await prisma.advertiserOptinPage.findFirst({
    where: { id: funnelId, advertiserId },
    select: { id: true, formJson: true },
  });
  if (!page) throw Errors.notFound("Optin funnel");

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, advertiserId },
    select: { id: true },
  });
  if (!campaign) throw Errors.validation("Selected campaign is invalid for this advertiser.");

  const existingForm = (page.formJson as FormJson | null) ?? null;
  const nextFormJson =
    existingForm && Array.isArray(existingForm.fields)
      ? toPrismaJson({ ...existingForm, campaignId })
      : undefined;

  await prisma.advertiserOptinPage.update({
    where: { id: page.id },
    data: {
      campaignId,
      ...(nextFormJson ? { formJson: nextFormJson } : {}),
    },
  });
}

export function buildOptinDestinationUrl(baseUrl: string, slug: string) {
  const normalizedBase = baseUrl.replace(/\/$/, "");
  return `${normalizedBase}/o/${slug}`;
}

export async function resolveOptinFunnelDestination(
  funnelId: string,
  advertiserId: string,
  baseUrl: string,
) {
  const page = await prisma.advertiserOptinPage.findFirst({
    where: { id: funnelId, advertiserId },
    select: { id: true, slug: true, title: true, name: true },
  });
  if (!page) throw Errors.notFound("Optin funnel");

  return {
    page,
    destinationUrl: buildOptinDestinationUrl(baseUrl, page.slug),
  };
}

export async function getFirstAdvertiserFunnel(advertiserId: string) {
  const page = await prisma.advertiserOptinPage.findFirst({
    where: { advertiserId, status: { not: "ARCHIVED" } },
    orderBy: { createdAt: "asc" },
  });
  return page ? serializeOptinPage(page) : null;
}

export async function getOrCreateFirstTemplateFunnel(advertiserId: string) {
  const existing = await prisma.advertiserOptinPage.findFirst({
    where: { advertiserId, status: { not: "ARCHIVED" } },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return serializeOptinPage(existing);

  const created = await createOptinFunnel(advertiserId, {
    name: "My Optin Funnel",
    editorType: "BUILDER",
  });
  return serializeOptinPage(created);
}

export type { SerializedOptinFunnel };
