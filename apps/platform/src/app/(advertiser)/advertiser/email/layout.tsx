import { RoleHero } from "@/components/layout/role-hero";
import { AutoresponderSubNav } from "@/components/advertiser/email/autoresponder-sub-nav";
import { canAdvertiserAccessAutoresponder } from "@/lib/autoresponder-access";
import { getSession } from "@/lib/session";
import { Mail } from "lucide-react";

/**
 * Autoresponder UI is gated to an allowlist (demo advertiser by default).
 * Other advertisers see Coming soon. Set AUTORESPONDER_ADVERTISER_ALLOWLIST=* to open fully.
 */
export default async function EmailModuleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  const canAccess = canAdvertiserAccessAutoresponder(session?.user?.email);

  if (canAccess) {
    return (
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
        <AutoresponderSubNav />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <RoleHero
        eyebrow="Advertiser Portal"
        title="Autoresponder"
        description="Email automations, campaigns, and subscriber tools for your leads."
      />

      <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-card px-6 py-16 text-center shadow-sm">
        <div
          className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: "var(--theme-primary-soft)" }}
        >
          <Mail className="h-7 w-7 text-[var(--theme-primary)]" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--theme-primary)]">
          Coming soon
        </p>
        <h2 className="mt-2 text-xl font-semibold text-foreground">Autoresponder is launching soon</h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
          We&apos;re finishing the built-in email and automation experience. Check back shortly —
          your nav link will open this feature when it&apos;s ready.
        </p>
      </div>
    </div>
  );
}
