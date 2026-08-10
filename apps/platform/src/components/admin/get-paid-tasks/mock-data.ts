export type GetPaidTaskStatus = "Active" | "Draft" | "Paused";

export type TaskCategoryItem = {
  id: string;
  name: string;
  status: "Active" | "Inactive";
  taskCount: number;
};

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

export type GetPaidTaskFormValues = {
  title: string;
  category: string;
  descriptionHtml: string;
  descriptionText: string;
  taskType: string;
  proofRequired: boolean;
  rewardAmount: string;
  dailyLimit: string;
  totalLimit: string;
  deductPoints: boolean;
  requiredAction: string;
  requiredLink: string;
  additionalInstructions: string;
  disallowedCountries: string[];
  status: GetPaidTaskStatus;
  showOnDashboard: boolean;
  featured: boolean;
  isNew: boolean;
  startDate: string;
  endDate: string;
};

export const GET_PAID_TASKS_STORAGE_KEY = "affsense-get-paid-tasks-mock";
export const GET_PAID_CATEGORIES_STORAGE_KEY = "affsense-get-paid-task-categories-mock";

export const DESCRIPTION_MAX = 500;

export const TASK_TYPES = [
  "Social Follow",
  "Social Engagement",
  "Survey",
  "App Install",
  "Visit Page",
  "Content Review",
] as const;

export const REQUIRED_ACTIONS = [
  "Follow",
  "Like",
  "Subscribe",
  "Share",
  "Visit Page",
  "Download",
  "Complete Survey",
] as const;

export const SEED_CATEGORIES: TaskCategoryItem[] = [
  { id: "social-media", name: "Social Media", status: "Active", taskCount: 3 },
  { id: "surveys", name: "Surveys", status: "Active", taskCount: 1 },
  { id: "app-installs", name: "App Installs", status: "Active", taskCount: 1 },
  { id: "content-engagement", name: "Content Engagement", status: "Active", taskCount: 1 },
];

export const DEFAULT_FORM_VALUES: GetPaidTaskFormValues = {
  title: "Follow our Instagram Account",
  category: "Social Media",
  descriptionHtml:
    "<p>Follow @affsense on Instagram and submit a screenshot of your following list as proof.</p>",
  descriptionText:
    "Follow @affsense on Instagram and submit a screenshot of your following list as proof.",
  taskType: "Social Follow",
  proofRequired: true,
  rewardAmount: "0.50",
  dailyLimit: "3",
  totalLimit: "1000",
  deductPoints: false,
  requiredAction: "Follow",
  requiredLink: "https://instagram.com/affsense",
  additionalInstructions: "",
  disallowedCountries: [],
  status: "Active",
  showOnDashboard: true,
  featured: false,
  isNew: true,
  startDate: "2025-05-26",
  endDate: "",
};

export const MOCK_GET_PAID_TASKS: GetPaidTaskListItem[] = [
  {
    id: "follow-instagram",
    title: "Follow our Instagram Account",
    category: "Social Media",
    taskType: "Social Follow",
    requiredAction: "Follow",
    rewardAmount: 0.5,
    proofRequired: true,
    status: "Active",
    featured: true,
    isNew: true,
    showOnDashboard: true,
    dailyLimit: 3,
    totalLimit: 1000,
  },
  {
    id: "like-facebook-page",
    title: "Like our Facebook Page",
    category: "Social Media",
    taskType: "Social Engagement",
    requiredAction: "Like",
    rewardAmount: 0.25,
    proofRequired: true,
    status: "Active",
    featured: false,
    isNew: false,
    showOnDashboard: true,
    dailyLimit: 1,
  },
  {
    id: "subscribe-youtube",
    title: "Subscribe on YouTube",
    category: "Social Media",
    taskType: "Social Follow",
    requiredAction: "Subscribe",
    rewardAmount: 0.75,
    proofRequired: true,
    status: "Active",
    featured: true,
    isNew: false,
    showOnDashboard: true,
  },
  {
    id: "quick-survey",
    title: "Complete a 2-minute Survey",
    category: "Surveys",
    taskType: "Survey",
    requiredAction: "Complete Survey",
    rewardAmount: 1.5,
    proofRequired: false,
    status: "Draft",
    featured: false,
    isNew: true,
    showOnDashboard: false,
  },
  {
    id: "install-partner-app",
    title: "Install Partner Finance App",
    category: "App Installs",
    taskType: "App Install",
    requiredAction: "Download",
    rewardAmount: 2.0,
    proofRequired: true,
    status: "Paused",
    featured: false,
    isNew: false,
    showOnDashboard: false,
    totalLimit: 500,
  },
  {
    id: "read-blog-post",
    title: "Read and Review Blog Post",
    category: "Content Engagement",
    taskType: "Content Review",
    requiredAction: "Visit Page",
    rewardAmount: 0.4,
    proofRequired: true,
    status: "Active",
    featured: false,
    isNew: false,
    showOnDashboard: true,
    dailyLimit: 5,
  },
];

