import { prisma } from "@/lib/prisma";
import { validateLead } from "@/lib/lead-validation";
import { Errors } from "@/lib/errors";
import { enrichLeadsWithCountry } from "@/lib/lead-country";
import { getLeadCpl } from "@/lib/lead-cpl";
import { normalizeClientIp } from "@cpl/shared";
import { processLeadPayment, reverseLeadPayment, PAUSED_REASON_INSUFFICIENT_FUNDS } from "@/services/wallet.service";
import { getPlatformSettings } from "@/services/wallet.service";
import { notifyGeneric, notifyCampaignPausedForFunds } from "@/services/notify.service";
import {
  evaluateLead,
  getFraudConfig,
  recordDeviceSeen,
  refreshPublisherQuality,
  checkCampaignQualityAlert,
} from "@/modules/fraud";
import type { SubmissionMeta } from "@/modules/fraud";
import { dispatchAutoresponderEvent } from "@/modules/autoresponder";
import { dispatchLeadEmailAutomations } from "@/modules/email-marketing";
import type { LeadStatus } from "@prisma/client";
import type { Campaign, CampaignField } from "@prisma/client";
import type { FormJson } from "@/modules/page-builder/types/form-field";
import { endOfDay, startOfDay } from "date-fns";
import { calculatePublisherPayout } from "@/lib/platform-settings";
import { getPlatformSettingsConfig } from "@/lib/platform-settings-server";
import { parseUserAgent, shouldCreditPublisherForLead } from "@/lib/publisher-leads";
import { resolveLeadEmail, withResolvedLeadEmail } from "@/lib/lead-email";
import { validateEmailDeliverability } from "@/lib/email-deliverability";
import { parseCampaignTargeting } from "@/lib/campaign-targeting";
import { campaignAcceptsDeviceOs } from "@/lib/smart-link-rotation";
import { loadCpaMetricsByLeadIds } from "@/lib/cpa-lead-metrics";

type LeadValidationField = {
  fieldName: string;
  required: boolean;
  fieldType: string;
};

function campaignFieldsToValidationFields(fields: CampaignField[]): LeadValidationField[] {
  return fields.map((field) => ({
    fieldName: field.fieldName,
    required: field.required,
    fieldType: field.fieldType,
  }));
}

function formJsonToValidationFields(formJson: FormJson | null | undefined): LeadValidationField[] | null {
  if (!formJson?.fields?.length) return null;
  return formJson.fields.map((field) => ({
    fieldName: field.name,
    // Coerce existing published templates: non-checkbox fields are always required.
    required: field.type === "checkbox" ? Boolean(field.required) : true,
    fieldType: field.type === "email" ? "email" : field.type === "phone" ? "phone" : "text",
  }));
}

function resolveOptinFormJson(optinPage: {
  formJson: unknown;
  publishedVersion?: { formJson: unknown } | null;
}): FormJson | null {
  const raw = optinPage.publishedVersion?.formJson ?? optinPage.formJson;
  if (!raw || typeof raw !== "object") return null;
  return raw as FormJson;
}

async function notifyForLeadOutcome(leadId: string, status: LeadStatus, _reason?: string) {
  if (status !== "PENDING") return;

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      campaign: {
        include: { advertiser: { select: { id: true, email: true, name: true } } },
      },
    },
  });
  if (!lead) return;

  void notifyGeneric(lead.campaign.advertiser, {
    title: "New lead awaiting review",
    message: `A new lead was submitted for campaign "${lead.campaign.name}".`,
    actionPath: "/advertiser/lead-details",
    notificationType: "lead.pending",
  });
}

async function notifyInsufficientLeadFunds(leadId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      campaign: { include: { advertiser: { select: { id: true, email: true, name: true } } } },
    },
  });
  if (!lead) return;

  void notifyGeneric(lead.campaign.advertiser, {
    title: "Insufficient wallet balance",
    message: `A lead for "${lead.campaign.name}" could not be paid because your wallet balance is too low.`,
    actionPath: "/advertiser/wallet",
    notificationType: "lead.payment_failed",
  });
}

async function finalizeLeadStatus(leadId: string, nextStatus: LeadStatus, rejectionReason?: string) {
  if (nextStatus === "REJECTED") {
    void notifyForLeadOutcome(leadId, "REJECTED", rejectionReason);
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { publisherId: true, campaignId: true, campaign: { select: { name: true } } },
    });
    if (lead) {
      void refreshPublisherQuality(lead.publisherId);
      void checkCampaignQualityAlert(lead.campaignId, lead.campaign.name);
    }
    return;
  }

  if (nextStatus === "PENDING") {
    void notifyForLeadOutcome(leadId, "PENDING");
    return;
  }

  if (nextStatus === "APPROVED") {
    try {
      await processLeadPayment(leadId);
      void notifyForLeadOutcome(leadId, "PAID");
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { publisherId: true, campaignId: true, campaign: { select: { name: true } } },
      });
      if (lead) {
        void refreshPublisherQuality(lead.publisherId);
        void checkCampaignQualityAlert(lead.campaignId, lead.campaign.name);
      }
      void dispatchAutoresponderEvent({ leadId, event: "LEAD_APPROVED" });
      void dispatchLeadEmailAutomations({ leadId, event: "LEAD_APPROVED" });
    } catch (error) {
      const insufficientFunds =
        error instanceof Error && error.message === "INSUFFICIENT_FUNDS";

      if (!insufficientFunds) {
        throw error;
      }

      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: {
          campaignId: true,
          campaign: { select: { id: true, name: true, advertiserId: true } },
        },
      });

      await prisma.$transaction(async (tx) => {
        await tx.lead.update({
          where: { id: leadId },
          data: {
            status: "PENDING",
            statusHistory: {
              create: {
                fromStatus: "APPROVED",
                toStatus: "PENDING",
                reason: "Insufficient advertiser funds",
              },
            },
          },
        });

        if (lead) {
          await tx.campaign.update({
            where: { id: lead.campaignId },
            data: {
              status: "PAUSED",
              pausedReason: PAUSED_REASON_INSUFFICIENT_FUNDS,
            },
          });
        }
      });

      void notifyForLeadOutcome(leadId, "PENDING");
      void notifyInsufficientLeadFunds(leadId);
      if (lead) {
        void notifyCampaignPausedForFunds(lead.campaign.advertiserId, {
          campaignId: lead.campaign.id,
          campaignName: lead.campaign.name,
        });
      }
    }
  }
}

