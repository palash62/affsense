export type FraudDecisionType = "auto_approve" | "manual_review" | "auto_reject";

export type FraudRuleWeights = {
  duplicate_email: number;
  duplicate_phone: number;
  duplicate_ip: number;
  duplicate_device: number;
  vpn_proxy: number;
  disposable_email: number;
  role_email: number;
  geo_mismatch: number;
  device_os_mismatch: number;
  fast_submit: number;
  no_mouse: number;
  paste_only: number;
  honeypot: number;
  residential_ip: number;
  click_match: number;
};

export type FraudConfig = {
  useRiskDecision: boolean;
  autoApproveMax: number;
  manualReviewMax: number;
  minFormDurationMs: number;
  duplicateIpWindowHours: number;
  enabledRules: Record<string, boolean>;
  weights: FraudRuleWeights;
};
