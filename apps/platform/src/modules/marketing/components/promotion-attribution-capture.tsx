"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  markPromotionVisitRecorded,
  readPromotionAttributionFromUrl,
  shouldRecordPromotionVisit,
  writePromotionAttributionCookie,
} from "@/lib/promotion-attribution";

export function PromotionAttributionCapture() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const fromUrl = readPromotionAttributionFromUrl(searchParams.toString());
    if (fromUrl.utmSource || fromUrl.utmMedium || fromUrl.utmCampaign) {
      writePromotionAttributionCookie(fromUrl);

      if (!shouldRecordPromotionVisit(fromUrl)) return;

      const landingPath = window.location.pathname;
      const landingUrl = window.location.href;

      void fetch("/api/v1/promo/visit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...fromUrl,
          landingPath,
          landingUrl,
        }),
        keepalive: true,
      })
        .then((response) => {
          if (response.ok) markPromotionVisitRecorded(fromUrl);
        })
        .catch(() => {});
    }
  }, [searchParams]);

  return null;
}
