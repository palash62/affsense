"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  MoreHorizontal,
  Eye,
  CheckCircle,
  Ban,
  Trash2,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AdminDeleteUserDialog } from "@/components/admin/admin-delete-user-dialog";
import type { UserStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

type AdvertiserForMenu = {
  id: string;
  name: string;
  email: string;
  status: UserStatus;
  emailVerified: Date | string | null;
};

type AdvertiserActionsMenuProps = {
  advertiser: AdvertiserForMenu;
  deleteDisabledReason?: string;
};

export function AdvertiserActionsMenu({
  advertiser,
  deleteDisabledReason,
}: AdvertiserActionsMenuProps) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [statusLoading, setStatusLoading] = useState<UserStatus | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [statusError, setStatusError] = useState("");

  const status = advertiser.status;
  const emailVerified = Boolean(advertiser.emailVerified);
  const canChangeStatus = !(status === "PENDING" && !emailVerified);

  async function updateStatus(next: UserStatus) {
    if (statusLoading) return;
    setStatusLoading(next);
    setStatusError("");
    try {
      const res = await fetch("/api/v1/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: advertiser.id, status: next }),
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

  async function resendVerification() {
    if (resendLoading || emailVerified) return;
    setResendLoading(true);
    setStatusError("");
    try {
      const res = await fetch(`/api/v1/admin/advertisers/${advertiser.id}/resend-verification`, {
        method: "POST",
        cache: "no-store",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setStatusError(data.error?.message ?? "Failed to resend verification");
        return;
      }
      router.refresh();
    } finally {
      setResendLoading(false);
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
            onClick={() => router.push(`/admin/advertisers/${advertiser.id}`)}
          >
            <Eye className="h-4 w-4" />
            View profile
          </DropdownMenuItem>

          {!emailVerified && status !== "SUSPENDED" ? (
            <DropdownMenuItem
              disabled={resendLoading}
              onClick={() => void resendVerification()}
            >
              <Mail className="h-4 w-4" />
              {resendLoading ? "Sending..." : "Resend verification"}
            </DropdownMenuItem>
          ) : null}

          <DropdownMenuSeparator />

          <DropdownMenuItem
            disabled={!canChangeStatus || status === "ACTIVE" || statusLoading !== null}
            onClick={() => void updateStatus("ACTIVE")}
            className={cn(status === "ACTIVE" && "opacity-40")}
          >
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            {statusLoading === "ACTIVE" ? "Activating..." : "Activate"}
          </DropdownMenuItem>

          <DropdownMenuItem
            disabled={!canChangeStatus || status === "SUSPENDED" || statusLoading !== null}
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

      {statusError ? (
        <p className="mt-1 text-right text-xs text-red-500">{statusError}</p>
      ) : null}

      <AdminDeleteUserDialog
        userId={advertiser.id}
        userName={advertiser.name}
        role="ADVERTISER"
        disabledReason={deleteDisabledReason}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  );
}
