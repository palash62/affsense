import { z } from "zod";
import { strongPasswordSchema } from "@/lib/password-policy";
import { parseYouTubeVideoId } from "@/lib/youtube";
import { ASSIGNABLE_STAFF_MENU_HREFS } from "@/lib/admin-portal";

export const signupAttributionSchema = z.object({
  utmSource: z.string().max(120).optional(),
  utmMedium: z.string().max(120).optional(),
  utmCampaign: z.string().max(120).optional(),
  utmContent: z.string().max(120).optional(),
  utmTerm: z.string().max(120).optional(),
  landingUrl: z.string().max(500).optional(),
});

export const registerSchema = z
  .object({
    email: z.string().email(),
    password: strongPasswordSchema,
    name: z.string().min(2),
    phone: z.string().min(5, "Enter a valid phone number"),
    address: z.string().min(3, "Enter your address"),
    country: z.string().min(2, "Select your country"),
    role: z.literal("ADVERTISER").default("ADVERTISER"),
    referralRef: z.string().optional(),
    signupAttribution: signupAttributionSchema.optional(),
  })
  .refine((data) => !data.referralRef?.trim() || data.role === "ADVERTISER", {
    message: "Referral sign-up is for advertisers only.",
    path: ["role"],
  });

export const publisherRegisterSchema = z.object({
  email: z.string().email(),
  password: strongPasswordSchema,
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  website: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || z.string().url().safeParse(val).success, {
      message: "Enter a valid website URL",
    }),
  trafficSource: z.string().trim().max(120).optional(),
  country: z.string().trim().max(120).optional(),
  addressLine1: z.string().trim().max(160).optional(),
  addressLine2: z.string().trim().max(160).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(120).optional(),
  postalCode: z.string().trim().max(40).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const requestOtpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const verifyOtpSchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code from your email"),
});

export const campaignSchema = z.object({
  name: z.string().min(3),
  description: z.string().optional(),
  category: z.enum(["FINANCE", "INSURANCE", "EDUCATION", "REAL_ESTATE", "GENERIC"]),
  cpl: z.number().positive(),
  budget: z.number().positive().nullable().optional(),
  dailyCap: z.number().int().positive().nullable().optional(),
  monthlyCap: z.number().int().positive().nullable().optional(),
  publisherAccess: z.enum(["OPEN", "APPROVAL_REQUIRED", "INVITE_ONLY"]).optional(),
  autoApprove: z.boolean().optional(),
  status: z.enum(["DRAFT", "PENDING", "ACTIVE", "PAUSED"]).optional(),
  targeting: z.record(z.string(), z.unknown()).optional(),
  fields: z
    .array(
      z.object({
        fieldName: z.string(),
        label: z.string(),
        fieldType: z.string(),
        required: z.boolean().optional(),
        validationRules: z.record(z.string(), z.unknown()).optional(),
        sortOrder: z.number().optional(),
      }),
    )
    .optional(),
});

export const submissionMetaSchema = z
  .object({
    formDurationMs: z.number().optional(),
    mouseMoveCount: z.number().optional(),
    keyPressCount: z.number().optional(),
    pasteCount: z.number().optional(),
    timezone: z.string().optional(),
    language: z.string().optional(),
    screenWxH: z.string().optional(),
    platform: z.string().optional(),
  })
  .optional();

export const leadSubmitSchema = z.object({
  slug: z.string(),
  data: z.record(z.string(), z.string()),
  honeypot: z.string().optional(),
  deviceFingerprint: z.string().max(128).optional(),
  submissionMeta: submissionMetaSchema,
  source: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{1,32}$/)
    .optional(),
  subId: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{1,32}$/)
    .optional(),
});

export const optinSubmitSchema = z.object({
  optinSlug: z.string().min(1),
  data: z.record(z.string(), z.string()),
  honeypot: z.string().optional(),
  deviceFingerprint: z.string().max(128).optional(),
  submissionMeta: submissionMetaSchema,
  /** Publisher tracking link from smart-link redirect (?tracking_slug=). */
  trackingSlug: z.string().min(1).max(120).optional(),
  source: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{1,32}$/)
    .optional(),
  subId: z
    .string()
    .regex(/^[a-zA-Z0-9_-]{1,32}$/)
    .optional(),
});

export const optinPageUpdateSchema = z.object({
  title: z.string().trim().min(2).max(80),
  slug: z.string().trim().min(2).max(40),
  destinationUrl: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .optional()
    .refine((value) => !value || z.string().url().safeParse(value).success, {
      message: "Enter a valid destination URL",
    }),
  templateId: z
    .enum(["aurora", "sunrise", "ocean", "minimal", "bold", "neon"])
    .optional(),
  headline: z.string().trim().min(3).max(120),
  subheadline: z.string().trim().min(3).max(200),
  description: z.string().trim().max(1000).nullable().optional(),
  ctaText: z.string().trim().min(2).max(60),
  successTitle: z.string().trim().min(2).max(80),
  successMessage: z.string().trim().min(2).max(200),
  badgeText: z.string().trim().max(80).nullable().optional(),
  bulletPoints: z.array(z.string().trim().min(1).max(120)).max(6),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  isPublished: z.boolean(),
  thankYouEnabled: z.boolean().optional(),
  thankYouPixelHtml: z.string().trim().max(10000).nullable().optional(),
  thankYouUseCampaignPixel: z.boolean().optional(),
  funnelId: z.string().optional(),
});

