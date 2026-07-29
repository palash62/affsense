"use client";

import Link from "next/link";
import { FormInput, Users } from "lucide-react";
import { PageSection } from "@/components/admin/page-section";
import { EmailModuleShell } from "../email-module-shell";
import { EmailEmptyState } from "../email-empty-state";

export function FormsPanel() {
  return (
    <EmailModuleShell
      title="Forms"
      description="How subscribers are added to your autoresponder."
      breadcrumbs={[
        { label: "Autoresponder", href: "/advertiser/email" },
        { label: "Forms" },
      ]}
      showToolbar={false}
    >
      <PageSection title="Subscriber Sources" icon={FormInput} gradient="revenue">
        <div className="px-6 pb-6">
          <EmailEmptyState
            icon={Users}
            title="Subscribers are added automatically"
            description="When leads are captured from your campaigns, they are automatically added as email subscribers and trigger any active automations."
          />
          <div className="mt-4 flex justify-center gap-4">
            <Link
              href="/advertiser/email/automations"
              className="text-sm font-medium text-[var(--theme-primary)] hover:underline"
            >
              Manage Automations
            </Link>
            <Link
              href="/advertiser/email/subscribers"
              className="text-sm font-medium text-[var(--theme-primary)] hover:underline"
            >
              View Subscribers
            </Link>
          </div>
        </div>
      </PageSection>
    </EmailModuleShell>
  );
}
