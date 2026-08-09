import { withAuth } from "@/lib/api-handler";
import {
  assertStatsScopeOwnership,
  getEmailStats,
  getSendTrend,
  getRecentActivity,
  type StatsSource,
  getEmailWalletSnapshot,
} from "@/modules/email-marketing";

const SOURCES = new Set<StatsSource>(["all", "broadcast", "automation"]);

export async function GET(request: Request) {
  return withAuth(async (session) => {
    const { searchParams } = new URL(request.url);
    const days = Math.min(Number(searchParams.get("days")) || 30, 90);
    const activityLimit = Math.min(
      Number(searchParams.get("activityLimit")) || 10,
      50,
    );

    const sourceRaw = (searchParams.get("source") ?? "all").toLowerCase();
    const source: StatsSource = SOURCES.has(sourceRaw as StatsSource)
      ? (sourceRaw as StatsSource)
      : "all";
    const broadcastId = searchParams.get("broadcastId")?.trim() || undefined;
    const automationId = searchParams.get("automationId")?.trim() || undefined;

    const ownership = await assertStatsScopeOwnership(session.user.id, {
      source,
      broadcastId,
      automationId,
    });
    if (!ownership.ok) {
      return Response.json(
        {
          error: {
            code: "NOT_FOUND",
            message:
              source === "broadcast"
                ? "Broadcast not found"
                : "Automation not found",
            status: 404,
          },
        },
        { status: 404 },
      );
    }

    const scope = ownership.scope;

    const [stats, trend, activity, wallet] = await Promise.all([
      getEmailStats(session.user.id, scope),
      getSendTrend(session.user.id, days, scope),
      getRecentActivity(session.user.id, activityLimit, scope),
      getEmailWalletSnapshot(session.user.id),
    ]);

    return Response.json({
      data: {
        ...stats,
        trend,
        activity,
        emailsRemaining: wallet.emailsRemaining,
        emailWalletBalance: wallet.balance,
        emailsPerDollar: wallet.emailsPerDollar,
      },
    });
  }, ["ADVERTISER"]);
}