function extractCountry(data: Record<string, string>) {
  const countryKeys = ["country", "country_code", "countryCode", "nationality"] as const;
  return countryKeys.map((key) => data[key]?.trim()).find(Boolean) ?? undefined;
}

async function resolveNextStatus(params: {
  qualityPassed: boolean;
  qualityScore: number;
  autoApprove: boolean;
  fraudDecision: string;
  hardReject: boolean;
  rejectReason?: string;
  useRiskDecision: boolean;
}): Promise<{ status: LeadStatus; reason?: string }> {
  if (!params.qualityPassed || params.hardReject) {
    return { status: "REJECTED", reason: params.rejectReason ?? "Validation failed" };
  }

  if (params.useRiskDecision) {
    if (params.fraudDecision === "auto_reject") {
      return { status: "REJECTED", reason: params.rejectReason ?? "Fraud risk too high" };
    }
    if (params.fraudDecision === "auto_approve" && params.autoApprove) {
      return { status: "APPROVED" };
    }
    return { status: "PENDING" };
  }

  if (params.autoApprove && params.qualityScore >= 80) {
    return { status: "APPROVED" };
  }
  return { status: "PENDING" };
}

async function createAndProcessLead(input: {
  campaignId: string;
  publisherId: string;
  trackingLinkId?: string;
  campaign: Campaign & { fields: CampaignField[] };
  validationFields?: LeadValidationField[];
  data: Record<string, string>;
  honeypot?: string;
  ip?: string;
  userAgent?: string;
  source?: string;
  subId?: string;
  deviceFingerprint?: string;
  submissionMeta?: SubmissionMeta;
  headerCountry?: string;
}) {
  const settings = await getPlatformSettings();
  const validationFields =
    input.validationFields ?? campaignFieldsToValidationFields(input.campaign.fields);
  const leadData = withResolvedLeadEmail(input.data, validationFields);

  const email = resolveLeadEmail(leadData, validationFields);
  if (email) {
    const deliverability = await validateEmailDeliverability(email);
    if (!deliverability.ok) {
      throw Errors.validation(deliverability.reason, "email");
    }
  }

  const formCountry = extractCountry(leadData);
  const targeting =
    typeof input.campaign.targeting === "object" && input.campaign.targeting
      ? (input.campaign.targeting as Record<string, unknown>)
      : {};

  // Fail before create when device/OS targeting does not match a known UA.
  // Unknown UAs still pass (same policy as smart-link rotation / fraud).
  const visitor = parseUserAgent(input.userAgent);
  if (!campaignAcceptsDeviceOs(targeting, visitor)) {
    throw Errors.validation(
      `This campaign does not accept ${visitor.device} / ${visitor.os} traffic.`,
      "device",
    );
  }

  const validation = validateLead({
    data: leadData,
    campaignFields: validationFields,
    existingEmails: [],
    existingPhones: [],
    honeypot: input.honeypot,
  });

  const fraud = await evaluateLead({
    campaignId: input.campaignId,
    publisherId: input.publisherId,
    trackingLinkId: input.trackingLinkId,
    data: leadData,
    ip: input.ip,
    userAgent: input.userAgent,
    country: formCountry,
    deviceFingerprint: input.deviceFingerprint,
    submissionMeta: input.submissionMeta,
    honeypot: input.honeypot,
    targeting,
    duplicateWindowDays: settings.duplicateWindowDays,
  });

  const country = formCountry ?? fraud.geoCountry ?? input.headerCountry;
  const geoCountry = fraud.geoCountry ?? input.headerCountry;

  const fraudConfig = await getFraudConfig();
  const allResults = [
    ...validation.results.map((r) => ({
      rule: r.rule,
      passed: r.passed,
      riskDelta: null as number | null,
      details: r.details,
    })),
    ...fraud.outcomes.map((o) => ({
      rule: o.rule,
      passed: o.passed,
      riskDelta: o.riskDelta,
      details: o.details,
    })),
  ];

  const lead = await prisma.lead.create({
    data: {
      campaignId: input.campaignId,
      publisherId: input.publisherId,
      trackingLinkId: input.trackingLinkId,
      status: "VALIDATING",
      data: leadData,
      cpl: input.campaign.cpl,
      score: validation.score,
      riskScore: fraud.riskScore,
      fraudDecision: fraud.fraudDecision,
      deviceFingerprint: input.deviceFingerprint,
      geoCountry,
      submissionMeta: input.submissionMeta ?? undefined,
      ip: input.ip,
      userAgent: input.userAgent,
      country,
      source: input.source,
      subId: input.subId,
      validationResults: {
        create: allResults.map((r) => ({
          rule: r.rule,
          passed: r.passed,
          riskDelta: r.riskDelta ?? undefined,
          details: r.details,
        })),
      },
      statusHistory: {
        create: { toStatus: "VALIDATING" },
      },
    },
  });

  if (input.deviceFingerprint) {
    await recordDeviceSeen(input.deviceFingerprint, input.campaignId, lead.id);
  }

  const { status: nextStatus, reason } = await resolveNextStatus({
    qualityPassed: validation.passed,
    qualityScore: validation.score,
    autoApprove: true,
    fraudDecision: fraud.fraudDecision,
    hardReject: fraud.hardReject,
    rejectReason: fraud.rejectReason,
    useRiskDecision: fraudConfig.useRiskDecision,
  });

  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      status: nextStatus,
      statusHistory: {
        create: { fromStatus: "VALIDATING", toStatus: nextStatus, reason },
      },
    },
  });

  await finalizeLeadStatus(lead.id, nextStatus, reason);

  if (nextStatus !== "REJECTED") {
    void dispatchAutoresponderEvent({ leadId: lead.id, event: "LEAD_CAPTURED" });
    void dispatchLeadEmailAutomations({ leadId: lead.id, event: "LEAD_CAPTURED" });
  }

  return prisma.lead.findUniqueOrThrow({
    where: { id: lead.id },
    include: { validationResults: true },
  });
}

