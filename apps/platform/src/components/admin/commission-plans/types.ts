import { readApiErrorMessage } from "@/lib/errors";

export type CommissionPlanKind = "cpa" | "digital";

export type PlanAffiliate = {
  publisherId: string;
  name: string;
  email: string;
};

export type PlanUpsellOption = {
  pageSlug: string;
  name: string;
  commissionPct: number;
};

export type CommissionPlanDraft = {
  /** Server id once the plan is saved. */
  id?: string;
  key: string;
  name: string;
  isActive: boolean;
  payout: string;
  frontEndCommission: string;
  /** Upsell page slug → commission %. */
  upsellRates: Record<string, string>;
  members: PlanAffiliate[];
};

type PlanDto = {
  id: string;
  name: string;
  isActive: boolean;
  payout?: number;
  frontEndCommission?: number;
  upsellRates?: { pageSlug: string; commissionPct: number }[];
  members: PlanAffiliate[];
};

let draftSeq = 0;

export function newDraftKey() {
  draftSeq += 1;
  return `draft-${Date.now()}-${draftSeq}`;
}

export function draftFromDto(dto: PlanDto): CommissionPlanDraft {
  return {
    id: dto.id,
    key: dto.id,
    name: dto.name,
    isActive: dto.isActive,
    payout: dto.payout != null ? String(dto.payout) : "",
    frontEndCommission: dto.frontEndCommission != null ? String(dto.frontEndCommission) : "",
    upsellRates: Object.fromEntries(
      (dto.upsellRates ?? []).map((r) => [r.pageSlug, String(r.commissionPct)]),
    ),
    members: dto.members ?? [],
  };
}

export function draftToPayload(kind: CommissionPlanKind, draft: CommissionPlanDraft) {
  const base = {
    name: draft.name.trim(),
    isActive: draft.isActive,
    publisherIds: draft.members.map((m) => m.publisherId),
  };
  if (kind === "cpa") {
    return { ...base, payout: Number(draft.payout) || 0 };
  }
  return {
    ...base,
    frontEndCommission: Number(draft.frontEndCommission) || 0,
    upsellRates: Object.entries(draft.upsellRates)
      .filter(([, pct]) => pct.trim() !== "" && Number.isFinite(Number(pct)))
      .map(([pageSlug, pct]) => ({ pageSlug, commissionPct: Number(pct) })),
  };
}

export function commissionPlansBaseUrl(kind: CommissionPlanKind, entityId: string) {
  return kind === "cpa"
    ? `/api/v1/admin/cpa-offers/${entityId}/commission-plans`
    : `/api/v1/admin/digital-products/${entityId}/commission-plans`;
}

export async function saveCommissionPlan(
  kind: CommissionPlanKind,
  entityId: string,
  draft: CommissionPlanDraft,
): Promise<CommissionPlanDraft> {
  const base = commissionPlansBaseUrl(kind, entityId);
  const res = await fetch(draft.id ? `${base}/${draft.id}` : base, {
    method: draft.id ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(draftToPayload(kind, draft)),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(readApiErrorMessage(json, "Could not save commission plan", res.status));
  }
  return draftFromDto(json.data);
}

/** POST unsaved plans after the product is created. Returns the number that failed. */
export async function saveCommissionPlanDrafts(
  kind: CommissionPlanKind,
  entityId: string,
  drafts: CommissionPlanDraft[],
): Promise<number> {
  let failed = 0;
  for (const draft of drafts) {
    try {
      await saveCommissionPlan(kind, entityId, { ...draft, id: undefined });
    } catch {
      failed += 1;
    }
  }
  return failed;
}
