"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  MoreHorizontal,
  Eye,
  ClipboardList,
  DollarSign,
  Link2,
  CheckCircle,
  Ban,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AdminPublisherReviewDialog } from "@/components/admin/admin-publisher-review-dialog";
import { AdminPublisherSpecialPayoutDialog } from "@/components/admin/admin-publisher-special-payout-dialog";
import { AdminPublisherSmartLinkCampaignsDialog } from "@/components/admin/admin-publisher-smart-link-campaigns-dialog";
import { AdminDeleteUserDialog } from "@/components/admin/admin-delete-user-dialog";
import type { SmartLinkAllowlistCampaign } from "@/components/admin/admin-publisher-smart-link-campaigns-dialog";
import type { PublisherSpecialPayoutSettings } from "@/components/admin/admin-publisher-special-payout-dialog";
import type { UserStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

type PublisherProfile = {
  website?: string | null;
  trafficSource?: string | null;
  country?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  rejectionReason?: string | null;
  rejectedAt?: string | Date | null;
  kycStatus?: string | null;
  qualityScore?: number | null;
  spamScore?: number | null;
  fraudFlags?: number | null;
  restrictSmartLinkCampaigns?: boolean;
} & PublisherSpecialPayoutSettings;

type PublisherForMenu = {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  createdAt: string | Date;
  publisherProfile?: PublisherProfile | null;
  allowedSmartLinkCampaignIds: string[];
};

type PublisherActionsMenuProps = {
  publisher: PublisherForMenu;
  campaigns: SmartLinkAllowlistCampaign[];
  deleteDisabledReason?: string;
};

export function PublisherActionsMenu({
  publisher,
  campaigns,
  deleteDisabledReason,
}: PublisherActionsMenuProps) {
  const router = useRouter();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [payoutOpen, setPayoutOpen] = useState(false);
  const [smartLinkOpen, setSmartLinkOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [statusLoading, setStatusLoading] = useState<UserStatus | null>(null);
  const [statusError, setStatusError] = useState("");

  const status = publisher.status;
  const profile = publisher.publisherProfile;

  async function updateStatus(next: UserStatus) {
    if (statusLoading) return;
    setStatusLoading(next);
    setStatusError("");
    try {
      const res = await fetch("/api/v1/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: publisher.id, status: next }),
        cache: "no-store",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setStatusError(data.error?.message ?? "Failed to update status");
        return;
      }
      router.refresh();
    } finally {
      setStatusLoading(null);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              title="More actions"
            />
          }
        >
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="bottom">
          <DropdownMenuItem
            onClick={() => router.push(`/admin/publishers/${publisher.id}`)}
          >
            <Eye className="h-4 w-4" />
            View profile
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={() => setReviewOpen(true)}>
            <ClipboardList className="h-4 w-4" />
            Review
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setPayoutOpen(true)}>
            <DollarSign className="h-4 w-4" />
            Special payout
          </DropdownMenuItem>

          <DropdownMenuItem onClick={() => setSmartLinkOpen(true)}>
            <Link2 className="h-4 w-4" />
            Smart Link campaigns
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            disabled={status === "ACTIVE" || statusLoading !== null}
            onClick={() => void updateStatus("ACTIVE")}
            className={cn(status === "ACTIVE" && "opacity-40")}
          >
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            {statusLoading === "ACTIVE" ? "Activating..." : "Activate"}
          </DropdownMenuItem>

          <DropdownMenuItem
            disabled={status === "SUSPENDED" || statusLoading !== null}
            onClick={() => void updateStatus("SUSPENDED")}
            className={cn(status === "SUSPENDED" && "opacity-40")}
          >
            <Ban className="h-4 w-4 text-red-600" />
            {statusLoading === "SUSPENDED" ? "Blocking..." : "Block"}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            variant="destructive"
            disabled={Boolean(deleteDisabledReason)}
            title={deleteDisabledReason}
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {statusError && (
        <p className="mt-1 text-right text-xs text-red-500">{statusError}</p>
      )}

      <AdminPublisherReviewDialog
        publisher={{
          id: publisher.id,
          name: publisher.name,
          email: publisher.email,
          status: publisher.status,
          createdAt: publisher.createdAt,
          publisherProfile: profile,
        }}
        open={reviewOpen}
        onOpenChange={setReviewOpen}
      />

      <AdminPublisherSpecialPayoutDialog
        publisherId={publisher.id}
        publisherName={publisher.name}
        settings={{
          useSpecialTierPayouts: profile?.useSpecialTierPayouts ?? false,
          tier1SpecialPayout: profile?.tier1SpecialPayout ?? null,
          tier2SpecialPayout: profile?.tier2SpecialPayout ?? null,
          tier3SpecialPayout: profile?.tier3SpecialPayout ?? null,
        }}
        open={payoutOpen}
        onOpenChange={setPayoutOpen}
      />

      <AdminPublisherSmartLinkCampaignsDialog
        publisherId={publisher.id}
        publisherName={publisher.name}
        restrictSmartLinkCampaigns={profile?.restrictSmartLinkCampaigns ?? false}
        selectedCampaignIds={publisher.allowedSmartLinkCampaignIds}
        campaigns={campaigns}
        open={smartLinkOpen}
        onOpenChange={setSmartLinkOpen}
      />

      <AdminDeleteUserDialog
        userId={publisher.id}
        userName={publisher.name}
        role="PUBLISHER"
        disabledReason={deleteDisabledReason}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  );
}
