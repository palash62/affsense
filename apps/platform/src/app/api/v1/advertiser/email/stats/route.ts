import { withAuth } from "@/lib/api-handler";
import {
  getEmailStats,
  getSendTrend,
  getRecentActivity,
} from "@/modules/email-marketing";

export async function GET(request: Request) {
  return withAuth(async (session) => {
    const { searchParams } = new URL(request.url);
    const days = Math.min(Number(searchParams.get("days")) || 30, 90);
    const activityLimit = Math.min(
      Number(searchParams.get("activityLimit")) || 10,
      50,
    );

    const [stats, trend, activity] = await Promise.all([
      getEmailStats(session.user.id),
      getSendTrend(session.user.id, days),
      getRecentActivity(session.user.id, activityLimit),
    ]);

    return Response.json({ data: { ...stats, trend, activity } });
  }, ["ADVERTISER"]);
}
