import type { UserRole } from "@prisma/client";

const DEFAULT_ADMIN_OTP_BYPASS_EMAILS = [
  "ppalash62@gmail.com",
  "affsensellc@gmail.com",
];

function parseAdminOtpBypassEmails(): Set<string> {
  const raw = process.env.ADMIN_OTP_BYPASS_EMAILS?.trim();
  const source = raw || DEFAULT_ADMIN_OTP_BYPASS_EMAILS.join(",");
  return new Set(
    source
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

let cachedEmails: Set<string> | null = null;

function getAdminOtpBypassEmails(): Set<string> {
  if (!cachedEmails) {
    cachedEmails = parseAdminOtpBypassEmails();
  }
  return cachedEmails;
}

export function isAdminOtpBypassEmail(email: string): boolean {
  return getAdminOtpBypassEmails().has(email.trim().toLowerCase());
}

export function canBypassAdminOtp(user: { email: string; role: UserRole }): boolean {
  return user.role === "ADMIN" && isAdminOtpBypassEmail(user.email);
}
