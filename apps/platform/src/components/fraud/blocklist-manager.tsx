"use client";

import { useEffect, useState } from "react";
import { formatUserDateTime } from "@/lib/user-timezone";
import { useSession } from "next-auth/react";
import { Trash2 } from "lucide-react";
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

type BlocklistRow = {
  id: string;
  ip: string;
  reason: string | null;
  createdAt: string;
};

export function BlocklistManager() {
  const { data: session } = useSession();
  const [rows, setRows] = useState<BlocklistRow[]>([]);
  const [ip, setIp] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/v1/admin/fraud/blocklist");
    const json = await res.json();
    setRows(json.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!ip.trim()) return;
    setSaving(true);
    await fetch("/api/v1/admin/fraud/blocklist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ip: ip.trim(), reason: reason.trim() || undefined }),
    });
    setIp("");
    setReason("");
    setSaving(false);
    void load();
  }

  async function handleRemove(blockedIp: string) {
    await fetch("/api/v1/admin/fraud/blocklist", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ip: blockedIp }),
    });
    void load();
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="blockIp">IP address</Label>
          <Input
            id="blockIp"
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            placeholder="203.0.113.10"
            className="w-48"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="blockReason">Reason (optional)</Label>
          <Input
            id="blockReason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Known spam source"
            className="w-64"
          />
        </div>
        <Button type="submit" disabled={saving}>
          Add to blocklist
        </Button>
      </form>

      {loading ? (
        <p className="text-sm text-slate-500">Loading blocklist…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">No blocked IPs yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>IP</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-mono text-sm">{row.ip}</TableCell>
                <TableCell className="text-sm text-slate-600">{row.reason ?? "—"}</TableCell>
                <TableCell className="text-sm text-slate-500">
                  {formatUserDateTime(row.createdAt, session?.user?.timezone, "MMM d, yyyy")}
                </TableCell>
                <TableCell>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => void handleRemove(row.ip)}
                    aria-label={`Remove ${row.ip}`}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
