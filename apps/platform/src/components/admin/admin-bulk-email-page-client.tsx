"use client";

import { useState } from "react";
import { AdminBulkEmailForm } from "@/components/admin/admin-bulk-email-form";
import { AdminBulkEmailReport } from "@/components/admin/admin-bulk-email-report";
import { PageHeader } from "@/components/layout/page-header";

export function AdminBulkEmailPageClient() {
  const [reportRefreshKey, setReportRefreshKey] = useState(0);

  return (
    <div className="space-y-7">
      <PageHeader
        title="Bulk Email"
        description="Send bulk emails and review delivery reports."
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Bulk Email" },
        ]}
      />

      <AdminBulkEmailForm onSent={() => setReportRefreshKey((k) => k + 1)} />
      <AdminBulkEmailReport refreshKey={reportRefreshKey} />
    </div>
  );
}