export const optinPageColorsSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export const emailPayoutDetailsSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
});

export const bankPayoutDetailsSchema = z
  .object({
    country: z.string().trim().min(2, "Country is required"),
    beneficiaryName: z.string().trim().min(2, "Beneficiary name is required"),
    accountNumber: z.string().trim().min(4, "Account number is required"),
    accountType: z.enum(["checking", "savings"]).optional(),
    routingNumber: z.string().trim().optional(),
    sortCode: z.string().trim().optional(),
    iban: z.string().trim().optional(),
    swiftBic: z.string().trim().optional(),
    bankName: z.string().trim().optional(),
    bankAddress: z.string().trim().optional(),
    addressLine1: z.string().trim().optional(),
    city: z.string().trim().optional(),
    state: z.string().trim().optional(),
    postalCode: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    const country = data.country.toUpperCase();
    if (country === "US") {
      if (!data.routingNumber?.trim()) {
        ctx.addIssue({ code: "custom", message: "Routing number is required for US", path: ["routingNumber"] });
      }
      if (!data.accountType) {
        ctx.addIssue({ code: "custom", message: "Account type is required for US", path: ["accountType"] });
      }
      if (!data.addressLine1?.trim()) {
        ctx.addIssue({ code: "custom", message: "Address is required for US", path: ["addressLine1"] });
      }
    }
    if (country === "GB" && !data.sortCode?.trim()) {
      ctx.addIssue({ code: "custom", message: "Sort code is required for UK", path: ["sortCode"] });
    }
    if (country === "IN" && !data.routingNumber?.trim()) {
      ctx.addIssue({ code: "custom", message: "IFSC is required for India", path: ["routingNumber"] });
    }
    const euCodes = ["DE", "FR", "ES", "IT", "NL", "BE", "AT", "IE", "PT", "FI", "GR", "LU"];
    if (euCodes.includes(country) && !data.iban?.trim()) {
      ctx.addIssue({ code: "custom", message: "IBAN is required for this country", path: ["iban"] });
    }
  });

export const payoutRequestSchema = z.discriminatedUnion("method", [
  z.object({
    amount: z.number().positive(),
    method: z.literal("WISE"),
    paymentDetails: emailPayoutDetailsSchema,
    idempotencyKey: z.string().optional(),
  }),
  z.object({
    amount: z.number().positive(),
    method: z.literal("STRIPE_CONNECT"),
    paymentDetails: emailPayoutDetailsSchema,
    idempotencyKey: z.string().optional(),
  }),
  z.object({
    amount: z.number().positive(),
    method: z.literal("BANK_TRANSFER"),
    paymentDetails: bankPayoutDetailsSchema,
    idempotencyKey: z.string().optional(),
  }),
]);

export const ticketSchema = z.object({
  subject: z.string().trim().min(3, "Subject must be at least 3 characters"),
  category: z.preprocess(
    (value) => (typeof value === "string" ? value.trim().toUpperCase() : value),
    z.enum(["GENERAL", "BILLING", "TECHNICAL", "CAMPAIGN", "PAYOUT", "OTHER"]),
  ),
  body: z.string().trim().min(10, "Message must be at least 10 characters"),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: strongPasswordSchema,
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid email address"),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Reset token is required"),
    newPassword: strongPasswordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const verifyEmailSchema = z.object({
  token: z.string().min(1, "Verification token is required"),
});

export const smtpSettingsSchema = z
  .object({
    host: z.string().trim(),
    port: z.coerce.number().int().min(1).max(65535),
    secure: z.boolean(),
    user: z.string().trim().optional(),
    pass: z.string().optional(),
    from: z.string().trim(),
    adminAlertEmail: z
      .string()
      .trim()
      .refine((v) => !v || z.string().email().safeParse(v).success, {
        message: "Enter a valid admin alert email",
      })
      .optional(),
    supportEmail: z
      .string()
      .trim()
      .refine((v) => !v || z.string().email().safeParse(v).success, {
        message: "Enter a valid support email",
      })
      .optional(),
    appUrl: z
      .string()
      .trim()
      .refine((v) => !v || z.string().url().safeParse(v).success, {
        message: "Enter a valid app URL",
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.host && data.from.length < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "From address is required when SMTP host is set",
        path: ["from"],
      });
    }
  });

export const stripeSettingsSchema = z
  .object({
    publishableKey: z.string().trim(),
    secretKey: z.string().optional(),
    webhookSecret: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.publishableKey && !data.publishableKey.startsWith("pk_")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Publishable key must start with pk_",
        path: ["publishableKey"],
      });
    }
    if (data.secretKey && !data.secretKey.startsWith("sk_")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Secret key must start with sk_",
        path: ["secretKey"],
      });
    }
  });

