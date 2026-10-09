import type { UserRole } from "@prisma/client";

const DEFAULT_ADMIN_OTP_BYPASS_EMAILS = [
  "ppalash62@gmail.com",
  "affsensellc@gmail.com",
];

/** Non-admin accounts (any role) that sign in with email and password only. */
const DEFAULT_LOGIN_OTP_BYPASS_EMAILS = ["publisher@cpl.local"];

function parseEmailList(raw: string | undefined, defaults: string[]): Set<string> {
  const source = raw?.trim() || defaults.join(",");
  return new Set(
    source
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

let cachedEmails: Set<string> | null = null;
let cachedLoginEmails: Set<string> | null = null;

function getAdminOtpBypassEmails(): Set<string> {
  if (!cachedEmails) {
    cachedEmails = parseEmailList(process.env.ADMIN_OTP_BYPASS_EMAILS, DEFAULT_ADMIN_OTP_BYPASS_EMAILS);
  }
  return cachedEmails;
}

function getLoginOtpBypassEmails(): Set<string> {
  if (!cachedLoginEmails) {
    cachedLoginEmails = parseEmailList(process.env.LOGIN_OTP_BYPASS_EMAILS, DEFAULT_LOGIN_OTP_BYPASS_EMAILS);
  }
  return cachedLoginEmails;
}

export function isAdminOtpBypassEmail(email: string): boolean {
  return getAdminOtpBypassEmails().has(email.trim().toLowerCase());
}

export function canBypassAdminOtp(user: { email: string; role: UserRole }): boolean {
  return user.role === "ADMIN" && isAdminOtpBypassEmail(user.email);
}

/** Admin allowlist (ADMIN role only) or the named non-admin accounts. */
export function canBypassLoginOtp(user: { email: string; role: UserRole }): boolean {
  return canBypassAdminOtp(user) || getLoginOtpBypassEmails().has(user.email.trim().toLowerCase());
}