export async function submitLead(input: {
  slug: string;
  data: Record<string, string>;
  honeypot?: string;
  ip?: string;
  userAgent?: string;
  source?: string;
  subId?: string;
  deviceFingerprint?: string;
  submissionMeta?: SubmissionMeta;
  headerCountry?: string;
}) {
  if (input.honeypot) {
    throw Errors.duplicateLead();
  }

  const trackingLink = await prisma.trackingLink.findUnique({
    where: { slug: input.slug },
    include: {
      campaign: { include: { fields: true } },
    },
  });

  if (!trackingLink || trackingLink.campaign.status !== "ACTIVE") {
    throw Errors.notFound("Campaign");
  }

  return createAndProcessLead({
    campaignId: trackingLink.campaignId,
    publisherId: trackingLink.publisherId,
    trackingLinkId: trackingLink.id,
    campaign: trackingLink.campaign,
    data: input.data,
    honeypot: input.honeypot,
    ip: input.ip,
    userAgent: input.userAgent,
    source: input.source,
    subId: input.subId,
    deviceFingerprint: input.deviceFingerprint,
    submissionMeta: input.submissionMeta,
    headerCountry: input.headerCountry,
  });
}

async function resolveHousePublisherId(): Promise<string> {
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (!admin) {
    throw Errors.validation("Platform is not configured for direct opt-in submissions.");
  }
  return admin.id;
}

export async function submitOptinLead(input: {
  optinSlug: string;
  data: Record<string, string>;
  honeypot?: string;
  ip?: string;
  userAgent?: string;
  deviceFingerprint?: string;
  submissionMeta?: SubmissionMeta;
  trackingSlug?: string;
  source?: string;
  subId?: string;
  headerCountry?: string;
}) {
  if (input.honeypot) {
    throw Errors.duplicateLead();
  }

  const trackingSlug = input.trackingSlug?.trim();
  if (trackingSlug) {
    const trackingLink = await prisma.trackingLink.findUnique({
      where: { slug: trackingSlug },
      include: {
        campaign: { include: { fields: true } },
      },
    });

    if (trackingLink && trackingLink.campaign.status === "ACTIVE") {
      const optinPage = await prisma.advertiserOptinPage.findUnique({
        where: { slug: input.optinSlug },
        include: {
          publishedVersion: { select: { formJson: true } },
        },
      });

      if (
        optinPage?.isPublished &&
        optinPage.campaignId &&
        optinPage.campaignId === trackingLink.campaignId
      ) {
        const validationFields =
          formJsonToValidationFields(resolveOptinFormJson(optinPage)) ?? undefined;
        return createAndProcessLead({
          campaignId: trackingLink.campaignId,
          publisherId: trackingLink.publisherId,
          trackingLinkId: trackingLink.id,
          campaign: trackingLink.campaign,
          validationFields,
          data: input.data,
          honeypot: input.honeypot,
          ip: input.ip,
          userAgent: input.userAgent,
          source: input.source ?? "optin",
          subId: input.subId,
          deviceFingerprint: input.deviceFingerprint,
          submissionMeta: input.submissionMeta,
          headerCountry: input.headerCountry,
        });
      }
    }
  }

  const optinPage = await prisma.advertiserOptinPage.findUnique({
    where: { slug: input.optinSlug },
    include: {
      campaign: { include: { fields: true } },
      publishedVersion: { select: { formJson: true } },
    },
  });

  if (!optinPage?.isPublished) {
    throw Errors.notFound("Optin page");
  }

  if (!optinPage.campaign || optinPage.campaign.status !== "ACTIVE") {
    throw Errors.validation(
      "This funnel is published but not linked to an active campaign yet. Create a campaign and select this funnel.",
    );
  }

  const validationFields =
    formJsonToValidationFields(resolveOptinFormJson(optinPage)) ?? undefined;

  const housePublisherId = await resolveHousePublisherId();

  return createAndProcessLead({
    campaignId: optinPage.campaign.id,
    publisherId: housePublisherId,
    campaign: optinPage.campaign,
    validationFields,
    data: input.data,
    honeypot: input.honeypot,
    ip: input.ip,
    userAgent: input.userAgent,
    source: input.source ?? "optin",
    subId: input.subId,
    deviceFingerprint: input.deviceFingerprint,
    submissionMeta: input.submissionMeta,
    headerCountry: input.headerCountry,
  });
}

