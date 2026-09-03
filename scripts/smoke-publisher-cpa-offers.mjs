import { PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";

async function main() {
  const prisma = new PrismaClient();
  try {
    const offers = await prisma.cpaOffer.findMany({
      select: { id: true, name: true, status: true },
      take: 10,
    });
    console.log("offers", JSON.stringify(offers, null, 2));

    const publisher = await prisma.user.findFirst({
      where: { email: "publisher@cpl.local" },
      select: { id: true, email: true },
    });
    console.log("publisher", publisher);

    let activeOffer = offers.find((o) => o.status === "ACTIVE");
    if (!activeOffer) {
      const created = await prisma.cpaOffer.create({
        data: {
          name: "Smoke Test CPA Offer",
          network: "Direct",
          category: "Finance",
          country: "US",
          previewUrl: "https://example.com/preview",
          trackingUrl: "https://example.com/offer?click_id={click_id}",
          revenue: 10,
          payout: 5,
          status: "ACTIVE",
          postbackToken: randomBytes(16).toString("hex"),
        },
        select: { id: true, name: true, status: true },
      });
      activeOffer = created;
      console.log("created_offer", created);
    }

    const clickCountBefore = await prisma.cpaOfferClick.count({
      where: { publisherId: publisher?.id ?? undefined },
    });

    const trackingUrl = `http://localhost:3021/cpa/${activeOffer.id}?pub_id=${publisher?.id}`;
    const res = await fetch(trackingUrl, { redirect: "manual" });
    console.log("tracking_status", res.status);
    console.log("tracking_location", res.headers.get("location"));

    const clickCountAfter = await prisma.cpaOfferClick.count({
      where: { publisherId: publisher?.id ?? undefined },
    });

    console.log(
      JSON.stringify({
        ok: res.status === 302 && clickCountAfter > clickCountBefore,
        clickCountBefore,
        clickCountAfter,
        activeOfferId: activeOffer.id,
        publisherId: publisher?.id,
      }),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
