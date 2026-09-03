export type ResolvedCpaClickAttribution = {
  /** Platform click id when attributed; otherwise null (free-form network ids are not attributed). */
  attributedClickId: string | null;
  /** Raw inbound click_id for audit only (may be unmatched). */
  inboundClickId: string | null;
  advertiserId: string | null;
  clickRecordId: string | null;
  source: string | null;
  subId: string | null;
};

/** Resolve attribution only from a matching CpaOfferClick for this offer. */
export function resolveCpaClickAttribution(input: {
  offerId: string;
  inboundClickId: string | null;
  click:
    | {
        id: string;
        offerId: string;
        advertiserId: string | null;
        src: string | null;
        subId: string | null;
      }
    | null;
}): ResolvedCpaClickAttribution {
  const inboundClickId = input.inboundClickId;
  if (
    inboundClickId &&
    input.click &&
    input.click.id === inboundClickId &&
    input.click.offerId === input.offerId
  ) {
    return {
      attributedClickId: input.click.id,
      inboundClickId,
      advertiserId: input.click.advertiserId,
      clickRecordId: input.click.id,
      source: input.click.src,
      subId: input.click.subId,
    };
  }

  return {
    attributedClickId: null,
    inboundClickId,
    advertiserId: null,
    clickRecordId: null,
    source: null,
    subId: null,
  };
}
