import { prisma } from "@cpl/database";
import type { PublisherTaskSubmissionStatus } from "@prisma/client";
import { Errors } from "@/lib/errors";
import {
  getGetPaidTaskById,
  listGetPaidTasks,
  type GetPaidTaskListFilters,
  type SerializedGetPaidTask,
} from "@/services/get-paid-task.service";

export type PublisherTaskSubmissionSummary = {
  id: string;
  status: PublisherTaskSubmissionStatus;
  createdAt: string;
  proofUrl: string | null;
};

export type PublisherTaskListItem = SerializedGetPaidTask & {
  submission: PublisherTaskSubmissionSummary | null;
};

function serializeSubmission(row: {
  id: string;
  status: PublisherTaskSubmissionStatus;
  createdAt: Date;
  proofUrl: string | null;
}): PublisherTaskSubmissionSummary {
  return {
    id: row.id,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    proofUrl: row.proofUrl,
  };
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function assertTaskSchedule(task: SerializedGetPaidTask) {
  const now = new Date();
  if (task.startDate && new Date(task.startDate) > now) {
    throw Errors.validation("This task is not available yet");
  }
  if (task.endDate && new Date(task.endDate) < now) {
    throw Errors.validation("This task has ended");
  }
}

function assertProofUrl(proofUrl: string | undefined, required: boolean): string | null {
  if (!required) {
    if (!proofUrl?.trim()) return null;
  } else if (!proofUrl?.trim()) {
    throw Errors.validation("Proof URL is required", "proofUrl");
  }

  const value = proofUrl?.trim() ?? "";
  if (!value) return null;

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") {
      throw Errors.validation("Proof URL must use HTTPS", "proofUrl");
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AppError") throw err;
    throw Errors.validation("Enter a valid HTTPS proof URL", "proofUrl");
  }

  return value;
}

async function getLatestSubmission(publisherId: string, taskId: string) {
  return prisma.publisherTaskSubmission.findFirst({
    where: { publisherId, taskId },
    orderBy: { createdAt: "desc" },
  });
}

async function attachSubmissions(
  publisherId: string,
  tasks: SerializedGetPaidTask[],
): Promise<PublisherTaskListItem[]> {
  if (tasks.length === 0) return [];

  const taskIds = tasks.map((t) => t.id);
  const submissions = await prisma.publisherTaskSubmission.findMany({
    where: { publisherId, taskId: { in: taskIds } },
    orderBy: { createdAt: "desc" },
  });

  const latestByTask = new Map<string, PublisherTaskSubmissionSummary>();
  for (const row of submissions) {
    if (!latestByTask.has(row.taskId)) {
      latestByTask.set(row.taskId, serializeSubmission(row));
    }
  }

  return tasks.map((task) => ({
    ...task,
    submission: latestByTask.get(task.id) ?? null,
  }));
}

export async function listPublisherTasksWithSubmissions(
  publisherId: string,
  filters: GetPaidTaskListFilters = {},
) {
  const result = await listGetPaidTasks({
    ...filters,
    activeOnly: true,
  });
  const items = await attachSubmissions(publisherId, result.items);
  return { ...result, items };
}

export async function getPublisherTaskDetail(taskId: string, publisherId: string) {
  const task = await getGetPaidTaskById(taskId);
  if (task.status !== "Active") {
    throw Errors.notFound("Get paid task");
  }
  assertTaskSchedule(task);

  const submission = await getLatestSubmission(publisherId, taskId);
  return {
    task,
    submission: submission ? serializeSubmission(submission) : null,
  };
}

export async function submitPublisherTask(
  taskId: string,
  publisherId: string,
  input: { proofUrl?: string },
) {
  const task = await getGetPaidTaskById(taskId);
  if (task.status !== "Active") {
    throw Errors.validation("This task is not available");
  }
  assertTaskSchedule(task);

  const latest = await getLatestSubmission(publisherId, taskId);
  if (latest?.status === "PENDING") {
    throw Errors.validation("Your submission is already pending review");
  }
  if (latest?.status === "APPROVED") {
    throw Errors.validation("You have already completed this task");
  }

  if (task.dailyLimit != null) {
    const todayCount = await prisma.publisherTaskSubmission.count({
      where: {
        publisherId,
        taskId,
        createdAt: { gte: startOfToday() },
      },
    });
    if (todayCount >= task.dailyLimit) {
      throw Errors.validation("Daily limit reached for this task");
    }
  }

  if (task.totalLimit != null) {
    const totalCount = await prisma.publisherTaskSubmission.count({
      where: { taskId },
    });
    if (totalCount >= task.totalLimit) {
      throw Errors.validation("This task has reached its completion limit");
    }
  }

  const proofUrl = assertProofUrl(input.proofUrl, task.proofRequired);

  const row = await prisma.publisherTaskSubmission.create({
    data: {
      publisherId,
      taskId,
      status: "PENDING",
      rewardAmount: task.rewardAmount,
      proofUrl,
    },
  });

  return serializeSubmission(row);
}
