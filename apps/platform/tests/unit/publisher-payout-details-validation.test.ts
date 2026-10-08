import { describe, expect, it } from "vitest";
import { updatePublisherProfileSchema } from "@/lib/validations";

const base = { name: "Test Affiliate", updatePayoutDetails: true };
const fullBank = { country: "CA", beneficiaryName: "Jane Doe", accountNumber: "12345678" };

describe("publisher payout details validation", () => {
  it("saves Wise only without a default and makes Wise the default", () => {
    const result = updatePublisherProfileSchema.safeParse({ ...base, payoutWiseId: "jane@example.com" });
    expect(result.success).toBe(true);
    expect(result.data?.defaultPayoutMethod).toBe("WISE");
    expect(result.data?.payoutBankDetails).toBeNull();
  });

  it("ignores a bank form with only a country when Wise is used", () => {
    const result = updatePublisherProfileSchema.safeParse({
      ...base,
      payoutWiseId: "jane@example.com",
      payoutBankDetails: { country: "US", beneficiaryName: "", accountNumber: "" },
    });
    expect(result.success).toBe(true);
    expect(result.data?.payoutBankDetails).toBeNull();
    expect(result.data?.defaultPayoutMethod).toBe("WISE");
  });

  it("drops a half-filled bank form when Wise is the default", () => {
    const result = updatePublisherProfileSchema.safeParse({
      ...base,
      payoutWiseId: "jane@example.com",
      payoutBankDetails: { country: "US", beneficiaryName: "Jane", accountNumber: "" },
      defaultPayoutMethod: "WISE",
    });
    expect(result.success).toBe(true);
    expect(result.data?.payoutBankDetails).toBeNull();
  });

  it("rejects a half-filled bank form when Bank is the default", () => {
    const result = updatePublisherProfileSchema.safeParse({
      ...base,
      payoutBankDetails: { country: "CA", beneficiaryName: "Jane Doe", accountNumber: "" },
      defaultPayoutMethod: "BANK_TRANSFER",
    });
    expect(result.success).toBe(false);
  });

  it("saves complete bank details only and makes Bank the default", () => {
    const result = updatePublisherProfileSchema.safeParse({ ...base, payoutBankDetails: fullBank });
    expect(result.success).toBe(true);
    expect(result.data?.defaultPayoutMethod).toBe("BANK_TRANSFER");
    expect(result.data?.payoutBankDetails).toMatchObject(fullBank);
  });

  it("requires a default when both methods are filled in", () => {
    const result = updatePublisherProfileSchema.safeParse({
      ...base,
      payoutWiseId: "jane@example.com",
      payoutBankDetails: fullBank,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["defaultPayoutMethod"]);
  });

  it("rejects a default when its method is empty", () => {
    expect(updatePublisherProfileSchema.safeParse({ ...base, defaultPayoutMethod: "WISE" }).success).toBe(false);
    expect(
      updatePublisherProfileSchema.safeParse({ ...base, defaultPayoutMethod: "BANK_TRANSFER" }).success,
    ).toBe(false);
  });

  it("allows clearing all payout details", () => {
    const result = updatePublisherProfileSchema.safeParse({ ...base, payoutWiseId: null, payoutBankDetails: null });
    expect(result.success).toBe(true);
    expect(result.data?.defaultPayoutMethod).toBeNull();
  });

  it("leaves payout fields alone on a plain profile update", () => {
    const result = updatePublisherProfileSchema.safeParse({ name: "Test Affiliate", payoutBankDetails: { country: "US" } });
    expect(result.success).toBe(true);
    expect(result.data?.payoutBankDetails).toBeUndefined();
  });
});
