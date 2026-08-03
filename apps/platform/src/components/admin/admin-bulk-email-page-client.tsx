"use client";

import { useState } from "react";
import { PageHero } from "@/components/admin/page-hero";
import { AdminBulkEmailForm } from "@/components/admin/admin-bulk-email-form";
import { AdminBulkEmailReport } from "@/components/admin/admin-bulk-email-report";

export function AdminBulkEmailPageClient() {
  const [reportRefreshKey, setReportRefreshKey] = useState(0);

  return (
    <div className="space-y-7">
      <PageHero
        eyebrow="Communications"
        title="Bulk Email"
        description="Email one or many active advertisers or publishers from the admin panel."
      />
      <AdminBulkEmailForm onSent={() => setReportRefreshKey((k) => k + 1)} />
      <AdminBulkEmailReport refreshKey={reportRefreshKey} />
    </div>
  );
}