async function resolveCampaignTestContext(campaignId: string) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId },
    include: { fields: { orderBy: { sortOrder: "asc" } } },
  });

  if (!campaign) {
    throw Errors.notFound("Campaign");
  }

  let optinPage = await prisma.advertiserOptinPage.findFirst({
    where: { campaignId, advertiserId: campaign.advertiserId },
    include: { publishedVersion: { select: { formJson: true } } },
  });

  if (!optinPage) {
    const { optinPageId } = parseCampaignTargeting(campaign.targeting);
    if (optinPageId) {
      optinPage = await prisma.advertiserOptinPage.findFirst({
        where: { id: optinPageId, advertiserId: campaign.advertiserId },
        include: { publishedVersion: { select: { formJson: true } } },
      });
    }
  }

  if (!optinPage) {
    throw Errors.validation("Attach a funnel to this campaign before testing");
  }

  const formJson = resolveOptinFormJson(optinPage);
  const validationFields =
    formJsonToValidationFields(formJson) ??
    campaignFieldsToValidationFields(campaign.fields);

  return { campaign, optinPage, formJson, validationFields };
}

/**
 * Campaign verification for advertisers or admins. Persists an unpaid test lead,
 * dispatches autoresponder LEAD_CAPTURED, and skips billing/fraud/analytics.
 * publisherId is always the campaign advertiser; actorId is who ran the test.
 */
export async function submitTestCampaignLead(input: {
  campaignId: string;
  /** Campaign owner — used as lead publisherId for test attribution. */
  advertiserId: string;
  actorId: string;
  actorReason?: string;
  data: Record<string, string>;
}) {
  const { campaign, validationFields } = await resolveCampaignTestContext(input.campaignId);

  if (campaign.advertiserId !== input.advertiserId) {
    throw Errors.forbidden();
  }

  if (validationFields.length === 0) {
    throw Errors.validation(
      "This funnel has no form fields to test yet. Add fields in the builder and try again.",
    );
  }

  const leadData = withResolvedLeadEmail(input.data, validationFields);
  const validation = validateLead({
    data: leadData,
    campaignFields: validationFields,
    existingEmails: [],
    existingPhones: [],
  });

  if (!validation.passed) {
    const firstFailure = validation.results.find((r) => !r.passed);
    throw Errors.validation(
      firstFailure?.details ?? "Test lead validation failed",
      firstFailure?.rule.startsWith("required_")
        ? firstFailure.rule.replace("required_", "")
        : undefined,
    );
  }

  const country = extractCountry(leadData);
  const actorReason = input.actorReason ?? "Campaign test lead";

  const lead = await prisma.lead.create({
    data: {
      campaignId: campaign.id,
      publisherId: input.advertiserId,
      status: "CAPTURED",
      data: leadData,
      cpl: campaign.cpl,
      score: validation.score,
      country,
      source: "campaign_test",
      isTest: true,
      validationResults: {
        create: validation.results.map((r) => ({
          rule: r.rule,
          passed: r.passed,
          details: r.details,
        })),
      },
      statusHistory: {
        create: {
          toStatus: "CAPTURED",
          actorId: input.actorId,
          reason: actorReason,
        },
      },
    },
  });

  void dispatchAutoresponderEvent({ leadId: lead.id, event: "LEAD_CAPTURED" });

  return lead;
}

/** @deprecated Prefer submitTestCampaignLead — kept for call-site clarity. */
export async function submitAdvertiserTestCampaignLead(input: {
  campaignId: string;
  advertiserId: string;
  data: Record<string, string>;
}) {
  return submitTestCampaignLead({
    campaignId: input.campaignId,
    advertiserId: input.advertiserId,
    actorId: input.advertiserId,
    actorReason: "Advertiser campaign test lead",
    data: input.data,
  });
}

