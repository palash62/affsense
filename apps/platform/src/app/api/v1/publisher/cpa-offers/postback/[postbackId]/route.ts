import { publisherChannelPostbackItem } from "@/lib/publisher-channel-postback-routes";

const handlers = publisherChannelPostbackItem("CPA");

export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
