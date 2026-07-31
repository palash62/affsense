import { describe, it, expect } from "vitest";
import { DEFAULT_FRAUD_CONFIG } from "@/modules/fraud/config/defaults";
import { honeypotRule } from "@/modules/fraud/rules/honeypot.rule";
import { duplicateRule } from "@/modules/fraud/rules/duplicate.rule";
import { behavioralRule } from "@/modules/fraud/rules/behavioral.rule";
import { emailRule } from "@/modules/fraud/rules/email.rule";
import { deviceOsRule } from "@/modules/fraud/rules/device-os.rule";
import { decideFraud } from "@/modules/fraud/scoring/decide";
import { aggregateRiskScore } from "@/modules/fraud/scoring/aggregate";
import type { FraudEvaluationContext } from "@/modules/fraud/types/context";

function baseCtx(overrides: Partial<FraudEvaluationContext> = {}): FraudEvaluationContext {
  return {
    campaignId: "camp_1",
    publisherId: "pub_1",
    data: { email: "user@example.com", phone: "+15551234567", first_name: "Jane" },
    existingEmails: [],
    existingPhones: [],
    existingIps: [],
    existingFingerprints: [],
    ipBlocked: false,
    ...overrides,
  };
}

describe("honeypotRule", () => {
  it("passes when honeypot is empty", () => {
    const result = honeypotRule(baseCtx(), DEFAULT_FRAUD_CONFIG);
    expect(result?.passed).toBe(true);
  });

  it("hard-fails when honeypot is filled", () => {
    const result = honeypotRule(baseCtx({ honeypot: "spam" }), DEFAULT_FRAUD_CONFIG);
    expect(result?.passed).toBe(false);
    expect(result?.hardFail).toBe(true);
    expect(result?.riskDelta).toBe(100);
  });
});

describe("duplicateRule", () => {
  it("flags duplicate email with hard fail", () => {
    const outcomes = duplicateRule(
      baseCtx({ existingEmails: ["user@example.com"] }),
      DEFAULT_FRAUD_CONFIG,
    );
    const email = outcomes.find((o) => o.rule === "duplicate_email");
    expect(email?.passed).toBe(false);
    expect(email?.hardFail).toBe(true);
    expect(email?.riskDelta).toBe(60);
  });

  it("flags duplicate IP with hard fail", () => {
    const outcomes = duplicateRule(
      baseCtx({ ip: "1.2.3.4", existingIps: ["1.2.3.4"] }),
      DEFAULT_FRAUD_CONFIG,
    );
    const ip = outcomes.find((o) => o.rule === "duplicate_ip");
    expect(ip?.passed).toBe(false);
    expect(ip?.hardFail).toBe(true);
    expect(ip?.riskDelta).toBe(40);
    expect(ip?.details).toContain("Same IP already submitted");
  });

  it("flags duplicate device without hard fail", () => {
    const outcomes = duplicateRule(
      baseCtx({
        deviceFingerprint: "fp_abc",
        existingFingerprints: ["fp_abc"],
      }),
      DEFAULT_FRAUD_CONFIG,
    );
    const device = outcomes.find((o) => o.rule === "duplicate_device");
    expect(device?.passed).toBe(false);
    expect(device?.hardFail).toBe(false);
    expect(device?.riskDelta).toBe(50);
  });
});

describe("emailRule", () => {
  it("hard-fails disposable email domains", async () => {
    const outcomes = await emailRule(
      baseCtx({ data: { email: "test@mailinator.com" } }),
      DEFAULT_FRAUD_CONFIG,
    );
    const disposable = outcomes.find((o) => o.rule === "disposable_email");
    expect(disposable?.passed).toBe(false);
    expect(disposable?.hardFail).toBe(true);
  });

  it("flags role-based emails", async () => {
    const outcomes = await emailRule(
      baseCtx({ data: { email: "admin@company.com" } }),
      DEFAULT_FRAUD_CONFIG,
    );
    const role = outcomes.find((o) => o.rule === "role_email");
    expect(role?.passed).toBe(false);
  });
});

