"use client";

import Link from "next/link";
import { GitBranch } from "lucide-react";
import { EmailModuleShell } from "../email-module-shell";
import { EmailEmptyState } from "../email-empty-state";

export function SequencesPanel() {
  return (
    <EmailModuleShell
      title="Sequences"
      description="Sequences are managed through the Automations builder."
      breadcrumbs={[
        { label: "Autoresponder", href: "/advertiser/email" },
        { label: "Sequences" },
      ]}
      showToolbar={false}
    >
      <EmailEmptyState
        icon={GitBranch}
        title="Sequences are now part of Automations"
        description="Build multi-step drip sequences using the visual automation builder."
      />
      <div className="mt-4 text-center">
        <Link
          href="/advertiser/email/automations"
          className="text-sm font-medium text-[var(--theme-primary)] hover:underline"
        >
          Go to Automations
        </Link>
      </div>
    </EmailModuleShell>
  );
}
