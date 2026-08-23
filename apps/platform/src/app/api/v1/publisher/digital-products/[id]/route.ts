import { withAuth } from "@/lib/api-handler";
import { getPublisherDigitalProduct } from "@/services/digital-product.service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return withAuth(async () => {
    const { id } = await context.params;
    const product = await getPublisherDigitalProduct(id);
    if (!product) {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "Product not found", status: 404 } },
        { status: 404 },
      );
    }
    return Response.json({ data: product });
  }, ["PUBLISHER"]);
}
