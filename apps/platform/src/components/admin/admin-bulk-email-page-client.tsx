"use client";

import { useState } from "react";
import { AdminBulkEmailForm } from "@/components/admin/admin-bulk-email-form";
import { AdminBulkEmailReport } from "@/components/admin/admin-bulk-email-report";

export function AdminBulkEmailPageClient() {
  const [reportRefreshKey, setReportRefreshKey] = useState(0);

  return (
    <div className="space-y-7">
      <AdminBulkEmailForm onSent={() => setReportRefreshKey((k) => k + 1)} />
      <AdminBulkEmailReport refreshKey={reportRefreshKey} />
    </div>
  );
}