export const platformPixelSettingsSchema = z
  .object({
    meta: z.object({
      enabled: z.boolean(),
      pixelId: z.string().trim().optional().default(""),
    }),
    googleAds: z.object({
      enabled: z.boolean(),
      conversionId: z.string().trim().optional().default(""),
      conversionLabel: z.string().trim().optional().default(""),
    }),
  })
  .superRefine((data, ctx) => {
    if (data.meta.enabled) {
      if (!/^\d{5,20}$/.test(data.meta.pixelId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter a valid Facebook Pixel ID (digits only)",
          path: ["meta", "pixelId"],
        });
      }
    }

    if (data.googleAds.enabled) {
      const conversionId = data.googleAds.conversionId.toUpperCase();
      const normalized =
        conversionId.startsWith("AW-") || !/^\d{5,20}$/.test(conversionId)
          ? conversionId
          : `AW-${conversionId}`;

      if (!/^AW-\d{5,20}$/.test(normalized)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter a valid Google Ads Conversion ID (AW-123456789)",
          path: ["googleAds", "conversionId"],
        });
      }
      if (!data.googleAds.conversionLabel) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Conversion Label is required when Google Ads is enabled",
          path: ["googleAds", "conversionLabel"],
        });
      }
    }
  });

export const updateAdvertiserProfileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  company: z.string().trim().min(2, "Company name must be at least 2 characters").optional(),
  timezone: z.string().trim().min(1).optional(),
});

export const updatePublisherProfileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  website: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || val === "" || z.string().url().safeParse(val).success, {
      message: "Enter a valid website URL",
    }),
  trafficSource: z.string().trim().max(120).optional(),
  timezone: z.string().trim().min(1).optional(),
});

export const updateUserTimezoneSchema = z.object({
  timezone: z.string().trim().min(1, "Timezone is required"),
});

export const updateAdminPreferencesSchema = z.object({
  timezone: z.string().trim().min(1, "Timezone is required"),
});

export const updatePublisherGlobalLinkSchema = z.object({
  globalLinkUrl: z
    .union([z.string().trim().max(500), z.null()])
    .optional()
    .transform((val) => (val === "" || val === undefined ? null : val)),
});

export const adminCreateCampaignSchema = campaignSchema.extend({
  advertiserId: z.string().min(1, "Select an advertiser"),
  optinPageId: z.string().min(1, "Select an optin page"),
  vertical: z.string().trim().min(1, "Select a vertical"),
});

export const adminUpdateCampaignSchema = campaignSchema
  .partial()
  .extend({
    optinPageId: z.string().min(1).optional(),
    vertical: z.string().trim().min(1).optional(),
    // null clears an existing value (edit form sends null when field is blank)
    budget: z.number().positive().nullable().optional(),
    dailyCap: z.number().int().positive().nullable().optional(),
    monthlyCap: z.number().int().positive().nullable().optional(),
  });

export const adminBulkEmailSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1, "Select at least one recipient"),
  subject: z.string().trim().min(3, "Subject must be at least 3 characters").max(200),
  message: z
    .string()
    .trim()
    .min(1, "Message is required")
    .max(50000, "Message is too long")
    .refine(
      (html) =>
        html
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/gi, " ")
          .replace(/\s+/g, " ")
          .trim().length >= 10,
      "Message must be at least 10 characters",
    ),
});

export const adminPartnerPaymentCreateSchema = z.object({
  periodMonth: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "periodMonth must be YYYY-MM"),
  amount: z.number().positive("amount must be greater than 0"),
  paidAt: z.string().trim().min(1).optional(),
  method: z.string().trim().max(80).optional().nullable(),
  note: z.string().trim().max(2000).optional().nullable(),
});

export const adminPartnerPaymentListQuerySchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "from must be YYYY-MM")
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "to must be YYYY-MM")
    .optional(),
});

export const adminBulkEmailTestSchema = z.object({
  to: z.string().trim().email("Enter a valid email address"),
  subject: z.string().trim().min(3, "Subject must be at least 3 characters").max(200),
  message: z
    .string()
    .trim()
    .min(1, "Message is required")
    .max(50000, "Message is too long")
    .refine(
      (html) =>
        html
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/gi, " ")
          .replace(/\s+/g, " ")
          .trim().length >= 10,
      "Message must be at least 10 characters",
    ),
});

export const adminPublisherSpecialPayoutSchema = z
  .object({
    useSpecialTierPayouts: z.boolean(),
    tier1SpecialPayout: z.number().min(0).max(1000).nullable().optional(),
    tier2SpecialPayout: z.number().min(0).max(1000).nullable().optional(),
    tier3SpecialPayout: z.number().min(0).max(1000).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.useSpecialTierPayouts) return;

    const tiers = [
      ["tier1SpecialPayout", data.tier1SpecialPayout],
      ["tier2SpecialPayout", data.tier2SpecialPayout],
      ["tier3SpecialPayout", data.tier3SpecialPayout],
    ] as const;

    for (const [field, value] of tiers) {
      if (value == null || !Number.isFinite(value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Set a minimum payout for each tier",
          path: [field],
        });
      }
    }
  });

export const adminCreatePublisherSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.string().trim().email("Enter a valid email address"),
  website: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || val === "" || z.string().url().safeParse(val).success, {
      message: "Enter a valid website URL",
    }),
  trafficSource: z.string().trim().max(120).optional(),
  country: z.string().trim().max(120).optional(),
  addressLine1: z.string().trim().max(160).optional(),
  addressLine2: z.string().trim().max(160).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(120).optional(),
  postalCode: z.string().trim().max(40).optional(),
  status: z.enum(["ACTIVE", "PENDING"]).optional(),
});

export const adminCreateAdvertiserSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.string().trim().email("Enter a valid email address"),
  company: z.string().trim().min(2, "Company name must be at least 2 characters"),
  industry: z.string().trim().max(120).optional(),
  status: z.enum(["ACTIVE", "PENDING"]).optional(),
});

