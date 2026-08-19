"use client";

import {
  MousePointerClick,
  Users,
  DollarSign,
  Eye,
  UserCheck,
  UserX,
  Link2,
} from "lucide-react";
import { GradientStatCard, NeutralStatCard } from "@/components/admin/gradient-stat-card";
import { formatCurrency } from "@/components/admin/admin-ui";
import type { PromotionReportStats } from "@/services/promotion.service";

export function PromotionKpiRow({ stats }: { stats: PromotionReportStats }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
      <NeutralStatCard label="Total clicks" value={stats.totalClicks} icon={MousePointerClick} accent="purple" />
      <NeutralStatCard label="Total visits" value={stats.totalVisits} icon={Eye} accent="green" />
      <NeutralStatCard label="Unique visitors" value={stats.uniqueVisitors} icon={Users} accent="purple" />
      <NeutralStatCard label="Attributed signups" value={stats.attributedSignups} icon={UserCheck} accent="green" />
      <NeutralStatCard label="Unattributed signups" value={stats.unattributedSignups} icon={UserX} accent="orange" />
      <GradientStatCard
        variant="revenue"
        label="Attributed revenue"
        value={formatCurrency(stats.attributedDeposits)}
        icon={DollarSign}
      />
      <NeutralStatCard label="Active promotions" value={stats.activePromotions} icon={Link2} accent="purple" />
    </div>
  );
}
