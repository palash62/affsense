import { Suspense } from "react";
import { RegisterForm } from "./register-form";
import { PromotionAttributionCapture } from "@/modules/marketing/components/promotion-attribution-capture";

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-slate-500">Loading...</div>}>
      <PromotionAttributionCapture />
      <RegisterForm />
    </Suspense>
  );
}