const assignableStaffMenuHrefSchema = z.enum(ASSIGNABLE_STAFF_MENU_HREFS);

export const adminCreateStaffUserSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.string().trim().email("Enter a valid email address"),
  phone: z.string().trim().max(40).optional().nullable(),
  country: z.string().trim().max(120).optional().nullable(),
  menuAccess: z.array(assignableStaffMenuHrefSchema).default([]),
});

export const adminUpdateStaffUserSchema = z.object({
  name: z.string().trim().min(2).optional(),
  phone: z.string().trim().max(40).optional().nullable(),
  country: z.string().trim().max(120).optional().nullable(),
  menuAccess: z.array(assignableStaffMenuHrefSchema).optional(),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
  });

export const adminPublisherSmartLinkCampaignsSchema = z
  .object({
    restrictSmartLinkCampaigns: z.boolean(),
    campaignIds: z.array(z.string().trim().min(1)).default([]),
  })
  .superRefine((data, ctx) => {
    if (data.restrictSmartLinkCampaigns && data.campaignIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select at least one campaign",
        path: ["campaignIds"],
      });
    }
  });

const WEBHOOK_URL_ERROR =
  "Enter a valid webhook URL starting with https:// (not an email address)";

const webhookConfigSchema = z
  .object({
    url: z
      .string()
      .trim()
      .url(WEBHOOK_URL_ERROR)
      .refine((value) => /^https?:\/\//i.test(value), { message: WEBHOOK_URL_ERROR }),
    method: z.enum(["POST", "PUT"]).optional(),
    headers: z.record(z.string(), z.string()).optional(),
    secret: z.string().optional(),
    bodyTemplate: z.string().max(20_000).optional(),
  })
  .superRefine((value, ctx) => {
    const template = value.bodyTemplate?.trim();
    if (!template) return;
    const dryRun = template.replace(/\{\{\s*[a-zA-Z0-9_.]+\s*\}\}/g, "");
    try {
      JSON.parse(dryRun);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bodyTemplate"],
        message:
          "Custom JSON body must be valid JSON. Use placeholders like {{email}} inside string values.",
      });
    }
  });

const mailchimpConfigSchema = z.object({
  apiKey: z.string().min(1, "API key is required"),
  serverPrefix: z.string().min(1, "Server prefix is required (e.g. us21)"),
  listId: z.string().min(1, "List ID is required"),
  tags: z.array(z.string()).optional(),
});

/** OAuth path: listId from form; tokens merged from OAuth session or existing connection. */
const aweberConfigSchema = z.object({
  listId: z.string().min(1, "List ID is required"),
  accessToken: z.string().optional(),
  accountId: z.string().optional(),
  refreshToken: z.string().optional(),
  tokenExpiresAt: z.number().optional(),
});

const getResponseConfigSchema = z
  .object({
    apiKey: z.string().min(1, "API key is required"),
    campaignId: z.string().optional(),
    listId: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    const listToken = (value.campaignId ?? value.listId ?? "").trim();
    if (!listToken) {
      ctx.addIssue({
        code: "custom",
        path: ["campaignId"],
        message: "GetResponse list ID is required",
      });
    }
  })
  .transform((value) => ({
    apiKey: value.apiKey.trim(),
    campaignId: (value.campaignId ?? value.listId ?? "").trim(),
  }));

const systemeConfigSchema = z
  .object({
    apiKey: z.string().min(1, "API key is required"),
    tagId: z.string().trim().optional(),
  })
  .superRefine((value, ctx) => {
    const tagId = value.tagId?.trim() ?? "";
    if (tagId && !/^\d+$/.test(tagId)) {
      ctx.addIssue({
        code: "custom",
        path: ["tagId"],
        message: "Systeme.io tag ID must be numeric",
      });
    }
  })
  .transform((value) => ({
    apiKey: value.apiKey.trim(),
    ...(value.tagId?.trim() ? { tagId: value.tagId.trim() } : {}),
  }));

const autoresponderBaseSchema = z.object({
  name: z.string().trim().min(2).max(80),
  trigger: z.enum(["LEAD_CAPTURED", "LEAD_APPROVED"]),
  campaignId: z.string().cuid().optional().nullable(),
  isEnabled: z.boolean().optional(),
  fieldMapping: z.record(z.string(), z.string()).optional().nullable(),
});

export const autoresponderConnectionSchema = z.discriminatedUnion("provider", [
  autoresponderBaseSchema.extend({
    provider: z.literal("WEBHOOK"),
    config: webhookConfigSchema,
  }),
  autoresponderBaseSchema.extend({
    provider: z.literal("MAILCHIMP"),
    config: mailchimpConfigSchema,
  }),
  autoresponderBaseSchema.extend({
    provider: z.literal("AWEBER"),
    config: aweberConfigSchema,
  }),
  autoresponderBaseSchema.extend({
    provider: z.literal("GETRESPONSE"),
    config: getResponseConfigSchema,
  }),
  autoresponderBaseSchema.extend({
    provider: z.literal("SYSTEME"),
    config: systemeConfigSchema,
  }),
]);

