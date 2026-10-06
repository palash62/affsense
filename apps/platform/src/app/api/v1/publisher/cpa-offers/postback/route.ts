import { publisherChannelPostbackCollection } from "@/lib/publisher-channel-postback-routes";

const handlers = publisherChannelPostbackCollection("CPA");

export const GET = handlers.GET;
export const POST = handlers.POST;
