"use client";

import {
  DashboardCard,
  DashboardCardTitle,
} from "@/components/admin/affsense-dashboard/dashboard-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingToggle } from "./setting-toggle";
import type { GetPaidTaskFormValues } from "./mock-data";

export function TaskSettingsPanel({
  values,
  onChange,
}: {
  values: GetPaidTaskFormValues;
  onChange: (partial: Partial<GetPaidTaskFormValues>) => void;
}) {
  return (
    <DashboardCard>
      <DashboardCardTitle>Task Settings</DashboardCardTitle>
      <div className="mt-4 space-y-4">
        <SettingToggle
          label="Task Status"
          checked={values.status === "Active"}
          activeLabel="Active"
          inactiveLabel="Draft"
          onCheckedChange={(on) => onChange({ status: on ? "Active" : "Draft" })}
        />
        <SettingToggle
          label="Show on Dashboard"
          checked={values.showOnDashboard}
          onCheckedChange={(on) => onChange({ showOnDashboard: on })}
        />
        <SettingToggle
          label="Featured Task"
          checked={values.featured}
          onCheckedChange={(on) => onChange({ featured: on })}
        />
        <SettingToggle
          label="New Task Badge"
          checked={values.isNew}
          onCheckedChange={(on) => onChange({ isNew: on })}
        />

        <div className="space-y-2 border-t border-border pt-4">
          <Label className="text-sm font-medium text-foreground">Start Date</Label>
          <Input
            type="date"
            value={values.startDate}
            onChange={(e) => onChange({ startDate: e.target.value })}
            className="h-9 rounded-md"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium text-foreground">End Date (Optional)</Label>
          <Input
            type="date"
            value={values.endDate}
            onChange={(e) => onChange({ endDate: e.target.value })}
            className="h-9 rounded-md"
          />
        </div>
      </div>
    </DashboardCard>
  );
}
