"use client";

import { Suspense } from "react";
import { useParams } from "next/navigation";
import { AdminFunnelTemplateBuilderPage } from "@/components/admin/admin-funnel-template-builder-page";

function AdminFunnelTemplateEditContent() {
  const params = useParams();
  const templateId = params.id as string;
  return <AdminFunnelTemplateBuilderPage templateId={templateId} />;
}

export default function AdminFunnelTemplateEditPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Loading editor...
        </div>
      }
    >
      <AdminFunnelTemplateEditContent />
    </Suspense>
  );
}
