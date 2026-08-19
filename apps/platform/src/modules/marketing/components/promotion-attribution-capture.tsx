"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  buildVisitDedupeKey,
  hasCoreUtmFields,
  readPromotionAttributionFromUrl,
  readPromoVisitCookie,
  writePromoUtmCookie,
  writePromoVisitCookie,
} from "@/lib/promotion-attribution";

export function PromotionAttributionCapture() {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  useEffect(() => {
    const search = searchParams.toString();
    const urlFields = readPromotionAttributionFromUrl(search ? `?${search}` : "");
    if (!hasCoreUtmFields(urlFields)) return;

    writePromoUtmCookie(urlFields);

    const dedupeKey = buildVisitDedupeKey(urlFields);
    if (readPromoVisitCookie() === dedupeKey) return;

    const landingUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}${pathname}${search ? `?${search}` : ""}`
        : null;

    void fetch("/api/v1/promo/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...urlFields,
        landingPath: pathname,
        landingUrl,
      }),
    })
      .then((res) => {
        if (res.ok || res.status === 204) {
          writePromoVisitCookie(dedupeKey);
        }
      })
      .catch(() => {
        // Non-blocking analytics capture
      });
  }, [pathname, searchParams]);

  return null;
}
