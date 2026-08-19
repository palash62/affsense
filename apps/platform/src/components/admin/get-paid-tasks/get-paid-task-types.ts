// Types, constants, and pure utilities for get-paid tasks.
// No mock data, no localStorage.

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

export const DEFAULT_FORM_VALUES: GetPaidTaskFormValues = {
  title: "",
  category: "",
  descriptionHtml: "",
  descriptionText: "",
  taskType: "Social Follow",
  proofRequired: true,
  rewardAmount: "",
  dailyLimit: "",
  totalLimit: "",
  deductPoints: false,
  requiredAction: "",
  requiredLink: "",
  additionalInstructions: "",
  disallowedCountries: [],
  status: "Draft",
  showOnDashboard: false,
  featured: false,
  isNew: false,
  startDate: "",
  endDate: "",
};
