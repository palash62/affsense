import { describe, expect, it } from "vitest";
import {
  campaignAcceptsDeviceOs,
  filterCampaignsByDeviceOs,
  pickCampaignForIpRotation,
  applySmartLinkCampaignAllowlist,
} from "@/lib/smart-link-rotation";

const campaigns = [
  { id: "camp_a1", advertiserId: "adv_1" },
  { id: "camp_a2", advertiserId: "adv_1" },
  { id: "camp_b1", advertiserId: "adv_2" },
];

describe("pickCampaignForIpRotation", () => {
  it("prefers unseen campaigns from a different advertiser", () => {
    const pick = pickCampaignForIpRotation(campaigns, ["camp_a1"], 0);
    expect(pick?.id).toBe("camp_b1");
  });

  it("picks unseen campaign when no different advertiser exists", () => {
    const pool = [
      { id: "camp_a1", advertiserId: "adv_1" },
      { id: "camp_a2", advertiserId: "adv_1" },
    ];
    const pick = pickCampaignForIpRotation(pool, ["camp_a1"], 0);
    expect(pick?.id).toBe("camp_a2");
  });

  it("returns null when only the same campaign remains", () => {
    const pick = pickCampaignForIpRotation(
      [{ id: "camp_a1", advertiserId: "adv_1" }],
      ["camp_a1"],
      0,
    );
    expect(pick).toBeNull();
  });

  it("returns null when all eligible campaigns were shown and no rotation target exists", () => {
    const single = [{ id: "camp_a1", advertiserId: "adv_1" }];
    const pick = pickCampaignForIpRotation(single, ["camp_a1", "camp_a1"], 3);
    expect(pick).toBeNull();
  });

  it("uses rotation cursor within the chosen pool", () => {
    const pool = [
      { id: "camp_a1", advertiserId: "adv_1" },
      { id: "camp_b2", advertiserId: "adv_2" },
      { id: "camp_c1", advertiserId: "adv_3" },
    ];
    const pick = pickCampaignForIpRotation(pool, [], 1);
    expect(pick?.id).toBe("camp_b2");
  });
});

describe("campaignAcceptsDeviceOs", () => {
  it("accepts all devices when allow list is empty", () => {
    expect(
      campaignAcceptsDeviceOs({ devices: [] }, { device: "Mobile", os: "iOS" }),
    ).toBe(true);
    expect(
      campaignAcceptsDeviceOs({}, { device: "Desktop", os: "Windows" }),
    ).toBe(true);
  });

  it("rejects Mobile when Desktop-only", () => {
    expect(
      campaignAcceptsDeviceOs(
        { devices: ["Desktop"], trafficMode: "allow" },
        { device: "Mobile", os: "iOS" },
      ),
    ).toBe(false);
  });

  it("accepts Desktop when Desktop-only", () => {
    expect(
      campaignAcceptsDeviceOs(
        { devices: ["Desktop"], trafficMode: "allow" },
        { device: "Desktop", os: "Windows" },
      ),
    ).toBe(true);
  });

  it("rejects OS not on allow list", () => {
    expect(
      campaignAcceptsDeviceOs(
        { operatingSystems: ["Windows"], trafficMode: "allow" },
        { device: "Desktop", os: "macOS" },
      ),
    ).toBe(false);
  });

  it("passes unknown UA so rotation does not force global fallback", () => {
    expect(
      campaignAcceptsDeviceOs(
        { devices: ["Desktop"] },
        { device: "—", os: "—" },
      ),
    ).toBe(true);
  });

  it("honors block-mode device blacklist when allow list empty", () => {
    expect(
      campaignAcceptsDeviceOs(
        {
          trafficMode: "block",
          devices: [],
          blacklistedDevices: ["Mobile"],
        },
        { device: "Mobile", os: "Android" },
      ),
    ).toBe(false);
    expect(
      campaignAcceptsDeviceOs(
        {
          trafficMode: "block",
          devices: [],
          blacklistedDevices: ["Mobile"],
        },
        { device: "Desktop", os: "Windows" },
      ),
    ).toBe(true);
  });
});

describe("filterCampaignsByDeviceOs", () => {
  it("leaves empty-device campaigns and drops Desktop-only for mobile", () => {
    const pool = [
      { id: "desktop_only", targeting: { devices: ["Desktop"] } },
      { id: "all_devices", targeting: {} },
      { id: "mobile_ok", targeting: { devices: ["Mobile", "Tablet"] } },
    ];
    const filtered = filterCampaignsByDeviceOs(pool, {
      device: "Mobile",
      os: "iOS",
    });
    expect(filtered.map((c) => c.id)).toEqual(["all_devices", "mobile_ok"]);
  });

  it("returns empty pool when only Desktop-only campaigns remain for mobile", () => {
    const pool = [
      { id: "d1", targeting: { devices: ["Desktop"] } },
      { id: "d2", targeting: { devices: ["Desktop"] } },
    ];
    expect(
      filterCampaignsByDeviceOs(pool, { device: "Mobile", os: "Android" }),
    ).toEqual([]);
  });
});

describe("applySmartLinkCampaignAllowlist", () => {
  const eligible = [
    { id: "camp_a" },
    { id: "camp_b" },
    { id: "camp_c" },
  ];

  function resolveForPublisher(restrict: boolean, allowedIds: string[]) {
    if (!restrict) return eligible;
    return applySmartLinkCampaignAllowlist(eligible, allowedIds);
  }

  it("does not filter when restrict is false", () => {
    expect(resolveForPublisher(false, ["camp_a"]).map((c) => c.id)).toEqual([
      "camp_a",
      "camp_b",
      "camp_c",
    ]);
  });

  it("keeps only selected campaign IDs when restrict is on", () => {
    expect(resolveForPublisher(true, ["camp_a"]).map((c) => c.id)).toEqual(["camp_a"]);
  });

  it("returns none when restrict is on and allowlist is empty", () => {
    expect(resolveForPublisher(true, []).map((c) => c.id)).toEqual([]);
  });
});
