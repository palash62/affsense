import { redirect } from "next/navigation";
import { getDashboardPath } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { Preview2LandingPage } from "@/modules/marketing";

export const metadata = {
  title: "LeadVix — Verified Pay Per Lead Network",
  description:
    "LeadVix is an AI-powered Pay Per Lead network with verified opt-ins, flexible offer support, built-in CPA offers, an in-house autoresponder, funnels and campaign optimization.",
};

export default async function HomePage() {
  const session = await getSession();

  if (session?.user) {
    redirect(getDashboardPath(session.user.role));
  }

  return <Preview2LandingPage />;
}
