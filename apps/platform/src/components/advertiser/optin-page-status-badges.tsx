"use client";

import type { OptinPageContent } from "@/lib/optin-page";
import { Badge } from "@/components/ui/badge";
import { useCallback, useEffect, useState } from "react";

export function OptinPageStatusBadges({ initialPage }: { initialPage: OptinPageContent }) {
  const [page, setPage] = useState(initialPage);

  const refreshPage = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/advertiser/optin-page", { cache: "no-store" });
      const data = await res.json();
      if (data.page) {
        setPage(data.page);
      }
    } catch {
      // Keep existing badge data if refresh fails.
    }
  }, []);

  useEffect(() => {
    setPage(initialPage);
  }, [initialPage]);

  useEffect(() => {
    void refreshPage();
    const onFocus = () => void refreshPage();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshPage]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge
        variant="outline"
        className={
          page.isPublished
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-amber-200 bg-amber-50 text-amber-700"
        }
      >
        {page.isPublished ? "Published" : "Draft"}
      </Badge>
      <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
        {page.title}
      </Badge>
      <Badge variant="outline" className="border-border bg-muted text-muted-foreground capitalize">
        Template: {page.templateId}
      </Badge>
      <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
        /o/{page.slug}
      </Badge>
    </div>
  );
}
