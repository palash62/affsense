import { withAuth, parsePagination } from "@/lib/api-handler";
import { listPublisherDigitalProducts } from "@/services/digital-product.service";

export async function GET(request: Request) {
  return withAuth(async () => {
    const { searchParams } = new URL(request.url);
    const { page, limit } = parsePagination(searchParams);
    const data = await listPublisherDigitalProducts({
      q: searchParams.get("q") ?? undefined,
      category: searchParams.get("category") ?? undefined,
      page,
      limit,
    });
    return Response.json({ data });
  }, ["PUBLISHER"]);
}
