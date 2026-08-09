import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getSession } from "@/lib/session";
import { isAdminPortalRole, parseStaffMenuAccess } from "@/lib/admin-portal";

const FULLSCREEN_ADMIN_FUNNEL =
  /^\/admin\/funnel-templates\/[^/]+\/(edit|preview)(\/|$)/;

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = (await headers()).get("x-pathname") ?? "";
  if (FULLSCREEN_ADMIN_FUNNEL.test(pathname)) {
    return children;
  }

  const session = await getSession();
  if (!session?.user || !isAdminPortalRole(session.user.role)) {
    redirect("/login");
  }

  return (
    <AppShell
      role={session.user.role}
      staffMenuAccess={parseStaffMenuAccess(session.user.staffMenuAccess)}
    >
      {children}
    </AppShell>
  );
}
