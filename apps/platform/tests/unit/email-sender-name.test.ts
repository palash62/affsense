import { describe, expect, it } from "vitest";
import { withSenderName } from "@/lib/email/addresses";

describe("withSenderName", () => {
  it("adds Affsense as the display name to a bare address", () => {
    expect(withSenderName("support@affsense.com")).toBe("Affsense <support@affsense.com>");
  });

  it("keeps an address that already has a display name", () => {
    expect(withSenderName("Affsense Team <support@affsense.com>")).toBe(
      "Affsense Team <support@affsense.com>",
    );
    expect(withSenderName('"Acme" <hi@acme.test>')).toBe('"Acme" <hi@acme.test>');
  });

  it("trims whitespace", () => {
    expect(withSenderName("  support@affsense.com  ")).toBe("Affsense <support@affsense.com>");
    expect(withSenderName("  Affsense <a@b.com> ")).toBe("Affsense <a@b.com>");
  });
});
