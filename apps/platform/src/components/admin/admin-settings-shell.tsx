"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Cloud, CreditCard, Crosshair, LayoutGrid, Link2, Mail, ScrollText, Settings, UserCog, Webhook } from "lucide-react";
import { AdminPreferencesForm } from "@/components/admin/admin-preferences-form";
import { PlatformSettingsForm } from "@/components/forms/platform-settings-form";
import { SmtpSettingsForm } from "@/components/forms/smtp-settings-form";
import { MailgunMarketingInfo } from "@/components/admin/mailgun-marketing-info";
import { EmailMarketingConfigForm } from "@/components/admin/email-marketing-config-form";
import { StripeSettingsForm } from "@/components/forms/stripe-settings-form";
import { PixelSettingsForm } from "@/components/forms/pixel-settings-form";
import { ClickFunnelsWebhookSettingsForm } from "@/components/admin/clickfunnels-webhook-settings";
import { AdminGlobalPostbackForm } from "@/components/admin/admin-global-postback-form";
import { OgadsOfferWallSettingsForm } from "@/components/admin/ogads-offer-wall-settings";
import { EmailLogsTable } from "@/components/admin/email-logs-table";
import { PageSection } from "@/components/admin/page-section";
import { cn } from "@/lib/utils";

type SectionId =
  | "preferences"
  | "payout"
  | "payments"
  | "pixels"
  | "webhooks"
  | "cpa-postback"
  | "offer-wall"
  | "email"
  | "email-marketing"
  | "email-log";

type SectionItem = {
  id: SectionId;
  label: string;
  icon: LucideIcon;
  title: string;
  description: string;
  gradient: "revenue" | "leads" | "approved";
};

const SECTIONS: SectionItem[] = [
  {
    id: "preferences",
    label: "Timezone",
    icon: UserCog,
    title: "Timezone",
    description: "Personal display settings for your admin account",
    gradient: "approved",
  },
  {
    id: "payout",
    label: "Payout & Links",
    icon: Settings,
    title: "Payout & Smart Link Fallback",
    description: "Publisher earnings, tier ranges, and global campaign routing",
    gradient: "revenue",
  },
  {
    id: "payments",
    label: "Payments",
    icon: CreditCard,
    title: "Payments (Stripe)",
    description: "Credit card checkout for advertiser wallet top-ups",
    gradient: "revenue",
  },
  {
    id: "pixels",
    label: "Pixel Setting",
    icon: Crosshair,
    title: "Pixel Setting",
    description: "Facebook Pixel and Google Ads conversion tracking for landing pages",
    gradient: "leads",
  },
  {
    id: "webhooks",
    label: "Digital Webhook",
    icon: Webhook,
    title: "Digital Webhook",
    description:
      "One global ClickFunnels webhook — no per-product or per-offer configuration required",
    gradient: "leads",
  },
  {
    id: "cpa-postback",
    label: "CPA Postback",
    icon: Link2,
    title: "CPA Postback",
    description:
      "Network conversion postback for CPA offers — security key, parallel URL, and test fire",
    gradient: "leads",
  },
  {
    id: "offer-wall",
    label: "Offer Wall",
    icon: LayoutGrid,
    title: "Offer Wall",
    description: "OGAds Offer API key and postback URL for the affiliate Offer Wall",
    gradient: "leads",
  },
  {
    id: "email",
    label: "Email (SMTP)",
    icon: Mail,
    title: "Email (SMTP)",
    description:
      "Transactional mail — verification, welcome, password reset. Test delivery.",
    gradient: "leads",
  },
  {
    id: "email-marketing",
    label: "Email Marketing",
    icon: Cloud,
    title: "Email Marketing (Mailgun)",
    description:
      "Advertiser broadcasts and automations — delivery webhooks and Mailgun env setup",
    gradient: "leads",
  },
  {
    id: "email-log",
    label: "Recent email log",
    icon: ScrollText,
    title: "Recent email log",
    description: "Delivery history for transactional and platform emails",
    gradient: "approved",
  },
];

function isSectionId(value: string | null): value is SectionId {
  return SECTIONS.some((section) => section.id === value);
}

export function AdminSettingsShell({ initialTimezone }: { initialTimezone: string }) {
  const searchParams = useSearchParams();
  const requested = searchParams.get("section");
  const activeId: SectionId = isSectionId(requested) ? requested : "preferences";
  const active = SECTIONS.find((section) => section.id === activeId) ?? SECTIONS[0];

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <nav aria-label="Settings sections" className="shrink-0 lg:sticky lg:top-6 lg:w-56">
        <div className="mb-2 flex items-center gap-2 px-1 lg:mb-3">
          <Settings className="h-4 w-4 text-[var(--theme-primary)]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Sections
          </span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            const activeSection = section.id === activeId;
            return (
              <Link
                key={section.id}
                href={`/admin/settings?section=${section.id}`}
                className={cn(
                  "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  activeSection
                    ? "bg-[var(--theme-primary-soft)] text-[var(--theme-primary)]"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">{section.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="min-w-0 flex-1">
        <PageSection
          title={active.title}
          description={active.description}
          icon={active.icon}
          gradient={active.gradient}
        >
          <div className="p-6">
            {activeId === "preferences" && (
              <AdminPreferencesForm initialTimezone={initialTimezone} />
            )}
            {activeId === "payout" && <PlatformSettingsForm />}
            {activeId === "payments" && <StripeSettingsForm />}
            {activeId === "pixels" && <PixelSettingsForm />}
            {activeId === "webhooks" && <ClickFunnelsWebhookSettingsForm />}
            {activeId === "cpa-postback" && <AdminGlobalPostbackForm embedded />}
            {activeId === "offer-wall" && <OgadsOfferWallSettingsForm />}
            {activeId === "email" && <SmtpSettingsForm />}
            {activeId === "email-marketing" && (
              <div className="space-y-10">
                <EmailMarketingConfigForm />
                <div className="border-t border-border pt-8">
                  <MailgunMarketingInfo />
                </div>
              </div>
            )}
            {activeId === "email-log" && <EmailLogsTable />}
          </div>
        </PageSection>
      </div>
    </div>
  );
}
