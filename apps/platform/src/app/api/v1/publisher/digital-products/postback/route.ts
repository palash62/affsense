import { publisherChannelPostbackCollection } from "@/lib/publisher-channel-postback-routes";

const handlers = publisherChannelPostbackCollection("DIGITAL_PRODUCT");

export const GET = handlers.GET;
export const POST = handlers.POST;
