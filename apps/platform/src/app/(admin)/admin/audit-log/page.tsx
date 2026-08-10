import { formatUserDateTime } from "@/lib/user-timezone";
import { getSession } from "@/lib/session";
import { ClipboardList, History, Shield, User } from "lucide-react";
import { listAuditLogs } from "@/services/admin.service";
import { PageHero } from "@/components/admin/page-hero";
import { PageSection } from "@/components/admin/page-section";
import { NeutralStatCard } from "@/components/admin/gradient-stat-card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function AdminAuditLogPage() {
  const session = await getSession();
  const tz = session?.user?.timezone;
  const { data: logs } = await listAuditLogs({ limit: 100 });

  const uniqueActions = new Set(logs.map((l) => l.action)).size;
  const uniqueActors = new Set(logs.filter((l) => l.actor).map((l) => l.actor!.email)).size;

  return (
    <div className="space-y-7">
      <PageHero
        eyebrow="Security"
        title="Audit Log"
        description="Track all platform actions and changes"
        badge={`${logs.length} entries`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <NeutralStatCard label="Total Entries" value={logs.length} icon={ClipboardList} accent="purple" />
        <NeutralStatCard label="Unique Actions" value={uniqueActions} icon={History} accent="orange" />
        <NeutralStatCard label="Active Actors" value={uniqueActors} icon={User} accent="green" />
      </div>

      <PageSection title="Recent Actions" description="Chronological log of platform events" icon={Shield} gradient="leads">
        {logs.length === 0 ? (
          <div className="px-6 py-16 text-center text-muted-foreground">No audit entries</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="border-none hover:bg-transparent" style={{ background: "var(--theme-primary-soft)" }}>
                <TableHead className="h-11 px-6 text-muted-foreground">Action</TableHead>
                <TableHead className="h-11 px-4 text-muted-foreground">Entity</TableHead>
                <TableHead className="h-11 px-4 text-muted-foreground">Actor</TableHead>
                <TableHead className="h-11 px-4 text-right text-muted-foreground">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id} className="border-border transition-colors hover:bg-muted/80">
                  <TableCell className="px-6 py-3">
                    <Badge variant="outline" className="border-blue-200 bg-blue-50 font-medium text-blue-700">
                      {log.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-muted-foreground">{log.entityType}</TableCell>
                  <TableCell className="px-4 py-3">
                    {log.actor ? (
                      <div>
                        <p className="text-sm font-medium text-foreground">{log.actor.name}</p>
                        <p className="text-xs text-muted-foreground">{log.actor.email}</p>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">System</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right text-xs text-muted-foreground">
                    {formatUserDateTime(log.createdAt, tz, "MMM d, yyyy HH:mm")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </PageSection>
    </div>
  );
}
