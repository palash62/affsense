import { withAuth } from "@/lib/api-handler";
import {
  getAffsensePublisherDashboard,
  type PublisherDashboardPeriod,
} from "@/services/publisher-dashboard.service";

function parsePeriod(value: string | null): PublisherDashboardPeriod {
  if (value === "7d" || value === "30d" || value === "month" || value === "year") {
    return value;
  }
  return "30d";
}

export async function GET(request: Request) {
  return withAuth(async (session) => {
    const { searchParams } = new URL(request.url);
    const period = parsePeriod(searchParams.get("period"));
    const data = await getAffsensePublisherDashboard(session.user.id, period);
    return Response.json({ data });
  }, ["PUBLISHER"]);
}
