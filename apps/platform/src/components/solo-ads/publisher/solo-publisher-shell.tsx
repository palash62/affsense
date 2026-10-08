import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { PUBLISHER_SOLO_NAV } from "@/components/solo-ads/solo-shared";
import { SoloSubNav } from "@/components/solo-ads/solo-ui";

export function SoloPublisherShell({
  title,
  description,
  actions,
  crumbs,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  crumbs?: Array<{ label: string; href?: string }>;
  children: ReactNode;
}) {
  return (
    <div className="space-y-5">
      <PageHeader
        title={title}
        description={description}
        breadcrumbs={[
          { label: "Solo Ads", href: "/publisher/solo-ads" },
          ...(crumbs ?? (title === "Solo Ads" ? [] : [{ label: title }])),
        ]}
      >
        {actions}
      </PageHeader>
      <SoloSubNav items={PUBLISHER_SOLO_NAV} />
      {children}
    </div>
  );
}
