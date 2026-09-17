"use client";

import { ClipboardList, ListTodo, Store } from "lucide-react";
import {
  AffsenseStatCard,
  type AffsenseStatAccent,
} from "@/components/dashboard/affsense-stat-card";

export function OpsStripCards({
  activeTasks,
  pendingTaskSubmissions,
  pendingCpaRequests,
}: {
  activeTasks: number;
  pendingTaskSubmissions: number;
  pendingCpaRequests: number;
}) {
  const items: Array<{
    id: string;
    label: string;
    value: number;
    href: string;
    accent: AffsenseStatAccent;
    Icon: typeof ListTodo;
  }> = [
    {
      id: "tasks",
      label: "Active Tasks",
      value: activeTasks,
      href: "/admin/get-paid-tasks",
      accent: "coral",
      Icon: ListTodo,
    },
    {
      id: "task-subs",
      label: "Pending Task Submissions",
      value: pendingTaskSubmissions,
      href: "/admin/get-paid-tasks",
      accent: "amber",
      Icon: ClipboardList,
    },
    {
      id: "cpa-requests",
      label: "Pending CPA Requests",
      value: pendingCpaRequests,
      href: "/admin/offer-network/requests",
      accent: "navy",
      Icon: Store,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {items.map((item) => (
        <AffsenseStatCard
          key={item.id}
          label={item.label}
          value={item.value}
          icon={item.Icon}
          accent={item.accent}
          footer={{ href: item.href, linkLabel: "View" }}
        />
      ))}
    </div>
  );
}
