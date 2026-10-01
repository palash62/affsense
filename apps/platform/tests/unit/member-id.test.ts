import { describe, expect, it } from "vitest";
import { formatMemberId, parseMemberId } from "@cpl/shared";

describe("member id", () => {
  it("formats with AFF prefix", () => {
    expect(formatMemberId(100001)).toBe("AFF100001");
  });

  it("parses AFF ids case-insensitively", () => {
    expect(parseMemberId("AFF100001")).toBe(100001);
    expect(parseMemberId(" aff100002 ")).toBe(100002);
  });

  it("rejects internal ids and junk", () => {
    expect(parseMemberId("cmqywy6qi0003vjucncr9keud")).toBeNull();
    expect(parseMemberId("AFF")).toBeNull();
    expect(parseMemberId("AFF0")).toBeNull();
    expect(parseMemberId("100001")).toBeNull();
    expect(parseMemberId(null)).toBeNull();
  });
});