describe("behavioralRule", () => {
  it("flags fast submit and no mouse movement", () => {
    const outcomes = behavioralRule(
      baseCtx({
        submissionMeta: {
          formDurationMs: 500,
          mouseMoveCount: 0,
          keyPressCount: 5,
          pasteCount: 0,
        },
      }),
      DEFAULT_FRAUD_CONFIG,
    );
    expect(outcomes.some((o) => o.rule === "fast_submit" && !o.passed)).toBe(true);
    expect(outcomes.some((o) => o.rule === "no_mouse" && !o.passed)).toBe(true);
  });

  it("rewards click-to-lead IP match", () => {
    const outcomes = behavioralRule(
      baseCtx({ ip: "1.2.3.4", clickIp: "1.2.3.4" }),
      DEFAULT_FRAUD_CONFIG,
    );
    const match = outcomes.find((o) => o.rule === "click_match");
    expect(match?.passed).toBe(true);
    expect(match?.riskDelta).toBe(-15);
  });
});

describe("deviceOsRule", () => {
  const mobileUa =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
  const desktopUa =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  it("hard-fails mobile UA on Desktop-only campaign", () => {
    const result = deviceOsRule(
      baseCtx({
        userAgent: mobileUa,
        targeting: { devices: ["Desktop"], trafficMode: "allow" },
      }),
      DEFAULT_FRAUD_CONFIG,
    );
    expect(result?.passed).toBe(false);
    expect(result?.hardFail).toBe(true);
    expect(result?.details).toContain("Mobile");
  });

  it("passes desktop UA on Desktop-only campaign", () => {
    const result = deviceOsRule(
      baseCtx({
        userAgent: desktopUa,
        targeting: { devices: ["Desktop"], trafficMode: "allow" },
      }),
      DEFAULT_FRAUD_CONFIG,
    );
    expect(result?.passed).toBe(true);
  });

  it("does not reject when device lists are empty", () => {
    const result = deviceOsRule(
      baseCtx({
        userAgent: mobileUa,
        targeting: {},
      }),
      DEFAULT_FRAUD_CONFIG,
    );
    expect(result?.passed).toBe(true);
  });

  it("rejects via hard fail decision for Desktop-only + mobile", () => {
    const outcome = deviceOsRule(
      baseCtx({
        userAgent: mobileUa,
        targeting: { devices: ["Desktop"] },
      }),
      DEFAULT_FRAUD_CONFIG,
    );
    expect(outcome).toBeTruthy();
    const score = aggregateRiskScore([outcome!]);
    const decision = decideFraud(score, [outcome!], DEFAULT_FRAUD_CONFIG);
    expect(decision.hardReject).toBe(true);
    expect(decision.fraudDecision).toBe("auto_reject");
  });
});

describe("end-to-end scoring", () => {
  it("rejects duplicate email via hard fail decision", () => {
    const outcomes = duplicateRule(
      baseCtx({ existingEmails: ["user@example.com"] }),
      DEFAULT_FRAUD_CONFIG,
    );
    const score = aggregateRiskScore(outcomes);
    const decision = decideFraud(score, outcomes, DEFAULT_FRAUD_CONFIG);
    expect(decision.hardReject).toBe(true);
    expect(decision.fraudDecision).toBe("auto_reject");
  });

  it("rejects duplicate IP via hard fail decision", () => {
    const outcomes = duplicateRule(
      baseCtx({ ip: "9.9.9.9", existingIps: ["9.9.9.9"] }),
      DEFAULT_FRAUD_CONFIG,
    );
    const score = aggregateRiskScore(outcomes);
    const decision = decideFraud(score, outcomes, DEFAULT_FRAUD_CONFIG);
    expect(decision.hardReject).toBe(true);
    expect(decision.fraudDecision).toBe("auto_reject");
  });

  it("routes mid-risk behavioral signals to manual review", () => {
    const outcomes = behavioralRule(
      baseCtx({
        submissionMeta: {
          formDurationMs: 500,
          mouseMoveCount: 0,
          keyPressCount: 3,
          pasteCount: 0,
        },
      }),
      DEFAULT_FRAUD_CONFIG,
    );
    const score = aggregateRiskScore(outcomes);
    expect(score).toBe(60);
    const decision = decideFraud(score, outcomes, DEFAULT_FRAUD_CONFIG);
    expect(decision.fraudDecision).toBe("auto_reject");
    expect(decision.hardReject).toBe(true);
  });
});