export const TASK_GUIDELINES = [
  "Make instructions clear and easy to follow",
  "Set a fair reward amount for the effort required",
  "Ensure the task complies with platform policies",
  "Always require proof for manual review when possible",
];

export const HOW_IT_WORKS_STEPS = [
  "Create and publish a task for members",
  "Members complete the task and submit proof",
  "Admin reviews and approves submissions",
  "Member receives the reward automatically",
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function readStoredTasks(): GetPaidTaskListItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(GET_PAID_TASKS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is GetPaidTaskListItem =>
        Boolean(item && typeof item === "object" && "id" in item && "title" in item),
    );
  } catch {
    return [];
  }
}

function readStoredCategories(): TaskCategoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(GET_PAID_CATEGORIES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is TaskCategoryItem =>
        Boolean(item && typeof item === "object" && "id" in item && "name" in item),
    );
  } catch {
    return [];
  }
}

export function loadMockGetPaidTasks(): GetPaidTaskListItem[] {
  const stored = readStoredTasks();
  const seedIds = new Set(MOCK_GET_PAID_TASKS.map((t) => t.id));
  const custom = stored.filter((t) => !seedIds.has(t.id)).reverse();
  const seeds = MOCK_GET_PAID_TASKS.map((t) => stored.find((s) => s.id === t.id) ?? t);
  return [...custom, ...seeds];
}

export function saveMockGetPaidTask(item: GetPaidTaskListItem): void {
  if (typeof window === "undefined") return;
  const stored = readStoredTasks();
  const idx = stored.findIndex((t) => t.id === item.id);
  const next = [...stored];
  if (idx >= 0) next[idx] = item;
  else next.push(item);
  window.localStorage.setItem(GET_PAID_TASKS_STORAGE_KEY, JSON.stringify(next));
}

export function loadMockTaskCategories(): TaskCategoryItem[] {
  const stored = readStoredCategories();
  if (stored.length === 0) return SEED_CATEGORIES;
  const byId = new Map<string, TaskCategoryItem>();
  for (const c of SEED_CATEGORIES) byId.set(c.id, c);
  for (const c of stored) byId.set(c.id, c);
  return Array.from(byId.values());
}

export function saveMockTaskCategory(item: TaskCategoryItem): void {
  if (typeof window === "undefined") return;
  const current = loadMockTaskCategories();
  const idx = current.findIndex((c) => c.id === item.id);
  const next = [...current];
  if (idx >= 0) next[idx] = item;
  else next.push(item);
  window.localStorage.setItem(GET_PAID_CATEGORIES_STORAGE_KEY, JSON.stringify(next));
}

export function deleteMockTaskCategory(id: string): void {
  if (typeof window === "undefined") return;
  const next = loadMockTaskCategories().filter((c) => c.id !== id);
  window.localStorage.setItem(GET_PAID_CATEGORIES_STORAGE_KEY, JSON.stringify(next));
}

export function formValuesToTaskItem(values: GetPaidTaskFormValues): GetPaidTaskListItem {
  const baseSlug = slugify(values.title) || "task";
  return {
    id: `${baseSlug}-${Date.now().toString(36)}`,
    title: values.title.trim() || "Untitled task",
    category: values.category,
    taskType: values.taskType,
    requiredAction: values.requiredAction,
    rewardAmount: Number.parseFloat(values.rewardAmount) || 0,
    proofRequired: values.proofRequired,
    status: values.status,
    featured: values.featured,
    isNew: values.isNew,
    showOnDashboard: values.showOnDashboard,
    dailyLimit: values.dailyLimit ? Number.parseInt(values.dailyLimit, 10) || undefined : undefined,
    totalLimit: values.totalLimit ? Number.parseInt(values.totalLimit, 10) || undefined : undefined,
  };
}

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

export function categoryNames(): string[] {
  return loadMockTaskCategories()
    .filter((c) => c.status === "Active")
    .map((c) => c.name);
}
