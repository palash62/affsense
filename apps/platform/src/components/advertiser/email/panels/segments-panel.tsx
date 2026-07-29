"use client";

import Link from "next/link";
import { Filter, Users } from "lucide-react";
import { PageSection } from "@/components/admin/page-section";
import { EmailModuleShell } from "../email-module-shell";
import { EmailEmptyState } from "../email-empty-state";

export function SegmentsPanel() {
  return (
    <EmailModuleShell
      title="Segments"
      description="Dynamic audience segments based on subscriber attributes."
      breadcrumbs={[
        { label: "Autoresponder", href: "/advertiser/email" },
        { label: "Segments" },
      ]}
      showToolbar={false}
    >
      <PageSection title="Audience Segments" icon={Filter} gradient="approved">
        <div className="px-6 pb-6">
          <EmailEmptyState
            icon={Users}
            title="Segments are built from subscriber filters"
            description="Use the Subscribers page to filter by status, campaign source, or date range. Segment functionality will be expanded in a future update."
          />
          <div className="mt-4 text-center">
            <Link
              href="/advertiser/email/subscribers"
              className="text-sm font-medium text-[var(--theme-primary)] hover:underline"
            >
              Go to Subscribers
            </Link>
          </div>
        </div>
      </PageSection>
    </EmailModuleShell>
  );
}
