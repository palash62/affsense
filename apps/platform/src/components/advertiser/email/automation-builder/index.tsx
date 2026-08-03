"use client";

import { useState } from "react";
import { AutomationCreateForm } from "./automation-create-form";
import { AutomationBuilderShell } from "./automation-builder-shell";
import type { EmailListOption, Trigger } from "./types";

type Props = {
  lists: EmailListOption[];
};

export function NewAutomationExperience({ lists }: Props) {
  const [seed, setSeed] = useState<{ name: string; trigger: Trigger } | null>(null);

  if (!seed) {
    return (
      <div className="py-6">
        <AutomationCreateForm onContinue={setSeed} />
      </div>
    );
  }

  return <AutomationBuilderShell lists={lists} initialCreate={seed} />;
}
