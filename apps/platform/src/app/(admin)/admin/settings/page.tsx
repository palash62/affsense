import { Suspense } from "react";
import { AdminSettingsShell } from "@/components/admin/admin-settings-shell";
import { getSession } from "@/lib/session";
import { resolveUserTimezone } from "@/lib/user-timezone";
import { getAdminSettings } from "@/services/user.service";

export default async function AdminSettingsPage() {
  const session = await getSession();
  const user = session?.user?.id ? await getAdminSettings(session.user.id) : null;
  const initialTimezone = resolveUserTimezone(user?.timezone ?? session?.user?.timezone);

  return (
    <div className="space-y-5">
      <Suspense
        fallback={<p className="text-sm text-muted-foreground">Loading settings...</p>}
      >
        <AdminSettingsShell initialTimezone={initialTimezone} />
      </Suspense>
    </div>
  );
}
