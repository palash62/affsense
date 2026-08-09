import { withAuth, parsePagination } from "@/lib/api-handler";
import { errorResponse } from "@/lib/errors";
import {
  listAutomationMetricRecipients,
  type AutomationMetric,
} from "@/modules/email-marketing";

type Params = { params: Promise<{ id: string }> };

const METRICS = new Set<AutomationMetric>([
  "sent",
  "delivered",
  "bounced",
  "opened",
  "clicked",
]);

export async function GET(request: Request, { params }: Params) {
  return withAuth(async (session) => {
    try {
      const { id } = await params;
      const { searchParams } = new URL(request.url);
      const { page, limit } = parsePagination(searchParams);
      const metricRaw = (searchParams.get("metric") ?? "").toLowerCase();
      const stepId = searchParams.get("stepId");

      if (!METRICS.has(metricRaw as AutomationMetric)) {
        return Response.json(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "Invalid metric. Use sent, delivered, bounced, opened, or clicked.",
              status: 422,
            },
          },
          { status: 422 },
        );
      }

      const data = await listAutomationMetricRecipients(session.user.id, id, {
        metric: metricRaw as AutomationMetric,
        stepId: stepId || null,
        page,
        limit: Math.min(limit, 50),
      });

      if (!data) {
        return Response.json(
          { error: { code: "NOT_FOUND", message: "Automation not found", status: 404 } },
          { status: 404 },
        );
      }

      return Response.json({ data });
    } catch (error) {
      return errorResponse(error);
    }
  }, ["ADVERTISER"]);
}
