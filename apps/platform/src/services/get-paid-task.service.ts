import { prisma } from "@cpl/database";
import type {
  CatalogCategoryStatus,
  GetPaidTaskStatus,
  Prisma,
} from "@prisma/client";
import { Errors, AppError } from "@/lib/errors";

export type GetPaidTaskListFilters = {
  q?: string;
  status?: string;
  category?: string;
  page?: number;
  limit?: number;
  activeOnly?: boolean;
  showOnDashboard?: boolean;
};

export type SerializedGetPaidTask = {
  id: string;
  title: string;
  category: string;
  categoryId: string;
  taskType: string;
  requiredAction: string;
  requiredLink: string | null;
  additionalInstructions: string | null;
  rewardAmount: number;
  proofRequired: boolean;
  status: "Active" | "Draft" | "Paused";
  featured: boolean;
  isNew: boolean;
  showOnDashboard: boolean;
  dailyLimit: number | null;
  totalLimit: number | null;
  descriptionHtml: string;
  descriptionText: string;
  deductPoints: boolean;
  disallowedCountries: string[];
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SerializedTaskCategory = {
  id: string;
  name: string;
  status: "Active" | "Inactive";
  taskCount: number;
};

function mapTaskStatus(status: GetPaidTaskStatus): "Active" | "Draft" | "Paused" {
  if (status === "ACTIVE") return "Active";
  if (status === "PAUSED") return "Paused";
  return "Draft";
}

function mapCategoryStatus(status: CatalogCategoryStatus): "Active" | "Inactive" {
  return status === "ACTIVE" ? "Active" : "Inactive";
}

function toInputStatus(status: string): GetPaidTaskStatus {
  const s = status.toLowerCase();
  if (s === "active") return "ACTIVE";
  if (s === "paused") return "PAUSED";
  return "DRAFT";
}

function serializeTask(row: {
  id: string;
  title: string;
  categoryId: string;
  descriptionHtml: string;
  descriptionText: string;
  taskType: string;
  requiredAction: string;
  requiredLink: string | null;
  additionalInstructions: string | null;
  rewardAmount: Prisma.Decimal;
  dailyLimit: number | null;
  totalLimit: number | null;
  proofRequired: boolean;
  deductPoints: boolean;
  disallowedCountries: Prisma.JsonValue;
  status: GetPaidTaskStatus;
  showOnDashboard: boolean;
  featured: boolean;
  isNew: boolean;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  category: { name: string };
}): SerializedGetPaidTask {
  const countries = Array.isArray(row.disallowedCountries)
    ? (row.disallowedCountries as string[])
    : [];
  return {
    id: row.id,
    title: row.title,
    category: row.category.name,
    categoryId: row.categoryId,
    taskType: row.taskType,
    requiredAction: row.requiredAction,
    requiredLink: row.requiredLink,
    additionalInstructions: row.additionalInstructions,
    rewardAmount: Number(row.rewardAmount),
    proofRequired: row.proofRequired,
    status: mapTaskStatus(row.status),
    featured: row.featured,
    isNew: row.isNew,
    showOnDashboard: row.showOnDashboard,
    dailyLimit: row.dailyLimit,
    totalLimit: row.totalLimit,
    descriptionHtml: row.descriptionHtml,
    descriptionText: row.descriptionText,
    deductPoints: row.deductPoints,
    disallowedCountries: countries,
    startDate: row.startDate?.toISOString() ?? null,
    endDate: row.endDate?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function buildTaskWhere(filters: GetPaidTaskListFilters): Prisma.GetPaidTaskWhereInput {
  const where: Prisma.GetPaidTaskWhereInput = {};
  if (filters.activeOnly) where.status = "ACTIVE";
  else if (filters.status) {
    where.status = toInputStatus(filters.status);
  }
  if (filters.showOnDashboard !== undefined) {
    where.showOnDashboard = filters.showOnDashboard;
  }
  if (filters.category) {
    where.category = { name: filters.category };
  }
  if (filters.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [
      { title: { contains: q } },
      { taskType: { contains: q } },
      { category: { name: { contains: q } } },
    ];
  }
  return where;
}

export async function listGetPaidTasks(filters: GetPaidTaskListFilters = {}) {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 100;
  const where = buildTaskWhere(filters);
  const [rows, total] = await Promise.all([
    prisma.getPaidTask.findMany({
      where,
      include: { category: true },
      orderBy: [{ featured: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.getPaidTask.count({ where }),
  ]);
  return {
    items: rows.map(serializeTask),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function getGetPaidTaskById(id: string) {
  const row = await prisma.getPaidTask.findUnique({
    where: { id },
    include: { category: true },
  });
  if (!row) throw Errors.notFound("Get paid task");
  return serializeTask(row);
}

export async function createGetPaidTask(input: {
  title: string;
  category: string;
  descriptionHtml: string;
  descriptionText: string;
  taskType: string;
  requiredAction: string;
  requiredLink?: string;
  additionalInstructions?: string;
  rewardAmount: number;
  dailyLimit?: number;
  totalLimit?: number;
  proofRequired?: boolean;
  deductPoints?: boolean;
  disallowedCountries?: string[];
  status: string;
  showOnDashboard?: boolean;
  featured?: boolean;
  isNew?: boolean;
  startDate?: string;
  endDate?: string;
}) {
  const category = await prisma.getPaidTaskCategory.upsert({
    where: { name: input.category },
    create: { name: input.category, status: "ACTIVE" },
    update: {},
  });
  const row = await prisma.getPaidTask.create({
    data: {
      title: input.title,
      categoryId: category.id,
      descriptionHtml: input.descriptionHtml,
      descriptionText: input.descriptionText,
      taskType: input.taskType,
      requiredAction: input.requiredAction,
      requiredLink: input.requiredLink,
      additionalInstructions: input.additionalInstructions,
      rewardAmount: input.rewardAmount,
      dailyLimit: input.dailyLimit,
      totalLimit: input.totalLimit,
      proofRequired: input.proofRequired ?? true,
      deductPoints: input.deductPoints ?? false,
      disallowedCountries: input.disallowedCountries ?? [],
      status: toInputStatus(input.status),
      showOnDashboard: input.showOnDashboard ?? false,
      featured: input.featured ?? false,
      isNew: input.isNew ?? false,
      startDate: input.startDate ? new Date(input.startDate) : null,
      endDate: input.endDate ? new Date(input.endDate) : null,
    },
    include: { category: true },
  });
  return serializeTask(row);
}

export async function updateGetPaidTask(
  id: string,
  input: Partial<{
    title: string;
    category: string;
    descriptionHtml: string;
    descriptionText: string;
    taskType: string;
    requiredAction: string;
    requiredLink: string;
    additionalInstructions: string;
    rewardAmount: number;
    dailyLimit: number;
    totalLimit: number;
    proofRequired: boolean;
    deductPoints: boolean;
    disallowedCountries: string[];
    status: string;
    showOnDashboard: boolean;
    featured: boolean;
    isNew: boolean;
    startDate: string;
    endDate: string;
  }>,
) {
  const existing = await prisma.getPaidTask.findUnique({ where: { id } });
  if (!existing) throw Errors.notFound("Get paid task");

  let categoryId = existing.categoryId;
  if (input.category) {
    const category = await prisma.getPaidTaskCategory.upsert({
      where: { name: input.category },
      create: { name: input.category, status: "ACTIVE" },
      update: {},
    });
    categoryId = category.id;
  }

  const row = await prisma.getPaidTask.update({
    where: { id },
    data: {
      title: input.title,
      categoryId,
      descriptionHtml: input.descriptionHtml,
      descriptionText: input.descriptionText,
      taskType: input.taskType,
      requiredAction: input.requiredAction,
      requiredLink: input.requiredLink,
      additionalInstructions: input.additionalInstructions,
      rewardAmount: input.rewardAmount,
      dailyLimit: input.dailyLimit,
      totalLimit: input.totalLimit,
      proofRequired: input.proofRequired,
      deductPoints: input.deductPoints,
      disallowedCountries: input.disallowedCountries,
      status: input.status ? toInputStatus(input.status) : undefined,
      showOnDashboard: input.showOnDashboard,
      featured: input.featured,
      isNew: input.isNew,
      startDate: input.startDate ? new Date(input.startDate) : undefined,
      endDate: input.endDate ? new Date(input.endDate) : undefined,
    },
    include: { category: true },
  });
  return serializeTask(row);
}

export async function deleteGetPaidTask(id: string) {
  await prisma.getPaidTask.delete({ where: { id } });
  return { id };
}

export async function listGetPaidTaskCategories() {
  const rows = await prisma.getPaidTaskCategory.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { tasks: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    status: mapCategoryStatus(row.status),
    taskCount: row._count.tasks,
  })) satisfies SerializedTaskCategory[];
}

export async function saveGetPaidTaskCategory(input: {
  id?: string;
  name: string;
  status: "Active" | "Inactive";
}) {
  const status: CatalogCategoryStatus = input.status === "Active" ? "ACTIVE" : "INACTIVE";
  if (input.id) {
    const row = await prisma.getPaidTaskCategory.update({
      where: { id: input.id },
      data: { name: input.name, status },
      include: { _count: { select: { tasks: true } } },
    });
    return {
      id: row.id,
      name: row.name,
      status: mapCategoryStatus(row.status),
      taskCount: row._count.tasks,
    };
  }
  const row = await prisma.getPaidTaskCategory.create({
    data: { name: input.name, status },
    include: { _count: { select: { tasks: true } } },
  });
  return {
    id: row.id,
    name: row.name,
    status: mapCategoryStatus(row.status),
    taskCount: row._count.tasks,
  };
}

export async function deleteGetPaidTaskCategory(id: string) {
  const count = await prisma.getPaidTask.count({ where: { categoryId: id } });
  if (count > 0) throw new AppError("VALIDATION_ERROR", "Category has tasks and cannot be deleted", 422);
  await prisma.getPaidTaskCategory.delete({ where: { id } });
  return { id };
}
