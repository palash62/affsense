"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  readPromotionAttributionFromUrl,
  writePromotionAttributionCookie,
} from "@/lib/promotion-attribution";

export function PromotionAttributionCapture() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const fromUrl = readPromotionAttributionFromUrl(searchParams.toString());
    if (fromUrl.utmSource || fromUrl.utmMedium || fromUrl.utmCampaign) {
      writePromotionAttributionCookie(fromUrl);
    }
  }, [searchParams]);

  return null;
}
