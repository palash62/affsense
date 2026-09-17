"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { AdminFunnelTemplateBuilderPage } from "@/components/admin/admin-funnel-template-builder-page";
import { PageHeader } from "@/components/layout/page-header";

const slimHeaderClass =
  "space-y-1.5 [&_.premium-page-title]:text-base [&_.premium-page-title]:font-semibold";

function BuilderChrome({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="shrink-0 border-b border-border bg-background px-4 py-2.5">
        <PageHeader
          title={title}
          className={slimHeaderClass}
          breadcrumbs={[
            { label: "Admin", href: "/admin" },
            { label: "Funnel Templates", href: "/admin/funnel-templates" },
            { label: "Edit" },
          ]}
        />
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </>
  );
}

function AdminFunnelTemplateEditContent() {
  const params = useParams();
  const templateId = params.id as string;
  return (
    <BuilderChrome title="Edit template">
      <AdminFunnelTemplateBuilderPage templateId={templateId} />
    </BuilderChrome>
  );
}

export default function AdminFunnelTemplateEditPage() {
  return (
    <Suspense
      fallback={
        <BuilderChrome title="Edit template">
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Loading editor...
          </div>
        </BuilderChrome>
      }
    >
      <AdminFunnelTemplateEditContent />
    </Suspense>
  );
}
