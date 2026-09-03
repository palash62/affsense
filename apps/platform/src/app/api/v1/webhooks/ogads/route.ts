import { errorResponse } from "@/lib/errors";
import { handleOgadsOfferWallPostback } from "@/services/ogads-offer-wall-postback.service";

export async function GET(request: Request) {
  try {
    const data = await handleOgadsOfferWallPostback(request);
    return Response.json({ success: true, data });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  return GET(request);
}
