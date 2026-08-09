"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Ban, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { UserStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

export function StaffUserStatusActions({
  userId,
  currentStatus,
}: {
  userId: string;
  currentStatus: UserStatus;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState<UserStatus | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setStatus(currentStatus);
  }, [currentStatus, userId]);

  async function updateStatus(next: "ACTIVE" | "SUSPENDED") {
    if (status === next || loading) return;
    setLoading(next);
    setError("");
    try {
      const res = await fetch(`/api/v1/admin/staff-users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
        cache: "no-store",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error?.message ?? "Failed to update status");
        return;
      }
      setStatus(next);
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <Button
          size="sm"
          variant="outline"
          disabled={status === "ACTIVE" || loading !== null}
          onClick={() => void updateStatus("ACTIVE")}
          className={cn(
            "h-8 gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50",
            status === "ACTIVE" && "opacity-50",
          )}
        >
          <CheckCircle className="h-3.5 w-3.5" />
          {loading === "ACTIVE" ? "..." : "Activate"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={status === "SUSPENDED" || loading !== null}
          onClick={() => void updateStatus("SUSPENDED")}
          className={cn(
            "h-8 gap-1 border-red-200 text-red-700 hover:bg-red-50",
            status === "SUSPENDED" && "opacity-50",
          )}
        >
          <Ban className="h-3.5 w-3.5" />
          {loading === "SUSPENDED" ? "..." : "Deactivate"}
        </Button>
      </div>
      {error ? <p className="text-xs text-red-500">{error}</p> : null}
    </div>
  );
}
