export type GetPaidTaskStatus = "Active" | "Draft" | "Paused";

export type GetPaidTaskListItem = {
  id: string;
  title: string;
  category: string;
  taskType: string;
  requiredAction: string;
  rewardAmount: number;
  proofRequired: boolean;
  status: GetPaidTaskStatus;
  featured: boolean;
  isNew: boolean;
  showOnDashboard: boolean;
  dailyLimit?: number;
  totalLimit?: number;
};

export function filterGetPaidTasks(
  tasks: GetPaidTaskListItem[],
  filters: { q?: string; status?: string; category?: string },
): GetPaidTaskListItem[] {
  const q = filters.q?.trim().toLowerCase() ?? "";
  return tasks.filter((t) => {
    if (filters.status && filters.status !== "all" && t.status !== filters.status) return false;
    if (filters.category && filters.category !== "all" && t.category !== filters.category) {
      return false;
    }
    if (q) {
      const hay = `${t.title} ${t.category} ${t.taskType} ${t.requiredAction}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
