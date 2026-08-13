"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  DashboardCard,
  DashboardCardTitle,
} from "@/components/admin/affsense-dashboard/dashboard-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { TaskCategoryItem } from "./mock-data";

export function TaskCategoriesPanel() {
  const [categories, setCategories] = useState<TaskCategoryItem[]>([]);
  const [name, setName] = useState("");

  async function refresh() {
    const res = await fetch("/api/v1/admin/get-paid-tasks/categories");
    const json = await res.json();
    setCategories(json.data ?? []);
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleAdd() {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      toast.error("Enter a category name");
      return;
    }
    if (categories.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("Category already exists");
      return;
    }
    const res = await fetch("/api/v1/admin/get-paid-tasks/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed, status: "Active" }),
    });
    if (!res.ok) {
      toast.error("Failed to add category");
      return;
    }
    setName("");
    await refresh();
    toast.success("Category added");
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/v1/admin/get-paid-tasks/categories?id=${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      toast.error(json.error?.message ?? "Failed to delete category");
      return;
    }
    await refresh();
    toast.success("Category removed");
  }

  return (
    <div className="space-y-5">
      <DashboardCard>
        <DashboardCardTitle>Add Category</DashboardCardTitle>
        <div className="mt-4 flex flex-wrap gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Category name"
            className="h-10 max-w-sm flex-1 rounded-md"
            onKeyDown={(e) => e.key === "Enter" && void handleAdd()}
          />
          <Button
            type="button"
            onClick={() => void handleAdd()}
            className="h-10 gap-2 rounded-md bg-[var(--theme-primary)] px-4 hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Add Category
          </Button>
        </div>
      </DashboardCard>

      <DashboardCard className="overflow-hidden p-0">
        <div className="border-b border-border px-5 py-4">
          <DashboardCardTitle>Task Categories</DashboardCardTitle>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {categories.length} categor{categories.length === 1 ? "y" : "ies"}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-semibold">Category</th>
                <th className="px-5 py-3 font-semibold">Tasks</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat.id} className="border-t border-border">
                  <td className="px-5 py-3 font-medium text-foreground">{cat.name}</td>
                  <td className="px-5 py-3 text-muted-foreground">{cat.taskCount}</td>
                  <td className="px-5 py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
                        cat.status === "Active"
                          ? "bg-[color-mix(in_srgb,var(--theme-success)_14%,white)] text-[var(--theme-success)]"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {cat.status}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        className="rounded-md"
                        onClick={() => toast.message("Edit coming soon")}
                        aria-label={`Edit ${cat.name}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        className="rounded-md text-destructive hover:bg-destructive/10"
                        onClick={() => void handleDelete(cat.id)}
                        aria-label={`Delete ${cat.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DashboardCard>
    </div>
  );
}
