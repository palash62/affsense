"use client";

import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";

type FunnelModuleShellProps = {
  title: string;
  description: string;
  action?: ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  children: ReactNode;
};

export function FunnelModuleShell({
  title,
  description,
  action,
  breadcrumbs,
  children,
}: FunnelModuleShellProps) {
  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={description}
        breadcrumbs={
          breadcrumbs ?? [
            { label: "Advertiser", href: "/advertiser" },
            { label: "Funnels", href: "/advertiser/funnels" },
            { label: title },
          ]
        }
      >
        {action}
      </PageHeader>
      {children}
    </div>
  );
}
