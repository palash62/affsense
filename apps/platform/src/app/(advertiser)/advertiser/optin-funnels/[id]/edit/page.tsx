"use client";

import { Suspense } from "react";
import { OptinFunnelBuilderPage } from "@/components/advertiser/optin-funnel-builder-page";
import { useParams } from "next/navigation";

function OptinFunnelEditContent() {
  const params = useParams();
  const funnelId = params.id as string;
  return <OptinFunnelBuilderPage funnelId={funnelId} />;
}

export default function OptinFunnelEditPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Loading editor...
        </div>
      }
    >
      <OptinFunnelEditContent />
    </Suspense>
  );
}
