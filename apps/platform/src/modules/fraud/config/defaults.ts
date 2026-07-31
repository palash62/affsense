import type { FraudConfig } from "../types/config";

export const FRAUD_SETTINGS_KEY = "fraud_config";

export const DEFAULT_FRAUD_CONFIG: FraudConfig = {
  useRiskDecision: false,
  autoApproveMax: 20,
  manualReviewMax: 50,
  minFormDurationMs: 3000,
  duplicateIpWindowHours: 24,
  enabledRules: {
    honeypot: true,
    duplicate_email: true,
    duplicate_phone: true,
    duplicate_ip: true,
    duplicate_device: true,
    disposable_email: true,
    role_email: true,
    geo_mismatch: true,
    device_os_mismatch: true,
    vpn_proxy: true,
    behavioral: true,
    blocklist: true,
  },
  weights: {
    duplicate_email: 60,
    duplicate_phone: 60,
    duplicate_ip: 40,
    duplicate_device: 50,
    vpn_proxy: 20,
    disposable_email: 40,
    role_email: 15,
    geo_mismatch: 40,
    device_os_mismatch: 40,
    fast_submit: 35,
    no_mouse: 25,
    paste_only: 20,
    honeypot: 100,
    residential_ip: -10,
    click_match: -15,
  },
};
