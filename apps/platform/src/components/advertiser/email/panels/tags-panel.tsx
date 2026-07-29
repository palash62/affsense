"use client";

import { Tags } from "lucide-react";
import { PageSection } from "@/components/admin/page-section";
import { EmailModuleShell } from "../email-module-shell";
import { EmailEmptyState } from "../email-empty-state";

export function TagsPanel() {
  return (
    <EmailModuleShell
      title="Tags"
      description="Label subscribers with tags for flexible segmentation and targeting."
      breadcrumbs={[
        { label: "Autoresponder", href: "/advertiser/email" },
        { label: "Tags" },
      ]}
      showToolbar={false}
    >
      <PageSection title="Subscriber Tags" icon={Tags} gradient="revenue">
        <div className="px-6 pb-6">
          <EmailEmptyState
            icon={Tags}
            title="No tags yet"
            description="Tags will be available when subscriber import and API tagging features are added. Subscribers are currently auto-created from your lead campaigns."
          />
        </div>
      </PageSection>
    </EmailModuleShell>
  );
}