export const autoresponderConnectionUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  trigger: z.enum(["LEAD_CAPTURED", "LEAD_APPROVED"]).optional(),
  campaignId: z.string().cuid().optional().nullable(),
  isEnabled: z.boolean().optional(),
  fieldMapping: z.record(z.string(), z.string()).optional().nullable(),
  config: z
    .union([
      webhookConfigSchema,
      mailchimpConfigSchema,
      aweberConfigSchema,
      getResponseConfigSchema,
      systemeConfigSchema,
    ])
    .optional(),
});

export function isValidEmail(email: string): boolean {
  return z.string().email().safeParse(email).success;
}

export function isValidPhone(phone: string): boolean {
  return /^\+?[\d\s\-()]{10,}$/.test(phone);
}

export const emailTemplateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  subject: z.string().trim().min(1).max(200),
  htmlBody: z.string().min(1),
  textBody: z.string().optional().nullable(),
  previewText: z.string().max(200).optional().nullable(),
});

export const emailTemplateUpdateSchema = emailTemplateSchema.partial();

export const emailListSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    campaignIds: z
      .array(z.string().trim().min(1))
      .min(1, "Select at least one campaign")
      .optional(),
    campaignId: z.string().trim().min(1, "Campaign is required").optional(),
  })
  .transform((value) => ({
    name: value.name,
    campaignIds:
      value.campaignIds ??
      (value.campaignId ? [value.campaignId] : []),
  }))
  .superRefine((value, ctx) => {
    if (!value.campaignIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select at least one campaign",
        path: ["campaignIds"],
      });
    }
  });

export const emailListUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    campaignIds: z
      .array(z.string().trim().min(1))
      .min(1, "Select at least one campaign")
      .optional(),
    campaignId: z.string().trim().min(1, "Campaign is required").optional(),
  })
  .transform((value) => ({
    name: value.name,
    campaignIds:
      value.campaignIds ??
      (value.campaignId ? [value.campaignId] : undefined),
  }));

export const emailTagSchema = z.object({
  name: z.string().trim().min(1).max(40),
  color: z
    .union([z.literal(""), z.string().trim().max(40)])
    .optional()
    .nullable(),
});

export const emailTagUpdateSchema = z.object({
  name: z.string().trim().min(1).max(40).optional(),
  color: z
    .union([z.literal(""), z.string().trim().max(40)])
    .optional()
    .nullable(),
});

export const emailAutomationStepSchema = z
  .object({
    id: z.string().cuid().optional(),
    type: z.literal("SEND_EMAIL").default("SEND_EMAIL"),
    templateId: z.union([z.string().cuid(), z.literal(""), z.null()]).optional(),
    tagId: z.union([z.string().cuid(), z.literal(""), z.null()]).optional(),
    delayMinutes: z.number().int().min(0).max(525600),
    order: z.number().int().min(0),
    fromName: z
      .union([z.literal(""), z.string().trim().min(2).max(80)])
      .optional()
      .nullable(),
    fromEmail: z.union([z.literal(""), z.string().email()]).optional().nullable(),
  })
  .superRefine((step, ctx) => {
    if (!step.templateId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Template is required for email steps",
        path: ["templateId"],
      });
    }
  });

export const emailAutomationSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    trigger: z.enum(["LEAD_CAPTURED", "LEAD_APPROVED"]),
    listId: z.string().trim().min(1, "Select a list").optional(),
    campaignId: z.string().trim().min(1, "Select a list").optional(),
    fromName: z.string().trim().min(2).max(80),
    replyTo: z.string().email().optional().nullable().or(z.literal("")),
    openTagId: z.union([z.string().cuid(), z.literal(""), z.null()]).optional(),
    clickTagId: z.union([z.string().cuid(), z.literal(""), z.null()]).optional(),
    steps: z.array(emailAutomationStepSchema).min(1).max(20),
  })
  .superRefine((value, ctx) => {
    if (!(value.listId?.trim() || value.campaignId?.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Select a list",
        path: ["listId"],
      });
    }
  });

export const emailAutomationUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  trigger: z.enum(["LEAD_CAPTURED", "LEAD_APPROVED"]).optional(),
  listId: z.string().trim().min(1, "Select a list").optional().nullable(),
  campaignId: z.string().trim().min(1, "Select a list").optional().nullable(),
  fromName: z.string().trim().min(2).max(80).optional(),
  replyTo: z.string().email().optional().nullable().or(z.literal("")),
  openTagId: z.union([z.string().cuid(), z.literal(""), z.null()]).optional(),
  clickTagId: z.union([z.string().cuid(), z.literal(""), z.null()]).optional(),
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED"]).optional(),
  steps: z.array(emailAutomationStepSchema).min(1).max(20).optional(),
});

export const advertiserEmailSettingsSchema = z.object({
  fromName: z.string().trim().min(2).max(80).optional(),
  fromEmail: z.string().trim().email("Select a verified sending email").optional().or(z.literal("")),
  replyTo: z.string().email().optional().or(z.literal("")),
});

export const emailMarketingPlatformConfigSchema = z.object({
  enabled: z.boolean().optional(),
  maxAutomationsPerAdvertiser: z.coerce.number().int().min(1).max(10_000).optional(),
  maxSendsPerDay: z.coerce.number().int().min(1).max(1_000_000).optional(),
  emailsPerDollar: z.coerce.number().positive().max(1_000_000),
});

export const emailWalletTopUpSchema = z.object({
  amount: z.coerce
    .number()
    .positive("Enter an amount greater than zero")
    .max(1_000_000, "Amount is too large"),
});

