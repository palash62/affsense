import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { ADMIN_SOLO_NAV } from "@/components/solo-ads/solo-shared";
import { SoloSubNav } from "@/components/solo-ads/solo-ui";

export function SoloAdminShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-5">
      <PageHeader
        title={title}
        description={description}
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Solo Ads", href: "/admin/solo-ads" },
          ...(title === "Solo Ads" ? [] : [{ label: title }]),
        ]}
      >
        {actions}
      </PageHeader>
      <SoloSubNav items={ADMIN_SOLO_NAV} />
      {children}
    </div>
  );
}
