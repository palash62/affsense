"use client";

import { Settings } from "lucide-react";
import { EmailSettingsPanel } from "../email-settings-panel";
import { EmailModuleShell } from "../email-module-shell";

export function SettingsPagePanel() {
  return (
    <EmailModuleShell
      title="Settings"
      description="General email settings and default sender details."
      breadcrumbs={[
        { label: "Autoresponder", href: "/advertiser/email" },
        { label: "Settings" },
      ]}
      showToolbar={false}
    >
      <EmailSettingsPanel />
    </EmailModuleShell>
  );
}
