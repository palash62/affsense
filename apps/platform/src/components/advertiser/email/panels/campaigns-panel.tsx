"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Send } from "lucide-react";
import { PageSection } from "@/components/admin/page-section";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatUserDateTime } from "@/lib/user-timezone";
import { EmailModuleShell } from "../email-module-shell";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  ACTIVE: "default",
  PAUSED: "secondary",
  DRAFT: "outline",
};

type CampaignRow = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  automationCount: number;
  sendCount: number;
  contactCount: number;
};

export function CampaignsPanel() {
  const { data: session } = useSession();
  const timezone = session?.user?.timezone;
  const [rows, setRows] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/advertiser/email/campaigns")
      .then((r) => r.json())
      .then((j) => setRows(j.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <EmailModuleShell
      title="Campaigns"
      description="Your lead campaigns and their email automation activity."
      breadcrumbs={[
        { label: "Autoresponder", href: "/advertiser/email" },
        { label: "Campaigns" },
      ]}
      stats={[
        { label: "Campaigns", value: rows.length.toLocaleString(), icon: Send, accent: "purple" },
        { label: "Total Emails Sent", value: rows.reduce((s, r) => s + r.sendCount, 0).toLocaleString(), icon: Send, variant: "leads" },
      ]}
      showToolbar={false}
    >
      <PageSection title="Lead Campaigns" icon={Send} gradient="leads">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Automations</TableHead>
                <TableHead>Emails Sent</TableHead>
                <TableHead>Subscribers</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-slate-500">Loading...</TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-slate-500">
                    No campaigns yet. Create a lead campaign to get started.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((c) => (
                  <TableRow key={c.id} className="transition-colors hover:bg-slate-50">
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[c.status] ?? "outline"}>{c.status.toLowerCase()}</Badge>
                    </TableCell>
                    <TableCell>{c.automationCount}</TableCell>
                    <TableCell>{c.sendCount.toLocaleString()}</TableCell>
                    <TableCell>{c.contactCount.toLocaleString()}</TableCell>
                    <TableCell className="text-slate-500">
                      {formatUserDateTime(c.createdAt, timezone, "MMM d, yyyy")}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </PageSection>
    </EmailModuleShell>
  );
}
