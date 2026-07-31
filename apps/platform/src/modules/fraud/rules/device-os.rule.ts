import { parseUserAgent } from "@/lib/publisher-leads";
import type { FraudEvaluationContext } from "../types/context";
import type { FraudConfig } from "../types/config";
import type { RuleOutcome } from "../types/result";

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
}

function isUnknown(value?: string): boolean {
  const v = value?.trim();
  return !v || v === "—" || v === "Unknown";
}

function allowBlockMismatch(
  allow: string[],
  blacklist: string[],
  trafficMode: "allow" | "block",
  value: string,
  label: string,
): string | null {
  if (isUnknown(value)) return null;

  if (allow.length === 0) {
    if (trafficMode === "block" && blacklist.includes(value)) {
      return `${label} ${value} is blocked for campaign`;
    }
    return null;
  }

  if (!allow.includes(value)) {
    return `${label} ${value} not allowed for campaign`;
  }
  if (blacklist.includes(value)) {
    return `${label} ${value} is blocked for campaign`;
  }
  return null;
}

export function deviceOsRule(
  ctx: FraudEvaluationContext,
  config: FraudConfig,
): RuleOutcome | null {
  if (!config.enabledRules.device_os_mismatch) return null;

  const targeting = ctx.targeting ?? {};
  const trafficMode = targeting.trafficMode === "block" ? "block" : "allow";
  const devices = stringList(targeting.devices);
  const operatingSystems = stringList(targeting.operatingSystems);
  const blacklistedDevices = stringList(targeting.blacklistedDevices);
  const blacklistedOperatingSystems = stringList(
    targeting.blacklistedOperatingSystems,
  );

  const hasAnyList =
    devices.length > 0 ||
    operatingSystems.length > 0 ||
    blacklistedDevices.length > 0 ||
    blacklistedOperatingSystems.length > 0;

  if (!hasAnyList) {
    return { rule: "device_os_mismatch", passed: true, riskDelta: 0, hardFail: false };
  }

  const { device, os } = parseUserAgent(ctx.userAgent);

  const deviceDetail = allowBlockMismatch(
    devices,
    blacklistedDevices,
    trafficMode,
    device,
    "Device",
  );
  if (deviceDetail) {
    return {
      rule: "device_os_mismatch",
      passed: false,
      riskDelta: config.weights.device_os_mismatch,
      hardFail: true,
      details: deviceDetail,
    };
  }

  const osDetail = allowBlockMismatch(
    operatingSystems,
    blacklistedOperatingSystems,
    trafficMode,
    os,
    "OS",
  );
  if (osDetail) {
    return {
      rule: "device_os_mismatch",
      passed: false,
      riskDelta: config.weights.device_os_mismatch,
      hardFail: true,
      details: osDetail,
    };
  }

  return { rule: "device_os_mismatch", passed: true, riskDelta: 0, hardFail: false };
}
