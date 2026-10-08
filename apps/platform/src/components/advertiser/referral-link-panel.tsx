"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Gift, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildPublisherReferralUrl, buildReferralUrl } from "@/lib/referral";

type ReferralLinkVariant = "advertiser" | "publisher";

const DEFAULT_DESCRIPTION =
  "Refer & earn passive income. Share this link — when users sign up and spend on ads, you earn commissions on 2 levels.";

function referralPath(variant: ReferralLinkVariant, referralCode: string) {
  const code = encodeURIComponent(referralCode);
  return variant === "publisher" ? `/register?referral_by=${code}` : `/?referral_by=${code}`;
}

export function ReferralLinkPanel({
  referralCode,
  variant = "advertiser",
  description = DEFAULT_DESCRIPTION,
}: {
  referralCode: string;
  variant?: ReferralLinkVariant;
  description?: string;
}) {
  const [copied, setCopied] = useState(false);
  const buildUrl = variant === "publisher" ? buildPublisherReferralUrl : buildReferralUrl;
  // Resolve origin after mount so server and client render the same markup.
  const [referralUrl, setReferralUrl] = useState(() => referralPath(variant, referralCode));

  useEffect(() => {
    setReferralUrl(buildUrl(window.location.origin, referralCode));
  }, [buildUrl, referralCode]);

  async function copyLink() {
    const url = buildUrl(window.location.origin, referralCode);
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-5">
      <div
        className="rounded-xl border px-4 py-4"
        style={{
          borderColor: "color-mix(in srgb, var(--theme-primary) 20%, transparent)",
          background: "var(--theme-primary-soft)",
        }}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card shadow-sm">
            <Gift className="h-5 w-5 text-[var(--theme-primary)]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Your unique referral link</p>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            <p className="mt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Referral code: <span className="text-[var(--theme-primary)]">{referralCode}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          readOnly
          value={referralUrl}
          aria-label="Referral link"
          className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-card px-4 text-sm text-foreground shadow-sm"
        />
        <Button
          onClick={copyLink}
          className="h-11 shrink-0 gap-2 rounded-xl bg-[var(--theme-primary)] px-5 hover:opacity-90"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied!" : "Copy Link"}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-9 gap-2 rounded-lg border-border"
          onClick={copyLink}
        >
          <Share2 className="h-4 w-4" />
          Share link
        </Button>
        <a
          href={referralPath(variant, referralCode)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted"
        >
          <ExternalLink className="h-4 w-4" />
          {variant === "publisher" ? "Preview sign-up page" : "Preview landing page"}
        </a>
      </div>
    </div>
  );
}
