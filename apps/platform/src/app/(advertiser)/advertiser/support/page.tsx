export const dynamic = "force-dynamic";

import { Info, MessageSquarePlus } from "lucide-react";
import { SupportTicketsPanel } from "@/components/support/support-tickets-panel";
import { RoleHero } from "@/components/layout/role-hero";

export default function AdvertiserSupportPage() {
  return (
    <div className="space-y-7">
      <RoleHero
        eyebrow="Advertiser Portal"
        title="Support"
        description="Get help with campaigns, billing, and your account. Our team will reply directly on your tickets."
        action={{ label: "New Ticket", href: "#new-ticket", icon: MessageSquarePlus }}
      />

      <div
        className="flex gap-3 rounded-xl border px-4 py-3 text-sm text-foreground"
        style={{
          borderColor: "color-mix(in srgb, var(--theme-primary) 20%, transparent)",
          background: "var(--theme-primary-soft)",
        }}
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--theme-primary)]" />
        <p>
          Submit a ticket below and track replies in the conversation thread. When support responds,
          you will see their message highlighted in the ticket details. Click a row to expand and
          reply.
        </p>
      </div>

      <SupportTicketsPanel />
    </div>
  );
}
