import { prisma } from "@cpl/database";
import { parseMemberId } from "@cpl/shared";

/** Active publisher for a `pub_id` that is either a User ID (AFF100001) or a legacy internal id. */
export async function findActivePublisherByRef(ref: string) {
  const memberNo = parseMemberId(ref);
  return prisma.user.findFirst({
    where: {
      ...(memberNo ? { memberNo } : { id: ref }),
      role: "PUBLISHER",
      status: "ACTIVE",
    },
    select: { id: true, memberNo: true },
  });
}