/** Real EmailList cuid, or synthetic "all" from listEmailLists */
const broadcastListIdSchema = z
  .string()
  .refine((v) => v === "all" || z.string().cuid().safeParse(v).success, {
    message: "Invalid list",
  });

export const emailBroadcastSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    audienceType: z.enum(["LIST", "TAGS"]),
    listId: broadcastListIdSchema.optional().nullable(),
    tagIds: z.array(z.string().cuid()).max(50).optional().nullable(),
    templateId: z.string().cuid().optional().nullable(),
    subject: z.string().trim().min(2).max(200).optional().nullable(),
    htmlBody: z.string().trim().min(10).max(500_000).optional().nullable(),
    fromEmail: z.union([z.literal(""), z.string().email()]).optional().nullable(),
    fromName: z.string().trim().max(80).optional().nullable(),
    action: z.enum(["draft", "schedule", "send"]).default("send"),
    scheduledAt: z
      .string()
      .optional()
      .nullable()
      .refine((v) => !v || !Number.isNaN(Date.parse(v)), { message: "Invalid schedule date" }),
  })
  .superRefine((value, ctx) => {
    const isDraft = value.action === "draft";
    if (value.audienceType === "LIST") {
      if (!isDraft && !value.listId) {
        ctx.addIssue({ code: "custom", path: ["listId"], message: "Select a list" });
      }
      if (value.tagIds && value.tagIds.length > 0) {
        ctx.addIssue({
          code: "custom",
          path: ["tagIds"],
          message: "Choose a list or tags, not both",
        });
      }
    } else {
      if (!isDraft && !value.tagIds?.length) {
        ctx.addIssue({
          code: "custom",
          path: ["tagIds"],
          message: "Select at least one tag",
        });
      }
      if (value.listId) {
        ctx.addIssue({
          code: "custom",
          path: ["listId"],
          message: "Choose a list or tags, not both",
        });
      }
    }
    const hasTemplate = Boolean(value.templateId);
    const hasInline = Boolean(value.subject?.trim() && value.htmlBody?.trim());
    if (!hasTemplate && !hasInline) {
      ctx.addIssue({
        code: "custom",
        path: ["templateId"],
        message: "Pick a template or write subject and body",
      });
    }
    if (value.action === "schedule" && !value.scheduledAt) {
      ctx.addIssue({
        code: "custom",
        path: ["scheduledAt"],
        message: "Pick a schedule date and time",
      });
    }
  });

export const emailBroadcastPreviewSchema = z
  .object({
    audienceType: z.enum(["LIST", "TAGS"]).optional().nullable(),
    listId: broadcastListIdSchema.optional().nullable(),
    tagIds: z.array(z.string().cuid()).max(50).optional().nullable(),
    fromEmail: z.union([z.literal(""), z.string().email()]).optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (!value.audienceType) return;
    if (value.audienceType === "LIST" && !value.listId) {
      ctx.addIssue({ code: "custom", path: ["listId"], message: "Select a list" });
    }
    if (value.audienceType === "TAGS" && !value.tagIds?.length) {
      ctx.addIssue({
        code: "custom",
        path: ["tagIds"],
        message: "Select at least one tag",
      });
    }
  });

export const sendingIdentitySchema = z.object({
  domain: z
    .string()
    .trim()
    .min(3)
    .max(253)
    .regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i),
  fromName: z.string().trim().min(2).max(80),
  /** Full address or local-part; must match the domain when provided */
  fromEmail: z.string().trim().max(254).optional().or(z.literal("")),
});

export const updateSendingIdentityFromEmailSchema = z.object({
  action: z.literal("updateFromEmail"),
  identityId: z.string().cuid(),
  fromEmail: z.string().trim().min(3).max(254),
});

export const addSendingMailboxSchema = z.object({
  action: z.literal("addMailbox"),
  identityId: z.string().cuid(),
  fromEmail: z.string().trim().min(3).max(254),
  fromName: z.string().trim().max(80).optional().nullable(),
});

export const removeSendingMailboxSchema = z.object({
  action: z.literal("removeMailbox"),
  identityId: z.string().cuid(),
  mailboxId: z.string().cuid(),
});

export const setDefaultSendingMailboxSchema = z.object({
  action: z.literal("setDefaultMailbox"),
  identityId: z.string().cuid(),
  mailboxId: z.string().cuid(),
});

export const landingPageCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  templateId: z.string().optional(),
  campaignId: z.string().optional(),
});

export const optinFunnelCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  editorType: z.enum(["TEMPLATE", "BUILDER"]),
  templateId: z.string().optional(),
  pageTemplateId: z.string().optional(),
});

export const campaignTestLeadSchema = z.object({
  data: z.record(z.string(), z.string()),
});

