"use client";

import { Suspense } from "react";
import { OptinFunnelBuilderPage } from "@/components/advertiser/optin-funnel-builder-page";
import { PageHeader } from "@/components/layout/page-header";
import { useParams } from "next/navigation";

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
            { label: "Advertiser", href: "/advertiser" },
            { label: "Funnels", href: "/advertiser/optin-funnels" },
            { label: "Edit" },
          ]}
        />
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </>
  );
}

function OptinFunnelEditContent() {
  const params = useParams();
  const funnelId = params.id as string;
  return (
    <BuilderChrome title="Edit funnel">
      <OptinFunnelBuilderPage funnelId={funnelId} />
    </BuilderChrome>
  );
}

export default function OptinFunnelEditPage() {
  return (
    <Suspense
      fallback={
        <BuilderChrome title="Edit funnel">
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Loading editor...
          </div>
        </BuilderChrome>
      }
    >
      <OptinFunnelEditContent />
    </Suspense>
  );
}
