"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { PageSection } from "@/components/admin/page-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export function NotificationsPanel() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/v1/notifications");
    const data = await res.json();
    setNotifications(data.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function markRead(id: string) {
    await fetch("/api/v1/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  async function markAllRead() {
    await fetch("/api/v1/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
    load();
  }

  if (loading) return <p className="text-muted-foreground">Loading notifications...</p>;

  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-[var(--theme-primary)]">{unread}</span> unread
        </p>
        {unread > 0 && (
          <Button size="sm" variant="outline" onClick={markAllRead}>
            Mark all read
          </Button>
        )}
      </div>

      <PageSection title="All Notifications" description="Recent platform alerts" icon={Bell} gradient="leads">
        <div className="divide-y divide-slate-100">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`flex items-start justify-between px-6 py-4 transition-colors hover:bg-violet-50/30 ${!n.readAt ? "bg-[var(--theme-primary-soft)]/50" : ""}`}
            >
              <div>
                <p className="font-medium text-foreground">{n.title}</p>
                <p className="text-sm text-muted-foreground">{n.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-violet-200 bg-violet-50 text-violet-700">
                  {n.type}
                </Badge>
                {!n.readAt && (
                  <Button size="sm" variant="ghost" onClick={() => markRead(n.id)}>
                    Mark read
                  </Button>
                )}
              </div>
            </div>
          ))}
          {notifications.length === 0 && (
            <p className="px-6 py-12 text-center text-muted-foreground">No notifications</p>
          )}
        </div>
      </PageSection>
    </div>
  );
}