export const optinFunnelUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  title: z.string().trim().min(2).max(80).optional(),
  slug: z.string().trim().min(2).max(40).optional(),
  campaignId: z.string().nullable().optional(),
  customDomainId: z.string().nullable().optional(),
  destinationUrl: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .optional()
    .refine((value) => !value || z.string().url().safeParse(value).success, {
      message: "Enter a valid destination URL",
    }),
  cpaOfferId: z.string().trim().nullable().optional(),
  templateId: z.string().optional(),
  headline: z.string().trim().min(3).max(120).optional(),
  subheadline: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  ctaText: z.string().trim().min(2).max(60).optional(),
  successTitle: z.string().trim().min(2).max(80).optional(),
  successMessage: z.string().trim().min(2).max(200).optional(),
  badgeText: z.string().trim().max(80).nullable().optional(),
  bulletPoints: z.array(z.string().trim().min(1).max(120)).max(6).optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  isPublished: z.boolean().optional(),
  craftState: z.record(z.string(), z.unknown()).optional(),
  themeJson: z.record(z.string(), z.unknown()).optional(),
  thankYouEnabled: z.boolean().optional(),
  thankYouCraftState: z.record(z.string(), z.unknown()).nullable().optional(),
  thankYouThemeJson: z.record(z.string(), z.unknown()).optional(),
  thankYouPixelHtml: z.string().trim().max(10000).nullable().optional(),
  thankYouUseCampaignPixel: z.boolean().optional(),
  step: z.enum(["optin", "thankYou"]).optional(),
  autosave: z.boolean().optional(),
});

export const advertiserDomainAddSchema = z.object({
  domain: z
    .string()
    .trim()
    .min(3, "Enter a valid domain")
    .max(253, "Domain is too long"),
});

export const adminOptinFunnelTemplateCreateSchema = z.object({
  name: z.string().trim().min(2, "Template name must be at least 2 characters.").max(80),
  primaryColor: z.string().trim().optional(),
  secondaryColor: z.string().trim().optional(),
  sourceTemplateId: z.string().trim().min(1).optional(),
  isPublished: z.boolean().optional(),
});

export const adminOptinFunnelTemplateUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  craftState: z.record(z.string(), z.unknown()).optional(),
  themeJson: z.record(z.string(), z.unknown()).optional(),
  thankYouEnabled: z.boolean().optional(),
  destinationUrl: z
    .string()
    .trim()
    .max(500)
    .nullable()
    .optional()
    .refine((value) => !value || z.string().url().safeParse(value).success, {
      message: "Enter a valid destination URL",
    }),
  thankYouCraftState: z.record(z.string(), z.unknown()).nullable().optional(),
  thankYouThemeJson: z.record(z.string(), z.unknown()).optional(),
  thankYouPixelHtml: z.string().trim().max(10000).nullable().optional(),
  thankYouUseCampaignPixel: z.boolean().optional(),
  step: z.enum(["optin", "thankYou"]).optional(),
  autosave: z.boolean().optional(),
  isPublished: z.boolean().optional(),
});

export const landingPageUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  slug: z.string().trim().min(2).max(40).optional(),
  campaignId: z.string().nullable().optional(),
  craftState: z.record(z.string(), z.unknown()).optional(),
  themeJson: z.record(z.string(), z.unknown()).optional(),
  autosave: z.boolean().optional(),
});

export const landingSubmitSchema = z.object({
  landingPageSlug: z.string().min(1),
  data: z.record(z.string(), z.string()),
  honeypot: z.string().optional(),
  deviceFingerprint: z.string().max(128).optional(),
  submissionMeta: submissionMetaSchema,
});

export const templateImportSchema = z.object({
  templateMeta: z.object({
    name: z.string(),
    category: z.string(),
    schemaVersion: z.literal(1),
  }),
  craft: z.record(z.string(), z.unknown()),
  theme: z.record(z.string(), z.unknown()),
});

const tutorialThumbnailSchema = z
  .string()
  .trim()
  .min(1, "Thumbnail is required.")
  .refine((value) => value.startsWith("/uploads/builder/"), {
    message: "Upload a thumbnail image.",
  });

const tutorialYoutubeUrlSchema = z
  .string()
  .trim()
  .min(1, "YouTube URL is required.")
  .refine((value) => Boolean(parseYouTubeVideoId(value)), {
    message: "Enter a valid YouTube video URL.",
  });

export const adminTutorialCreateSchema = z.object({
  title: z.string().trim().min(2, "Title must be at least 2 characters.").max(120),
  description: z.string().trim().min(1, "Description is required.").max(2000),
  youtubeUrl: tutorialYoutubeUrlSchema,
  thumbnailUrl: tutorialThumbnailSchema,
  sortOrder: z.number().int().min(0).max(9999).optional(),
  isPublished: z.boolean().optional(),
});

export const adminTutorialUpdateSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().min(1).max(2000).optional(),
  youtubeUrl: tutorialYoutubeUrlSchema.optional(),
  thumbnailUrl: tutorialThumbnailSchema.optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  isPublished: z.boolean().optional(),
});

const httpUrlSchema = z
  .string()
  .trim()
  .min(1, "URL is required")
  .url("Enter a valid URL")
  .refine((value) => /^https?:\/\//i.test(value), {
    message: "URL must start with http:// or https://",
  });

const optionalHttpUrlSchema = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((value) => {
    if (value == null || value === "") return null;
    return value;
  })
  .refine((value) => value === null || z.string().url().safeParse(value).success, {
    message: "Enter a valid URL",
  })
  .refine((value) => value === null || /^https?:\/\//i.test(value), {
    message: "URL must start with http:// or https://",
  });

const cpaOfferStatusSchema = z.enum(["ACTIVE", "PAUSED", "ARCHIVED"]);
const cpaRevenueModelSchema = z.enum(["RPA", "RPS", "RPC", "RPI", "RPL", "RPM"]);
const cpaPayoutModelSchema = z.enum(["CPC", "CPA", "CPS", "CPI", "CPL", "CPM"]);
const cpaPayoutTypeSchema = z.enum(["FLAT", "PERCENT"]);

