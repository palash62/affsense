import { Prisma } from "@prisma/client";
import { isStalePrismaClientError } from "@cpl/database";

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number = 400,
    public field?: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

const PROVIDER_ENUM_TRUNCATED = "Data truncated for column 'provider'";

function stringifyError(error: unknown): string {
  if (error instanceof Error) {
    const parts = [error.message, error.stack ?? ""];
    const cause = (error as Error & { cause?: unknown }).cause;
    if (cause instanceof Error) {
      parts.push(cause.message, cause.stack ?? "");
    } else if (cause != null) {
      parts.push(String(cause));
    }
    return parts.join("\n");
  }
  return String(error);
}

function isProviderEnumOutdated(error: unknown): boolean {
  return stringifyError(error).includes(PROVIDER_ENUM_TRUNCATED);
}

function providerEnumOutdatedResponse(requestId?: string) {
  return Response.json(
    {
      error: {
        code: "DATABASE_SCHEMA_OUTDATED",
        message:
          "Systeme.io is not enabled in the database yet. Run npm run db:push (or apply the latest migrations) and try again.",
        status: 503,
        requestId,
      },
    },
    { status: 503 },
  );
}

function stalePrismaSchemaResponse(requestId?: string) {
  return Response.json(
    {
      error: {
        code: "DATABASE_SCHEMA_OUTDATED",
        message:
          "The server is using an outdated database client. Run npm run db:push, restart the dev server, and try again.",
        status: 503,
        requestId,
      },
    },
    { status: 503 },
  );
}

export function readApiErrorMessage(data: unknown, fallback: string, status?: number): string {
  if (!data || typeof data !== "object") {
    return status ? `${fallback} (HTTP ${status})` : fallback;
  }

  const payload = data as {
    error?: { message?: string };
    message?: string;
    issues?: Array<{ message?: string; path?: Array<string | number> }>;
  };

  if (typeof payload.error?.message === "string" && payload.error.message.trim()) {
    return payload.error.message;
  }
  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message;
  }

  const issue = payload.issues?.find((item) => item.message?.trim());
  if (issue?.message) {
    const path = issue.path?.length ? `${issue.path.join(".")}: ` : "";
    return `${path}${issue.message}`;
  }

  return status ? `${fallback} (HTTP ${status})` : fallback;
}

export function errorResponse(error: unknown, requestId?: string) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
    return Response.json(
      {
        error: {
          code: "RECORD_NOT_FOUND",
          message: "The requested record no longer exists",
          status: 404,
          requestId,
        },
      },
      { status: 404 },
    );
    }

    if (error.code === "P2002") {
      return Response.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "A template with this name already exists. Try a different name.",
            status: 422,
            requestId,
          },
        },
        { status: 422 },
      );
    }

    if (error.code === "P2000") {
      return Response.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "This value is too long to save. Shorten the text and try again.",
            status: 422,
            requestId,
          },
        },
        { status: 422 },
      );
    }
  }

  if (error instanceof AppError) {
    return Response.json(
      {
        error: {
          code: error.code,
          message: error.message,
          field: error.field,
          status: error.status,
          requestId,
        },
      },
      { status: error.status },
    );
  }

  if (isProviderEnumOutdated(error)) {
    return providerEnumOutdatedResponse(requestId);
  }

  if (isStalePrismaClientError(error)) {
    return stalePrismaSchemaResponse(requestId);
  }

  if (error instanceof Error && error.message.trim()) {
    console.error(error);
    const message =
      process.env.NODE_ENV === "production" ? "Internal server error" : error.message;
    return Response.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message,
          status: 500,
          requestId,
        },
      },
      { status: 500 },
    );
  }

  console.error(error);
  return Response.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal server error",
        status: 500,
        requestId,
      },
    },
    { status: 500 },
  );
}

export const Errors = {
  invalidCredentials: () =>
    new AppError("AUTH_INVALID_CREDENTIALS", "Invalid email or password", 401),
  forbidden: () =>
    new AppError("PERMISSION_DENIED", "You do not have permission", 403),
  notFound: (entity: string) =>
    new AppError(`${entity.toUpperCase()}_NOT_FOUND`, `${entity} not found`, 404),
  duplicateLead: () =>
    new AppError(
      "LEAD_DUPLICATE",
      "This lead has already been submitted",
      422,
      "email",
    ),
  insufficientFunds: () =>
    new AppError(
      "WALLET_INSUFFICIENT_FUNDS",
      "Please add funds to continue",
      422,
    ),
  budgetExceeded: () =>
    new AppError(
      "CAMPAIGN_BUDGET_EXCEEDED",
      "Campaign paused — budget exhausted",
      422,
    ),
  payoutBelowMinimum: (min: number) =>
    new AppError(
      "PAYOUT_BELOW_MINIMUM",
      `Minimum payout is $${min}`,
      422,
    ),
  duplicatePayout: () =>
    new AppError(
      "PAYOUT_DUPLICATE_REQUEST",
      "A payout request with this key already exists",
      422,
    ),
  payoutWeeklyLimit: (nextAllowedAt: Date) =>
    new AppError(
      "PAYOUT_WEEKLY_LIMIT",
      `You can only request one payout per week. You can submit your next request after ${nextAllowedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}.`,
      422,
    ),
  validation: (message: string, field?: string) =>
    new AppError("VALIDATION_ERROR", message, 422, field),
  campaignHasLeads: () =>
    new AppError(
      "CAMPAIGN_HAS_LEADS",
      "Campaigns with leads cannot be deleted",
      422,
    ),
  campaignIsActive: () =>
    new AppError(
      "CAMPAIGN_IS_ACTIVE",
      "Pause or archive the campaign before deleting",
      422,
    ),
  campaignReadOnly: () =>
    new AppError(
      "CAMPAIGN_READ_ONLY",
      "This campaign cannot be edited",
      422,
    ),
  campaignInvalidTransition: (message: string) =>
    new AppError("CAMPAIGN_INVALID_TRANSITION", message, 422),
};
