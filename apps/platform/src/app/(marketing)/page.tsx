import { redirect } from "next/navigation";
import { getDashboardPath } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { AffsensePremiumLandingPage } from "@/modules/marketing";

export const metadata = {
  title: "Affsense — One Free Account. Multiple Ways to Earn Online.",
  description:
    "Join Affsense free and access digital product commissions, CPA offers, paid tasks, Offer Wall opportunities and direct referral rewards from one dashboard.",
};

export default async function HomePage() {
  const session = await getSession();

  if (session?.user) {
    redirect(getDashboardPath(session.user.role));
  }

  return <AffsensePremiumLandingPage />;
}
