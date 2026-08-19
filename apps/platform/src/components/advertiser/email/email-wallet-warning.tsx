"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { AlertTriangle } from "lucide-react";
import { isAutoresponderDemoAdvertiser } from "@/lib/autoresponder-access";

type WalletSnapshot = {
  emailsRemaining?: number;
  emailWalletBalance?: number;
  emailsPerDollar?: number;
};

/**
 * Amber banner when Autoresponder wallet cannot fund another send.
 * Hidden for the demo advertiser (wallet not required).
 */
export function EmailWalletWarningBanner() {
  const { data: session } = useSession();
  const [wallet, setWallet] = useState<WalletSnapshot | null>(null);

  const isDemo = isAutoresponderDemoAdvertiser(session?.user?.email);

  useEffect(() => {
    if (isDemo) return;
    let cancelled = false;
    fetch("/api/v1/advertiser/email/stats?activityLimit=1")
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        setWallet({
          emailsRemaining: j.data?.emailsRemaining,
          emailWalletBalance: j.data?.emailWalletBalance,
          emailsPerDollar: j.data?.emailsPerDollar,
        });
      })
      .catch(() => {
        if (!cancelled) setWallet(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isDemo]);

  if (isDemo || !wallet) return null;

  const remaining = wallet.emailsRemaining ?? 0;
  if (remaining > 0) return null;

  return (
    <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <p>
        Autoresponder wallet balance is too low to send emails.{" "}
        <Link
          href="/advertiser/email/wallet"
          className="font-medium underline underline-offset-2 hover:text-amber-950"
        >
          Top up wallet
        </Link>{" "}
        to continue.
      </p>
    </div>
  );
}