const cpaThumbnailSchema = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((value) => {
    if (value == null || value === "") return null;
    return value;
  })
  .refine(
    (value) =>
      value === null ||
      value.startsWith("/uploads/builder/") ||
      (z.string().url().safeParse(value).success && /^https?:\/\//i.test(value)),
    { message: "Upload an image or enter a valid URL" },
  );

/** Blank / "#" sentinel allowed; otherwise must be http(s). */
const cpaPreviewUrlValueSchema = z
  .string()
  .trim()
  .transform((value) => (value === "" || value === "#" ? "#" : value))
  .refine(
    (value) =>
      value === "#" ||
      (z.string().url().safeParse(value).success && /^https?:\/\//i.test(value)),
    { message: "Enter a valid preview URL starting with http:// or https://" },
  );

export const adminCpaOfferCreateSchema = z.object({
  name: z.string().trim().min(2, "Offer name must be at least 2 characters.").max(160),
  network: z.string().trim().min(1).max(120).optional(),
  category: z.string().trim().min(1, "Category is required.").max(120),
  country: z.string().trim().max(500).optional().default(""),
  previewUrl: cpaPreviewUrlValueSchema.optional().default("#"),
  trackingUrl: httpUrlSchema,
  thumbnailUrl: cpaThumbnailSchema,
  advertiserLabel: z.string().trim().min(1, "Advertiser is required.").max(120),
  revenueModel: cpaRevenueModelSchema.optional(),
  payoutModel: cpaPayoutModelSchema.optional(),
  payoutType: cpaPayoutTypeSchema.optional(),
  revenue: z.coerce.number().positive("Revenue must be greater than 0").max(1_000_000),
  payout: z.coerce.number().positive("Payout must be greater than 0").max(1_000_000),
  status: cpaOfferStatusSchema.optional(),
});

export const adminCpaOfferUpdateSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  network: z.string().trim().min(1).max(120).optional(),
  category: z.string().trim().min(1).max(120).optional(),
  country: z.string().trim().max(500).optional(),
  previewUrl: cpaPreviewUrlValueSchema.optional(),
  trackingUrl: httpUrlSchema.optional(),
  thumbnailUrl: cpaThumbnailSchema,
  advertiserLabel: z.string().trim().min(1).max(120).optional(),
  revenueModel: cpaRevenueModelSchema.optional(),
  payoutModel: cpaPayoutModelSchema.optional(),
  payoutType: cpaPayoutTypeSchema.optional(),
  revenue: z.coerce.number().positive().max(1_000_000).optional(),
  payout: z.coerce.number().positive().max(1_000_000).optional(),
  status: cpaOfferStatusSchema.optional(),
});

export const cpaOfferListQuerySchema = z.object({
  q: z.string().trim().optional(),
  id: z.string().trim().optional(),
  status: z.enum(["ACTIVE", "PAUSED", "ARCHIVED", "ALL"]).optional(),
  network: z.string().trim().optional(),
  category: z.string().trim().optional(),
  country: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const cpaConversionListQuerySchema = z.object({
  q: z.string().trim().optional(),
  offerId: z.string().trim().optional(),
  advertiserId: z.string().trim().optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const adminCpaNetworkPostbackSchema = z.object({
  useSecurityKey: z.boolean(),
  securityKey: z.string().trim().max(120).optional().default(""),
  parallelPostbackUrl: z.string().trim().max(2000).optional().default(""),
});

export const advertiserGlobalPostbackSchema = z.object({
  type: z.enum(["S2S", "IMAGE", "HTML"]),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  endpoint: z.string().trim().max(20_000).optional().default(""),
});

export const publisherPostbackSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]),
  endpoint: z.string().trim().max(20_000).optional().default(""),
});

const promotionUtmField = z.string().trim().min(1).max(120);

export const adminPromotionCreateSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(120),
  utmSource: promotionUtmField,
  utmMedium: z.string().trim().max(120).optional(),
  utmCampaign: promotionUtmField,
  utmContent: z.string().trim().max(120).optional(),
  utmTerm: z.string().trim().max(120).optional(),
  landingPath: z.string().trim().max(200).optional().default("/"),
});

export const adminPromotionUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  utmSource: promotionUtmField.optional(),
  utmMedium: z.string().trim().max(120).nullable().optional(),
  utmCampaign: promotionUtmField.optional(),
  utmContent: z.string().trim().max(120).nullable().optional(),
  utmTerm: z.string().trim().max(120).nullable().optional(),
  landingPath: z.string().trim().max(200).optional(),
  isActive: z.boolean().optional(),
});

export const adminPromotionReportQuerySchema = z.object({
  q: z.string().trim().optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
});

export const promotionVisitSchema = z.object({
  utmSource: z.string().trim().max(120).optional(),
  utmMedium: z.string().trim().max(120).optional(),
  utmCampaign: z.string().trim().max(120).optional(),
  utmContent: z.string().trim().max(120).optional(),
  utmTerm: z.string().trim().max(120).optional(),
  landingPath: z.string().trim().max(500).optional(),
  landingUrl: z.string().trim().max(2000).optional(),
  visitorKey: z.string().trim().max(64).optional(),
});
