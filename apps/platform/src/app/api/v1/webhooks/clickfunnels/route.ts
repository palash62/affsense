import { handleClickFunnelsWebhookPost } from "@/lib/handle-clickfunnels-webhook";

export async function POST(request: Request) {
  return handleClickFunnelsWebhookPost(request);
}
