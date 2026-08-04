"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { PageSection } from "@/components/admin/page-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatUserDateTime } from "@/lib/user-timezone";
import { useEmailModuleFilters } from "../email-module-filter-context";
import { EmailModuleShell } from "../email-module-shell";

type Contact = {
  id: string;
  email: string;
  status: string;
  unsubscribedAt: string | null;
  createdAt: string;
};

function SuppressionTable({ rows }: { rows: Contact[] }) {
  const { data: session } = useSession();
  const timezone = session?.user?.timezone;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={3} className="h-32 text-center text-slate-500">
                No records found
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id} className="transition-colors hover:bg-slate-50">
                <TableCell className="font-medium">{row.email}</TableCell>
                <TableCell className="text-slate-600">{row.status.toLowerCase()}</TableCell>
                <TableCell className="text-slate-500">
                  {formatUserDateTime(row.unsubscribedAt ?? row.createdAt, timezone, "MMM d, yyyy")}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function SuppressionContent({ onChanged }: { onChanged: () => void }) {
  const { search } = useEmailModuleFilters();
  const [bounced, setBounced] = useState<Contact[]>([]);
  const [complained, setComplained] = useState<Contact[]>([]);
  const [unsubscribed, setUnsubscribed] = useState<Contact[]>([]);
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const load = useCallback(() => {
    const fetchStatus = (status: string) =>
      fetch(`/api/v1/advertiser/email/contacts?status=${status}&limit=100`)
        .then((r) => r.json())
        .then((j) => j.data?.items ?? []);

    Promise.all([
      fetchStatus("BOUNCED"),
      fetchStatus("COMPLAINED"),
      fetchStatus("UNSUBSCRIBED"),
    ]).then(([b, c, u]) => {
      setBounced(b);
      setComplained(c);
      setUnsubscribed(u);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filterBySearch = (rows: Contact[]) =>
    search
      ? rows.filter((r) => r.email.toLowerCase().includes(search.toLowerCase()))
      : rows;

  async function handleSuppress(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch("/api/v1/advertiser/email/contacts/suppress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Unable to suppress contact");
        return;
      }
      setOkMsg(`${json.data.email} marked unsubscribed`);
      setEmail("");
      load();
      onChanged();
    } catch {
      setError("Unable to suppress contact");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageSection
        title="Suppress existing contact"
        description="Only emails already in your subscribers list can be suppressed. This does not create a new contact."
        icon={AlertTriangle}
        gradient="leads"
      >
        <form onSubmit={handleSuppress} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor="suppress-email">Subscriber email</Label>
            <Input
              id="suppress-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="person@example.com"
              required
              disabled={saving}
            />
          </div>
          <Button type="submit" disabled={saving || !email.trim()} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Mark unsubscribed
          </Button>
        </form>
        {error ? (
          <p className="px-6 pb-4 text-sm text-red-600">{error}</p>
        ) : null}
        {okMsg ? (
          <p className="px-6 pb-4 text-sm text-green-700">{okMsg}</p>
        ) : null}
      </PageSection>

      <PageSection title="Suppressed Contacts" icon={AlertTriangle} gradient="approved">
        <p className="border-b border-slate-100 px-6 py-3 text-sm text-slate-600">
          Bounces and complaints are recorded from delivery events (SES/SNS). Manual suppress marks an
          existing subscriber as unsubscribed.
        </p>
        <Tabs defaultValue="bounced" className="px-6 pb-6 pt-4">
          <TabsList className="mb-4">
            <TabsTrigger value="bounced">Bounced ({bounced.length})</TabsTrigger>
            <TabsTrigger value="complaints">Complaints ({complained.length})</TabsTrigger>
            <TabsTrigger value="unsubscribed">Unsubscribed ({unsubscribed.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="bounced">
            <SuppressionTable rows={filterBySearch(bounced)} />
          </TabsContent>
          <TabsContent value="complaints">
            <SuppressionTable rows={filterBySearch(complained)} />
          </TabsContent>
          <TabsContent value="unsubscribed">
            <SuppressionTable rows={filterBySearch(unsubscribed)} />
          </TabsContent>
        </Tabs>
      </PageSection>
    </>
  );
}

export function SuppressionPanel() {
  const [counts, setCounts] = useState<{
    bounced: number;
    complained: number;
    unsubscribed: number;
  } | null>(null);

  const loadCounts = useCallback(() => {
    fetch("/api/v1/advertiser/email/stats")
      .then((r) => r.json())
      .then((j) =>
        setCounts({
          bounced: j.data?.bounced ?? 0,
          complained: j.data?.complained ?? 0,
          unsubscribed: j.data?.unsubscribed ?? 0,
        }),
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  return (
    <EmailModuleShell
      title="Suppression List"
      description="Bounced addresses, spam complaints, and unsubscribed contacts. Suppress only marks an existing subscriber."
      breadcrumbs={[
        { label: "Autoresponder", href: "/advertiser/email" },
        { label: "Suppression List" },
      ]}
      stats={[
        {
          label: "Bounced",
          value: counts ? counts.bounced.toLocaleString() : "—",
          icon: AlertTriangle,
          accent: "red",
        },
        {
          label: "Complaints",
          value: counts ? counts.complained.toLocaleString() : "—",
          icon: AlertTriangle,
          accent: "orange",
        },
        {
          label: "Unsubscribed",
          value: counts ? counts.unsubscribed.toLocaleString() : "—",
          icon: AlertTriangle,
          accent: "purple",
        },
      ]}
      searchPlaceholder="Search suppressed emails…"
    >
      <SuppressionContent onChanged={loadCounts} />
    </EmailModuleShell>
  );
}
