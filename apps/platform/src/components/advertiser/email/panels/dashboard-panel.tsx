"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Mail, MousePointerClick, Send, UserPlus, Users } from "lucide-react";
import { PageSection } from "@/components/admin/page-section";
import { LeadsTrendChart } from "@/components/dashboard/dashboard-charts";
import { formatUserDateTime } from "@/lib/user-timezone";
import { EmailModuleShell } from "../email-module-shell";
import { ButtonLink } from "@/components/ui/button-link";

type Stats = {
  totalContacts: number;
  totalSends: number;
  openRate: number;
  clickRate: number;
  trend: { date: string; sends: number; opens: number }[];
  activity: { id: string; action: string; detail: string; time: string }[];
};

export function DashboardPanel() {
  const { data: session } = useSession();
  const timezone = session?.user?.timezone;
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/v1/advertiser/email/stats?activityLimit=10")
      .then((r) => r.json())
      .then((j) => setStats(j.data))
      .catch(() => {});
  }, []);

  const sendsTrend = stats?.trend?.map((t) => ({ date: t.date, count: t.sends })) ?? [];
  const opensTrend = stats?.trend?.map((t) => ({ date: t.date, count: t.opens })) ?? [];

  return (
    <EmailModuleShell
      title="Dashboard"
      description="Overview of your email performance, subscribers, and recent activity."
      breadcrumbs={[
        { label: "Autoresponder", href: "/advertiser/email" },
        { label: "Dashboard" },
      ]}
      stats={[
        { label: "Total Subscribers", value: stats ? stats.totalContacts.toLocaleString() : "—", icon: Users, accent: "purple" },
        { label: "Emails Sent", value: stats ? stats.totalSends.toLocaleString() : "—", icon: Send, variant: "leads" },
        { label: "Open Rate", value: stats ? `${stats.openRate}%` : "—", icon: Mail, accent: "green" },
        { label: "Click Rate", value: stats ? `${stats.clickRate}%` : "—", icon: MousePointerClick, accent: "orange" },
      ]}
      showToolbar={false}
      primaryAction={{ label: "Create Broadcast", href: "/advertiser/email/campaigns", icon: Send }}
    >
      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/advertiser/email/automations/new">Create automation</ButtonLink>
        <ButtonLink href="/advertiser/email/subscribers" variant="outline">
          <UserPlus className="mr-2 h-4 w-4" />
          Add subscriber
        </ButtonLink>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <LeadsTrendChart title="Emails Sent" data={sendsTrend} />
        <LeadsTrendChart title="Opens Over Time" data={opensTrend} />
      </div>

      {stats?.activity && stats.activity.length > 0 && (
        <PageSection title="Recent Activity" description="Latest email events" icon={Mail} gradient="leads">
          <ul className="divide-y divide-slate-100">
            {stats.activity.map((item) => (
              <li
                key={item.id}
                className="flex items-start justify-between gap-4 px-6 py-4 transition-colors hover:bg-slate-50"
              >
                <div>
                  <p className="font-medium text-slate-900">{item.action}</p>
                  <p className="text-sm text-slate-500">{item.detail}</p>
                </div>
                <span className="shrink-0 text-xs text-slate-400">
                  {formatUserDateTime(item.time, timezone, "MMM d, yyyy")}
                </span>
              </li>
            ))}
          </ul>
        </PageSection>
      )}

      <div
        className="rounded-xl border px-5 py-4"
        style={{
          borderColor: "color-mix(in srgb, var(--theme-primary) 20%, transparent)",
          background: "var(--theme-primary-soft)",
        }}
      >
        <p className="font-semibold text-slate-900">Get started in 3 steps</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">
          <li>
            <Link href="/advertiser/email/subscribers" className="text-[var(--theme-primary)] hover:underline">
              Add or import subscribers
            </Link>
          </li>
          <li>
            <Link href="/advertiser/email/automations/new" className="text-[var(--theme-primary)] hover:underline">
              Build an automation (welcome + follow-ups)
            </Link>
          </li>
          <li>Activate it — leads from your campaigns will receive emails automatically</li>
        </ol>
      </div>
    </EmailModuleShell>
  );
}
