"use client";

import { useEffect, useState } from "react";
import { FileText, Plus } from "lucide-react";
import { EmailTemplatesPanel } from "../email-templates-panel";
import { EmailModuleShell } from "../email-module-shell";

export function TemplatesPagePanel() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/v1/advertiser/email/stats")
      .then((r) => r.json())
      .then((j) => setCount(j.data?.totalTemplates ?? 0))
      .catch(() => {});
  }, []);

  return (
    <EmailModuleShell
      title="Templates"
      description="Create reusable emails with merge tags like {{first_name}}."
      breadcrumbs={[
        { label: "Autoresponder", href: "/advertiser/email" },
        { label: "Templates" },
      ]}
      stats={[
        { label: "Total Templates", value: count !== null ? count.toLocaleString() : "—", icon: FileText, accent: "purple" },
      ]}
      searchPlaceholder="Search templates…"
      primaryAction={{ label: "New Template", href: "/advertiser/email/templates/new", icon: Plus }}
    >
      <EmailTemplatesPanel />
    </EmailModuleShell>
  );
}
