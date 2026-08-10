"use client";

import { FolderLock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DashboardCard, DashboardCardTitle } from "@/components/admin/affsense-dashboard/dashboard-card";

export function PromoMaterialsPanel() {
  return (
    <DashboardCard>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          <FolderLock className="h-5 w-5 text-muted-foreground" />
        </span>
        <div>
          <DashboardCardTitle>Promo Materials</DashboardCardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Add banners, email swipes, and landing page assets for affiliates.
          </p>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        className="mt-4 h-10 w-full rounded-xl border-border"
        onClick={() => toast.info("Promo materials module coming soon")}
      >
        Manage Promo Materials
      </Button>
    </DashboardCard>
  );
}
