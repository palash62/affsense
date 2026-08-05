import { describe, expect, it } from "vitest";
import { parseUserAgent } from "@/lib/publisher-leads";
import { campaignAcceptsDeviceOs } from "@/lib/smart-link-rotation";
import { deviceOsRule } from "@/modules/fraud/rules/device-os.rule";
import { DEFAULT_FRAUD_CONFIG } from "@/modules/fraud/config/defaults";
import type { FraudEvaluationContext } from "@/modules/fraud/types/context";

const SAMSUNG_ANDROID_NO_MOBILE_TOKEN =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/29.0 Chrome/122.0.0.0 Safari/537.36";
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const WINDOWS_CHROME =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const IPAD =
  "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1";

describe("parseUserAgent device classification", () => {
  it("classifies Samsung Android without Mobile token as Mobile", () => {
    expect(parseUserAgent(SAMSUNG_ANDROID_NO_MOBILE_TOKEN).device).toBe("Mobile");
    expect(parseUserAgent(SAMSUNG_ANDROID_NO_MOBILE_TOKEN).os).toBe("Android");
  });

  it("classifies iPhone as Mobile", () => {
    expect(parseUserAgent(IPHONE).device).toBe("Mobile");
  });

  it("classifies Windows Chrome as Desktop", () => {
    expect(parseUserAgent(WINDOWS_CHROME).device).toBe("Desktop");
  });

  it("classifies iPad as Tablet", () => {
    expect(parseUserAgent(IPAD).device).toBe("Tablet");
  });
});

describe("Desktop-only campaign rejects phone UAs", () => {
  const targeting = { devices: ["Desktop"], trafficMode: "allow" as const };

  it("rejects via campaignAcceptsDeviceOs for Samsung Android", () => {
    const visitor = parseUserAgent(SAMSUNG_ANDROID_NO_MOBILE_TOKEN);
    expect(campaignAcceptsDeviceOs(targeting, visitor)).toBe(false);
  });

  it("rejects via campaignAcceptsDeviceOs for iPhone", () => {
    const visitor = parseUserAgent(IPHONE);
    expect(campaignAcceptsDeviceOs(targeting, visitor)).toBe(false);
  });

  it("accepts Windows desktop", () => {
    const visitor = parseUserAgent(WINDOWS_CHROME);
    expect(campaignAcceptsDeviceOs(targeting, visitor)).toBe(true);
  });

  it("hard-fails fraud deviceOsRule for Samsung Android", () => {
    const ctx: FraudEvaluationContext = {
      campaignId: "camp_1",
      publisherId: "pub_1",
      data: { email: "user@example.com" },
      existingEmails: [],
      existingPhones: [],
      existingIps: [],
      existingFingerprints: [],
      ipBlocked: false,
      userAgent: SAMSUNG_ANDROID_NO_MOBILE_TOKEN,
      targeting,
    };
    const result = deviceOsRule(ctx, DEFAULT_FRAUD_CONFIG);
    expect(result?.passed).toBe(false);
    expect(result?.hardFail).toBe(true);
    expect(result?.details).toContain("Mobile");
  });
});
