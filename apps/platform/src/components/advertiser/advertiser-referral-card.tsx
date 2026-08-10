"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Copy, Gift, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { REFERRAL_RATES_SUMMARY, buildReferralUrl } from "@/lib/referral";

export function AdvertiserReferralCard({ referralCode }: { referralCode: string }) {
  const [copied, setCopied] = useState(false);
  // Resolve origin after mount so server and client render the same markup.
  const [referralUrl, setReferralUrl] = useState(
    () => `/?referral_by=${encodeURIComponent(referralCode)}`,
  );

  useEffect(() => {
    setReferralUrl(buildReferralUrl(window.location.origin, referralCode));
  }, [referralCode]);

  async function copyLink() {
    const url = buildReferralUrl(window.location.origin, referralCode);
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="premium-card overflow-hidden">
      <div className="h-1" style={{ background: "var(--theme-gradient-approved)" }} />
      <div className="p-5">
        <div className="mb-4 flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl shadow-sm"
            style={{ background: "var(--theme-primary-soft)" }}
          >
            <Gift className="h-5 w-5 text-[var(--theme-primary)]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Your Referral Link</h3>
            <p className="text-xs text-muted-foreground">{REFERRAL_RATES_SUMMARY}</p>
          </div>
        </div>

        <div
          className="mb-4 rounded-xl border p-3"
          style={{
            borderColor: "color-mix(in srgb, var(--theme-primary) 20%, transparent)",
            background: "var(--theme-primary-soft)",
          }}
        >
          <p className="text-xs font-medium text-foreground">Refer &amp; earn passive income</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Share your link. When referrals sign up and spend on ads, you earn recurring commissions.
          </p>
        </div>

        <div className="flex gap-2">
          <input
            readOnly
            value={referralUrl}
            className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-card px-3 text-xs text-muted-foreground"
          />
          <Button
            size="sm"
            onClick={copyLink}
            className="h-9 shrink-0 gap-1 bg-[var(--theme-primary)] hover:opacity-90"
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>

        <Link
          href="/advertiser/referal_link"
          className="mt-4 flex items-center justify-center gap-1 text-sm font-medium text-[var(--theme-primary)] hover:underline"
        >
          View referral program
          <ArrowRight className="h-4 w-4" />
        </Link>

        <div
          className="mt-4 flex gap-2 rounded-lg border p-3"
          style={{
            borderColor: "color-mix(in srgb, var(--theme-primary) 15%, transparent)",
            background: "color-mix(in srgb, var(--theme-primary-soft) 60%, white)",
          }}
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--theme-primary)]" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Copy and share on social media, email, or your website to invite new users.
          </p>
        </div>
      </div>
    </div>
  );
}
