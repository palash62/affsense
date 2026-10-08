import { getTrackingUrl } from "@cpl/shared";
import { generateSecret, generateSiteKey, isUniqueViolation } from "@cpl/tracking-core";
import { prisma } from "@/lib/prisma";

const API_KEY_PREFIX = "slk";

/** The affiliate's tracking site (created on first visit; the initial API key is never shown). */
export async function getOrCreateSoloTrackingSite(publisherId: string) {
  const existing = await prisma.soloTrackingSite.findUnique({
    where: { publisherId },
    include: { hosts: { orderBy: { lastSeenAt: "desc" } } },
  });
  if (existing) return existing;
  const unused = generateSecret(API_KEY_PREFIX);
  try {
    await prisma.soloTrackingSite.create({
      data: { publisherId, siteKey: generateSiteKey(), apiKeyHash: unused.hash, apiKeyPrefix: "" },
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
  }
  return prisma.soloTrackingSite.findUniqueOrThrow({
    where: { publisherId },
    include: { hosts: { orderBy: { lastSeenAt: "desc" } } },
  });
}

/** Issue a new server lead API key; the previous key stops working immediately. */
export async function rotateSoloLeadApiKey(publisherId: string) {
  await getOrCreateSoloTrackingSite(publisherId);
  const { secret, hash, prefix } = generateSecret(API_KEY_PREFIX);
  await prisma.soloTrackingSite.update({
    where: { publisherId },
    data: { apiKeyHash: hash, apiKeyPrefix: prefix },
  });
  return { apiKey: secret, prefix };
}

export function soloScriptSnippet(siteKey: string) {
  return `<script async src="${getTrackingUrl()}/sa.js?k=${siteKey}"></script>`;
}

export function soloLeadApiUrl() {
  return `${getTrackingUrl()}/api/v1/solo/leads`;
}
