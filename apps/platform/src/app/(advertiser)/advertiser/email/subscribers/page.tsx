import { Suspense } from "react";
import { SubscribersPanel } from "@/components/advertiser/email/panels/subscribers-panel";

export default function SubscribersPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading subscribers…</div>}>
      <SubscribersPanel />
    </Suspense>
  );
}
