import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AppError, Errors, errorResponse } from "@/lib/errors";
import { Prisma } from "@prisma/client";

describe("Error handling", () => {
  it("creates AppError with code and status", () => {
    const err = new AppError("TEST_ERROR", "Test message", 422, "email");
    expect(err.code).toBe("TEST_ERROR");
    expect(err.status).toBe(422);
    expect(err.field).toBe("email");
  });

  it("provides standard error factories", () => {
    expect(Errors.duplicateLead().code).toBe("LEAD_DUPLICATE");
    expect(Errors.insufficientFunds().code).toBe("WALLET_INSUFFICIENT_FUNDS");
    expect(Errors.payoutBelowMinimum(50).message).toContain("50");
  });

  it("maps provider enum truncation to DATABASE_SCHEMA_OUTDATED", async () => {
    const err = new Prisma.PrismaClientUnknownRequestError("create failed", {
      clientVersion: "6.19.3",
    });
    Object.assign(err, {
      message: "Invalid create()\nData truncated for column 'provider' at row 1",
    });

    const res = errorResponse(err);
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.error.code).toBe("DATABASE_SCHEMA_OUTDATED");
    expect(body.error.message).toContain("db:push");
  });

  it("maps provider enum truncation from error cause text", async () => {
    const err = new Error("Query failed");
    (err as Error & { cause: Error }).cause = new Error(
      "Data truncated for column 'provider' at row 1",
    );

    const res = errorResponse(err);
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.error.code).toBe("DATABASE_SCHEMA_OUTDATED");
  });

  it("maps unknown Prisma argument errors to DATABASE_SCHEMA_OUTDATED", async () => {
    const err = new Error(
      "Invalid `prisma.pageTemplate.create()` invocation:\n\nUnknown argument `destinationUrl`.",
    );

    const res = errorResponse(err);
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.error.code).toBe("DATABASE_SCHEMA_OUTDATED");
    expect(body.error.message).toContain("db:push");
  });

  it("maps Prisma P2000 to a generic too-long message", async () => {
    const err = new Prisma.PrismaClientKnownRequestError("The provided value for the column is too long", {
      code: "P2000",
      clientVersion: "6.19.3",
    });

    const res = errorResponse(err);
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toBe("This value is too long to save. Shorten the text and try again.");
    expect(body.error.message).not.toContain("Template name");
  });
});

describe("Ledger math", () => {
  it("calculates platform fee correctly", () => {
    const cpl = 25;
    const feePercent = 10;
    const fee = (cpl * feePercent) / 100;
    const publisherAmount = cpl - fee;
    expect(fee).toBe(2.5);
    expect(publisherAmount).toBe(22.5);
    expect(fee + publisherAmount).toBe(cpl);
  });

  it("detects budget exhaustion", () => {
    const budget = 500;
    const spent = 500;
    const cpl = 25;
    expect(spent >= budget).toBe(true);
    expect(spent + cpl > budget).toBe(true);
  });
});
