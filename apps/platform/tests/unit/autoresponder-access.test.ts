import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AUTORESPONDER_DEMO_ADVERTISER_EMAIL,
  canAdvertiserAccessAutoresponder,
  getAutoresponderAdvertiserAllowlist,
  isAutoresponderDemoAdvertiser,
  isAutoresponderLive,
} from "@/lib/autoresponder-access";

describe("autoresponder access", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to live when AUTORESPONDER_ADVERTISER_ALLOWLIST is unset", () => {
    vi.stubEnv("AUTORESPONDER_ADVERTISER_ALLOWLIST", undefined);
    expect(getAutoresponderAdvertiserAllowlist()).toBe("live");
    expect(isAutoresponderLive()).toBe(true);
    expect(canAdvertiserAccessAutoresponder("any@example.com")).toBe(true);
  });

  it("treats empty and * as live", () => {
    vi.stubEnv("AUTORESPONDER_ADVERTISER_ALLOWLIST", "");
    expect(getAutoresponderAdvertiserAllowlist()).toBe("live");
    expect(canAdvertiserAccessAutoresponder("any@example.com")).toBe(true);

    vi.stubEnv("AUTORESPONDER_ADVERTISER_ALLOWLIST", "*");
    expect(getAutoresponderAdvertiserAllowlist()).toBe("live");
    expect(canAdvertiserAccessAutoresponder("any@example.com")).toBe(true);
  });

  it("restricts to explicit allowlist when set", () => {
    vi.stubEnv(
      "AUTORESPONDER_ADVERTISER_ALLOWLIST",
      "foo@bar.com, advertiser@cpl.local",
    );
    expect(getAutoresponderAdvertiserAllowlist()).toEqual([
      "foo@bar.com",
      "advertiser@cpl.local",
    ]);
    expect(canAdvertiserAccessAutoresponder("foo@bar.com")).toBe(true);
    expect(canAdvertiserAccessAutoresponder("Advertiser@cpl.local")).toBe(true);
    expect(canAdvertiserAccessAutoresponder("other@example.com")).toBe(false);
  });

  it("rejects empty email", () => {
    vi.stubEnv("AUTORESPONDER_ADVERTISER_ALLOWLIST", "*");
    expect(canAdvertiserAccessAutoresponder("")).toBe(false);
    expect(canAdvertiserAccessAutoresponder(null)).toBe(false);
    expect(canAdvertiserAccessAutoresponder(undefined)).toBe(false);
  });

  it("identifies demo advertiser for wallet bypass only", () => {
    expect(isAutoresponderDemoAdvertiser(AUTORESPONDER_DEMO_ADVERTISER_EMAIL)).toBe(
      true,
    );
    expect(isAutoresponderDemoAdvertiser("Advertiser@cpl.local")).toBe(true);
    expect(isAutoresponderDemoAdvertiser("other@example.com")).toBe(false);
  });
});
