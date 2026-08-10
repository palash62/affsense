"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdvertiserLeadSort } from "@/services/lead.service";

const SORT_MAP: Record<string, { asc: AdvertiserLeadSort; desc: AdvertiserLeadSort }> = {
  at: { asc: "created_asc", desc: "created_desc" },
  campaignId: { asc: "campaignId_asc", desc: "campaignId_desc" },
  campaign: { asc: "campaign_asc", desc: "campaign_desc" },
  logData: { asc: "logData_asc", desc: "logData_desc" },
  status: { asc: "status_asc", desc: "status_desc" },
  message: { asc: "message_asc", desc: "message_desc" },
};

export function AdvertiserLeadsSortHeader({
  field,
  label,
  align = "left",
}: {
  field: keyof typeof SORT_MAP;
  label: string;
  align?: "left" | "right" | "center";
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("sort") ?? "created_desc";
  const { asc, desc } = SORT_MAP[field];

  const isAsc = current === asc;
  const isDesc = current === desc;
  const active = isAsc || isDesc;
  const nextSort = isAsc ? desc : asc;

  const params = new URLSearchParams(searchParams.toString());
  params.set("sort", nextSort);
  params.delete("page");

  const alignClass =
    align === "right" ? "justify-end text-right" : align === "center" ? "justify-center text-center" : "";

  return (
    <Link
      href={`${pathname}?${params.toString()}`}
      className={cn(
        "inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground",
        alignClass,
        active && "text-[var(--theme-primary)]",
      )}
    >
      {label}
      {active ? (
        isAsc ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
      )}
    </Link>
  );
}
