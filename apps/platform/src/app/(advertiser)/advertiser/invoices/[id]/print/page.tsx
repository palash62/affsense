import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AdvertiserCpaInvoiceDocument } from "@/components/invoices/advertiser-cpa-invoice-document";
import { canAdvertiserAccessCpaOffers } from "@/lib/cpa-offers-access";
import { getSession } from "@/lib/session";
import { getAdvertiserCpaInvoiceForAdvertiser } from "@/services/advertiser-cpa-invoice.service";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const session = await getSession();
    if (!session?.user?.id) return { title: "Invoice" };
    const { id } = await params;
    const invoice = await getAdvertiserCpaInvoiceForAdvertiser(id, session.user.id);
    return { title: invoice ? `Invoice ${invoice.number}` : "Invoice" };
  } catch {
    return { title: "Invoice" };
  }
}

export default async function AdvertiserCpaInvoicePrintPage({ params }: PageProps) {
  const session = await getSession();
  if (!session?.user?.id || session.user.role !== "ADVERTISER") {
    redirect("/login");
  }
  if (!canAdvertiserAccessCpaOffers(session.user.email)) {
    redirect("/advertiser");
  }

  const { id } = await params;
  const invoice = await getAdvertiserCpaInvoiceForAdvertiser(id, session.user.id);
  if (!invoice) notFound();

  return (
    <AdvertiserCpaInvoiceDocument
      invoice={invoice}
      timezone={session.user.timezone ?? undefined}
    />
  );
}
