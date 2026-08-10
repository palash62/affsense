"use client";

import { cn } from "@/lib/utils";

export function CpaOfferThumb({
  name,
  thumbnailUrl,
  className,
  size = "md",
}: {
  name: string;
  thumbnailUrl?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const letter = (name.trim()[0] || "?").toUpperCase();
  const dim =
    size === "sm" ? "h-8 w-8 text-xs" : size === "lg" ? "h-14 w-14 text-lg" : "h-10 w-10 text-sm";

  if (thumbnailUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={thumbnailUrl}
        alt=""
        className={cn(
          "shrink-0 rounded-md border border-border bg-muted object-cover",
          dim,
          className,
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md border border-border bg-sky-50 font-semibold text-sky-800",
        dim,
        className,
      )}
      aria-hidden
    >
      {letter}
    </div>
  );
}

export function CpaOfferStatusDot({ status }: { status: string }) {
  const active = status === "ACTIVE";
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 shrink-0 rounded-full",
        active ? "bg-emerald-500" : "bg-slate-300",
      )}
      title={status}
    />
  );
}
