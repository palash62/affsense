export const MEMBER_ID_PREFIX = "AFF";

const MEMBER_ID_PATTERN = /^AFF(\d{1,9})$/i;

/** Public User ID shown to members and used in affiliate links, e.g. AFF100001. */
export function formatMemberId(memberNo: number): string {
  return `${MEMBER_ID_PREFIX}${memberNo}`;
}

/** Returns the numeric member number for an AFF-style ref, or null for anything else. */
export function parseMemberId(ref: string | null | undefined): number | null {
  const match = ref?.trim().match(MEMBER_ID_PATTERN);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}