export async function submitLandingLead(input: {
  landingPageSlug: string;
  data: Record<string, string>;
  honeypot?: string;
  ip?: string;
  userAgent?: string;
  deviceFingerprint?: string;
  submissionMeta?: SubmissionMeta;
  headerCountry?: string;
}) {
  if (input.honeypot) {
    throw Errors.duplicateLead();
  }

  const page = await prisma.landingPage.findUnique({
    where: { slug: input.landingPageSlug },
    include: {
      publishedVersion: true,
      campaign: { include: { fields: true } },
    },
  });

  if (
    !page?.publishedVersion ||
    page.status !== "PUBLISHED" ||
    !page.campaign ||
    page.campaign.status !== "ACTIVE"
  ) {
    throw Errors.notFound("Landing page");
  }

  const formJson = page.publishedVersion.formJson as FormJson | null;
  const validationFields = formJsonToValidationFields(formJson) ?? undefined;

  if (formJson?.fields) {
    for (const field of formJson.fields) {
      const value = input.data[field.name]?.trim() ?? "";
      const isRequired = field.type === "checkbox" ? Boolean(field.required) : true;
      if (isRequired && !value) {
        throw Errors.validation(`${field.name} is required`, field.name);
      }
      if (field.minLength && value.length < field.minLength) {
        throw Errors.validation(`${field.name} is too short`, field.name);
      }
      if (field.maxLength && value.length > field.maxLength) {
        throw Errors.validation(`${field.name} is too long`, field.name);
      }
      if (field.pattern && value && !new RegExp(field.pattern).test(value)) {
        throw Errors.validation(`${field.name} is invalid`, field.name);
      }
      if (field.type === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        throw Errors.validation("Invalid email address", field.name);
      }
    }
  }

  return createAndProcessLead({
    campaignId: page.campaign.id,
    publisherId: page.advertiserId,
    campaign: page.campaign,
    validationFields,
    data: input.data,
    honeypot: input.honeypot,
    ip: input.ip,
    userAgent: input.userAgent,
    source: "landing_page",
    deviceFingerprint: input.deviceFingerprint,
    submissionMeta: input.submissionMeta,
    headerCountry: input.headerCountry,
  });
}

export function canActorUpdateLeadStatus(input: {
  isAdmin?: boolean;
  campaignAdvertiserId: string;
  actorId: string;
}) {
  return Boolean(input.isAdmin || input.campaignAdvertiserId === input.actorId);
}

export async function updateLeadStatus(
  leadId: string,
  status: "APPROVED" | "REJECTED",
  actorId: string,
  reason?: string,
  options?: { isAdmin?: boolean },
) {
  const lead = await prisma.lead.findUniqueOrThrow({
    where: { id: leadId },
    include: { campaign: { select: { advertiserId: true } } },
  });

  if (
    !canActorUpdateLeadStatus({
      isAdmin: options?.isAdmin,
      campaignAdvertiserId: lead.campaign.advertiserId,
      actorId,
    })
  ) {
    throw Errors.forbidden();
  }

  if (lead.isTest) {
    throw Errors.validation("Test leads cannot be approved or rejected for payment.");
  }

  if (lead.status === "REJECTED") {
    throw Errors.validation("Lead is already rejected.");
  }

  if (status === "APPROVED" && !["PENDING", "APPROVED"].includes(lead.status)) {
    throw Errors.notFound("Lead");
  }

  if (status === "REJECTED" && lead.status === "PAID" && !options?.isAdmin) {
    throw Errors.forbidden();
  }

  if (status === "REJECTED" && lead.status === "PAID") {
    await prisma.$transaction(async (tx) => {
      await reverseLeadPayment(leadId, actorId, reason, tx);
      await tx.lead.update({
        where: { id: leadId },
        data: {
          status: "REJECTED",
          statusHistory: {
            create: {
              fromStatus: lead.status,
              toStatus: "REJECTED",
              actorId,
              reason,
            },
          },
        },
      });
    });
  } else {
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        status,
        statusHistory: {
          create: {
            fromStatus: lead.status,
            toStatus: status,
            actorId,
            reason,
          },
        },
      },
    });
  }

  if (status === "APPROVED") {
    await finalizeLeadStatus(leadId, "APPROVED");
  } else {
    void notifyForLeadOutcome(leadId, "REJECTED", reason);
    void refreshPublisherQuality(lead.publisherId);
    const campaign = await prisma.campaign.findUnique({
      where: { id: lead.campaignId },
      select: { name: true },
    });
    if (campaign) void checkCampaignQualityAlert(lead.campaignId, campaign.name);
  }

  return prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
}

export type AdvertiserLeadSort =
  | "created_desc"
  | "created_asc"
  | "campaign_asc"
  | "campaign_desc"
  | "campaignId_asc"
  | "campaignId_desc"
  | "logData_asc"
  | "logData_desc"
  | "status_asc"
  | "status_desc"
  | "message_asc"
  | "message_desc";

const LEAD_LIST_INCLUDE = {
  campaign: {
    select: {
      id: true,
      name: true,
      cpl: true,
      advertiserId: true,
      advertiser: { select: { id: true, name: true } },
    },
  },
  publisher: { select: { name: true, email: true } },
  validationResults: { orderBy: { rule: "asc" as const } },
  statusHistory: { orderBy: { createdAt: "desc" as const }, take: 3 },
};

type LeadListFilters = {
  campaignId?: string;
  campaignSearch?: string;
  publisherId?: string;
  publisherSearch?: string;
  advertiserId?: string;
  status?: LeadStatus;
  source?: string;
  email?: string;
  minRiskScore?: number;
  sort?: AdvertiserLeadSort;
  dateFrom?: Date;
  dateTo?: Date;
};

