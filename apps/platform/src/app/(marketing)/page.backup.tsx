import { redirect } from "next/navigation";
import { getDashboardPath } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { VslLandingPage } from "@/modules/marketing";

export const metadata = {
  title: "LeadVix - Verified Pay Per Lead Network",
  description: "Buy 100% verified lead opt-ins from $0.70–$2.50 per lead.",
};

export default async function HomePage() {
  const session = await getSession();

  if (session?.user) {
    redirect(getDashboardPath(session.user.role));
  }

  return <VslLandingPage />;
}
