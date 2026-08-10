import { Suspense } from "react";
import { AdminSettingsShell } from "@/components/admin/admin-settings-shell";
import { PageHero } from "@/components/admin/page-hero";
import { getSession } from "@/lib/session";
import { resolveUserTimezone } from "@/lib/user-timezone";
import { getAdminSettings } from "@/services/user.service";

export default async function AdminSettingsPage() {
  const session = await getSession();
  const user = session?.user?.id ? await getAdminSettings(session.user.id) : null;
  const initialTimezone = resolveUserTimezone(user?.timezone ?? session?.user?.timezone);

  return (
    <div className="space-y-7">
      <PageHero
        eyebrow="Configuration"
        title="Platform Settings"
        description="Configure global platform options and your personal display preferences"
      />
      <Suspense
        fallback={<p className="text-sm text-muted-foreground">Loading settings...</p>}
      >
        <AdminSettingsShell initialTimezone={initialTimezone} />
      </Suspense>
    </div>
  );
}