function buildLeadListWhere(filters: LeadListFilters) {
  const createdAt: { gte?: Date; lte?: Date } = {};
  if (filters.dateFrom) {
    const from = new Date(filters.dateFrom);
    from.setHours(0, 0, 0, 0);
    createdAt.gte = from;
  }
  if (filters.dateTo) {
    const to = new Date(filters.dateTo);
    to.setHours(23, 59, 59, 999);
    createdAt.lte = to;
  }

  const campaignWhere =
    filters.advertiserId || filters.campaignSearch?.trim()
      ? {
          ...(filters.advertiserId && { advertiserId: filters.advertiserId }),
          ...(filters.campaignSearch?.trim() && {
            OR: [
              { id: { contains: filters.campaignSearch.trim() } },
              { name: { contains: filters.campaignSearch.trim() } },
            ],
          }),
        }
      : undefined;

  return {
    ...(filters.campaignId && { campaignId: filters.campaignId }),
    ...(filters.publisherId && { publisherId: filters.publisherId }),
    ...(filters.publisherSearch?.trim() && {
      publisherId: { contains: filters.publisherSearch.trim() },
    }),
    ...(filters.status && { status: filters.status }),
    ...(filters.source?.trim() && { source: filters.source.trim() }),
    ...(filters.email?.trim() && {
      data: { path: "$.email", equals: filters.email.trim() },
    }),
    ...(filters.minRiskScore !== undefined && { riskScore: { gte: filters.minRiskScore } }),
    ...(Object.keys(createdAt).length > 0 && { createdAt }),
    ...(campaignWhere && { campaign: campaignWhere }),
  };
}

function buildLeadListOrderBy(sort: AdvertiserLeadSort) {
  return sort === "created_asc"
    ? { createdAt: "asc" as const }
    : sort === "campaign_asc"
      ? { campaign: { name: "asc" as const } }
      : sort === "campaign_desc"
        ? { campaign: { name: "desc" as const } }
        : sort === "campaignId_asc"
          ? { campaignId: "asc" as const }
          : sort === "campaignId_desc"
            ? { campaignId: "desc" as const }
            : sort === "logData_asc"
              ? { id: "asc" as const }
              : sort === "logData_desc"
                ? { id: "desc" as const }
                : sort === "status_asc"
                  ? { status: "asc" as const }
                  : sort === "status_desc"
                    ? { status: "desc" as const }
                    : sort === "message_asc"
                      ? { updatedAt: "asc" as const }
                      : sort === "message_desc"
                        ? { updatedAt: "desc" as const }
                        : { createdAt: "desc" as const };
}

async function loadFunnelEventIpByLeadId(leadIds: string[]) {
  if (leadIds.length === 0) return new Map<string, string>();

  const events = await prisma.funnelEvent.findMany({
    where: { leadId: { in: leadIds }, ip: { not: null } },
    select: { leadId: true, ip: true },
    orderBy: { createdAt: "desc" },
  });

  const map = new Map<string, string>();
  for (const event of events) {
    if (!event.leadId || !event.ip || map.has(event.leadId)) continue;
    map.set(event.leadId, event.ip);
  }
  return map;
}

