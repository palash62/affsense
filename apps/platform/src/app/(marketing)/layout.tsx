import { Suspense } from "react";
import { ReferralCapture } from "@/modules/marketing/components/referral-capture";
import { PromotionAttributionCapture } from "@/modules/marketing/components/promotion-attribution-capture";

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <Suspense fallback={null}>
        <ReferralCapture />
        <PromotionAttributionCapture />
      </Suspense>
      {children}
    </>
  );
}
