import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getSession } from "@/lib/session";
import {
  reconcilePublisherDigitalCommissionsForUser,
  reconcilePublisherLeadCreditsForUser,
} from "@/services/wallet.service";

const FULLSCREEN_PUBLISHER_PATH = /^\/publisher\/invoices\/[^/]+\/print(\/|$)/;

export default async function PublisherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = (await headers()).get("x-pathname") ?? "";
  const fullscreen = FULLSCREEN_PUBLISHER_PATH.test(pathname);

  const session = await getSession();
  if (!session?.user) {
    redirect("/login");
  }

  if (fullscreen) {
    return children;
  }

  await reconcilePublisherLeadCreditsForUser(session.user.id);
  await reconcilePublisherDigitalCommissionsForUser(session.user.id).catch((error) => {
    console.error("[publisher-layout] marketplace commission reconcile failed", error);
  });

  return (
    <AppShell
      role={session.user.role}
      viewAs={
        session.viewAsMode
          ? { userName: session.user.name, userRole: session.user.role }
          : null
      }
    >
      {children}
    </AppShell>
  );
}