async function loadPaidLeadCplByLeadId(leadIds: string[]) {
  if (leadIds.length === 0) return new Map<string, number>();

  const entries = await prisma.ledgerEntry.findMany({
    where: {
      type: "DEBIT",
      referenceType: "lead",
      referenceId: { in: leadIds },
    },
    select: { referenceId: true, amount: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const map = new Map<string, number>();
  for (const entry of entries) {
    if (!entry.referenceId || map.has(entry.referenceId)) continue;
    map.set(entry.referenceId, Number(entry.amount));
  }
  return map;
}

async function enrichLeadListRows<
  T extends {
    id: string;
    status?: string;
    cpl?: number | string | { toString(): string } | null;
    ip?: string | null;
    country?: string | null;
    geoCountry?: string | null;
    data?: unknown;
    submissionMeta?: unknown;
  },
>(rows: T[]) {
  const missingIpLeadIds = rows
    .filter((lead) => !normalizeClientIp(lead.ip))
    .map((lead) => lead.id);
  const paidLeadIds = rows.filter((lead) => lead.status === "PAID").map((lead) => lead.id);

  const [funnelIps, paidCplByLeadId] = await Promise.all([
    loadFunnelEventIpByLeadId(missingIpLeadIds),
    loadPaidLeadCplByLeadId(paidLeadIds),
  ]);

  const enriched = await enrichLeadsWithCountry(rows, undefined, (lead) => {
    const directIp = normalizeClientIp(lead.ip);
    if (directIp) return directIp;
    return funnelIps.get(lead.id);
  });

  const cplRepairs: Array<{ id: string; cpl: number }> = [];

  const withIpAndCpl = enriched.map((lead) => {
    let next = lead;
    if (!normalizeClientIp(lead.ip)) {
      const funnelIp = funnelIps.get(lead.id);
      if (funnelIp) next = { ...next, ip: funnelIp };
    }

    if (lead.status === "PAID") {
      const paidCpl = paidCplByLeadId.get(lead.id);
      if (paidCpl !== undefined) {
        const current = lead.cpl == null || lead.cpl === "" ? null : Number(lead.cpl);
        if (current === null || Math.abs(current - paidCpl) > 0.0001) {
          cplRepairs.push({ id: lead.id, cpl: paidCpl });
        }
        next = { ...next, cpl: paidCpl };
      }
    }

    return next;
  });

  if (cplRepairs.length > 0) {
    void prisma
      .$transaction(
        cplRepairs.map((item) =>
          prisma.lead.update({
            where: { id: item.id },
            data: { cpl: item.cpl },
          }),
        ),
      )
      .catch((error) => {
        console.error("Failed to repair lead CPL snapshots from ledger", error);
      });
  }

  return withIpAndCpl;
}

async function attachCpaMetricsToLeadRows<
  T extends { id: string },
>(rows: T[]): Promise<Array<T & { salesCount: number; revenue: number }>> {
  const metricsByLeadId = await loadCpaMetricsByLeadIds(rows.map((row) => row.id));
  return rows.map((row) => {
    const metrics = metricsByLeadId.get(row.id);
    return {
      ...row,
      salesCount: metrics?.salesCount ?? 0,
      revenue: metrics?.revenue ?? 0,
    };
  });
}

export async function listLeads(filters: LeadListFilters & { page?: number; limit?: number }) {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 10;
  const sort = filters.sort ?? "created_desc";
  const where = buildLeadListWhere(filters);
  const orderBy = buildLeadListOrderBy(sort);

  const [data, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: LEAD_LIST_INCLUDE,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.lead.count({ where }),
  ]);

  const enriched = await enrichLeadListRows(data);
  const withCpaMetrics = await attachCpaMetricsToLeadRows(enriched);
  const backfill = withCpaMetrics
    .map((lead, index) => {
      const original = data[index];
      if (
        !lead.country ||
        (original.country?.trim() === lead.country && original.geoCountry?.trim() === lead.geoCountry)
      ) {
        return null;
      }
      return {
        id: lead.id,
        country: lead.country,
        geoCountry: lead.geoCountry ?? lead.country,
      };
    })
    .filter((item): item is { id: string; country: string; geoCountry: string } => item !== null);

  if (backfill.length > 0) {
    void prisma
      .$transaction(
        backfill.map((item) =>
          prisma.lead.update({
            where: { id: item.id },
            data: { country: item.country, geoCountry: item.geoCountry },
          }),
        ),
      )
      .catch((error) => {
        console.error("Failed to backfill lead country", error);
      });
  }

  return {
    data: withCpaMetrics,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  };
}

const LEAD_EXPORT_MAX = 10_000;

export async function listLeadsForExport(filters: LeadListFilters) {
  const sort = filters.sort ?? "created_desc";
  const where = buildLeadListWhere(filters);
  const orderBy = buildLeadListOrderBy(sort);

  const data = await prisma.lead.findMany({
    where,
    include: LEAD_LIST_INCLUDE,
    orderBy,
    take: LEAD_EXPORT_MAX,
  });

  return attachCpaMetricsToLeadRows(await enrichLeadListRows(data));
}

export type AdvertiserPublisherLeadReportRow = {
  publisherId: string;
  totalLeads: number;
  approvedLeads: number;
  pendingLeads: number;
  rejectedLeads: number;
  paidLeads: number;
  salesCount: number;
  revenue: number;
  estimatedSpend: number;
  payoutMin: number | null;
  payoutMax: number | null;
  lastLeadAt: Date | null;
};

function buildLeadReportDateRange(dateFrom?: Date, dateTo?: Date) {
  const createdAt: { gte?: Date; lte?: Date } = {};
  if (dateFrom) {
    createdAt.gte = startOfDay(dateFrom);
  }
  if (dateTo) {
    createdAt.lte = endOfDay(dateTo);
  }
  return createdAt;
}

export async function listAdvertiserPublisherLeadReport(filters: {
  advertiserId: string;
  publisherSearch?: string;
  campaignSearch?: string;
  dateFrom?: Date;
  dateTo?: Date;
  payoutMin?: number;
  payoutMax?: number;
}) {
  const campaignWhere: {
    advertiserId: string;
    id?: { contains: string };
    cpl?: { gte?: number; lte?: number };
  } = {
    advertiserId: filters.advertiserId,
    ...(filters.campaignSearch?.trim() && {
      id: { contains: filters.campaignSearch.trim() },
    }),
  };

  if (filters.payoutMin !== undefined || filters.payoutMax !== undefined) {
    campaignWhere.cpl = {
      ...(filters.payoutMin !== undefined && { gte: filters.payoutMin }),
      ...(filters.payoutMax !== undefined && { lte: filters.payoutMax }),
    };
  }

  const createdAt = buildLeadReportDateRange(filters.dateFrom, filters.dateTo);

  const leads = await prisma.lead.findMany({
    where: {
      campaign: campaignWhere,
      isTest: false,
      ...(filters.publisherSearch?.trim() && {
        publisherId: { contains: filters.publisherSearch.trim() },
      }),
      ...(Object.keys(createdAt).length > 0 && { createdAt }),
    },
    select: {
      id: true,
      publisherId: true,
      status: true,
      createdAt: true,
      cpl: true,
      campaign: { select: { cpl: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const paidCplByLeadId = await loadPaidLeadCplByLeadId(
    leads.filter((lead) => lead.status === "PAID").map((lead) => lead.id),
  );
  const cpaMetricsByLeadId = await loadCpaMetricsByLeadIds(leads.map((lead) => lead.id));

  const grouped = new Map<string, AdvertiserPublisherLeadReportRow>();

  for (const lead of leads) {
    const existing = grouped.get(lead.publisherId) ?? {
      publisherId: lead.publisherId,
      totalLeads: 0,
      approvedLeads: 0,
      pendingLeads: 0,
      rejectedLeads: 0,
      paidLeads: 0,
      salesCount: 0,
      revenue: 0,
      estimatedSpend: 0,
      payoutMin: null,
      payoutMax: null,
      lastLeadAt: null,
    };

    const cpl = paidCplByLeadId.get(lead.id) ?? getLeadCpl(lead);
    existing.payoutMin = existing.payoutMin === null ? cpl : Math.min(existing.payoutMin, cpl);
    existing.payoutMax = existing.payoutMax === null ? cpl : Math.max(existing.payoutMax, cpl);

    existing.totalLeads += 1;
    const leadCpaMetrics = cpaMetricsByLeadId.get(lead.id);
    if (leadCpaMetrics) {
      existing.salesCount += leadCpaMetrics.salesCount;
      existing.revenue += leadCpaMetrics.revenue;
    }
    if (lead.status === "APPROVED") {
      existing.approvedLeads += 1;
      existing.estimatedSpend += cpl;
    } else if (lead.status === "PAID") {
      existing.paidLeads += 1;
      existing.estimatedSpend += cpl;
    } else if (lead.status === "REJECTED") {
      existing.rejectedLeads += 1;
    } else {
      existing.pendingLeads += 1;
    }

    if (!existing.lastLeadAt || lead.createdAt > existing.lastLeadAt) {
      existing.lastLeadAt = lead.createdAt;
    }

    grouped.set(lead.publisherId, existing);
  }

  return Array.from(grouped.values()).sort((a, b) => b.totalLeads - a.totalLeads);
}

export type PublisherSubIdLeadReportRow = {
  subId: string;
  totalLeads: number;
  approvedLeads: number;
  pendingLeads: number;
  rejectedLeads: number;
  paidLeads: number;
  earnings: number;
  lastLeadAt: Date | null;
};

export async function listPublisherSubIdLeadReport(filters: {
  publisherId: string;
  subIdSearch?: string;
  campaignSearch?: string;
  dateFrom?: Date;
  dateTo?: Date;
}) {
  const createdAt = buildLeadReportDateRange(filters.dateFrom, filters.dateTo);
  const [leads, platformSettings] = await Promise.all([
    prisma.lead.findMany({
      where: {
        publisherId: filters.publisherId,
        isTest: false,
        ...(filters.subIdSearch?.trim() && {
          subId: { contains: filters.subIdSearch.trim() },
        }),
        ...(filters.campaignSearch?.trim() && {
          campaignId: { contains: filters.campaignSearch.trim() },
        }),
        ...(Object.keys(createdAt).length > 0 && { createdAt }),
      },
      select: {
        id: true,
        subId: true,
        status: true,
        country: true,
        createdAt: true,
        publisherId: true,
        trackingLinkId: true,
        cpl: true,
        campaign: { select: { cpl: true, advertiserId: true } },
        publisher: { select: { role: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    getPlatformSettingsConfig(),
  ]);

  const paidLeadIds = leads.filter((lead) => lead.status === "PAID").map((lead) => lead.id);
  const creditedEntries =
    paidLeadIds.length > 0
      ? await prisma.ledgerEntry.findMany({
          where: {
            type: "CREDIT",
            referenceType: "lead",
            referenceId: { in: paidLeadIds },
            wallet: { userId: filters.publisherId },
          },
          select: { referenceId: true, amount: true },
        })
      : [];
  const creditedByLeadId = new Map(
    creditedEntries.map((entry) => [entry.referenceId, Number(entry.amount)]),
  );

  const grouped = new Map<string, PublisherSubIdLeadReportRow>();

  for (const lead of leads) {
    const subId = lead.subId?.trim() || "No Sub ID";
    const existing = grouped.get(subId) ?? {
      subId,
      totalLeads: 0,
      approvedLeads: 0,
      pendingLeads: 0,
      rejectedLeads: 0,
      paidLeads: 0,
      earnings: 0,
      lastLeadAt: null,
    };

    existing.totalLeads += 1;
    if (lead.status === "APPROVED") {
      existing.approvedLeads += 1;
    } else if (lead.status === "PAID") {
      existing.paidLeads += 1;
      const credited = creditedByLeadId.get(lead.id);
      if (credited !== undefined) {
        existing.earnings += credited;
      } else if (shouldCreditPublisherForLead(lead)) {
        existing.earnings += calculatePublisherPayout(
          getLeadCpl(lead),
          lead.country,
          platformSettings,
        ).publisherAmount;
      }
    } else if (lead.status === "REJECTED") {
      existing.rejectedLeads += 1;
    } else {
      existing.pendingLeads += 1;
    }

    if (!existing.lastLeadAt || lead.createdAt > existing.lastLeadAt) {
      existing.lastLeadAt = lead.createdAt;
    }

    grouped.set(subId, existing);
  }

  return Array.from(grouped.values()).sort((a, b) => b.totalLeads - a.totalLeads);
}

export async function logClick(slug: string, meta: {
  ip: string;
  userAgent?: string;
  referrer?: string;
  geo?: Record<string, string>;
  source?: string;
  subId?: string;
}) {
  const link = await prisma.trackingLink.findUnique({ where: { slug } });
  if (!link) return null;

  await prisma.$transaction([
    prisma.click.create({
      data: {
        trackingLinkId: link.id,
        ip: meta.ip,
        userAgent: meta.userAgent,
        referrer: meta.referrer,
        geo: meta.geo,
        source: meta.source,
        subId: meta.subId,
      },
    }),
    prisma.trackingLink.update({
      where: { id: link.id },
      data: { clickCount: { increment: 1 } },
    }),
  ]);

  return link;
}
