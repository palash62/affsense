import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AffiliateInvoiceDocument } from "@/components/invoices/affiliate-invoice-document";
import { AppError } from "@/lib/errors";
import { getSession } from "@/lib/session";
import { getAffiliateInvoiceForPublisher } from "@/services/affiliate-invoice.service";
import { loadAffiliateInvoicingConfig } from "@/services/affiliate-invoicing-settings.service";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const session = await getSession();
    if (!session?.user?.id) return { title: "Invoice" };
    const { id } = await params;
    const invoice = await getAffiliateInvoiceForPublisher(id, session.user.id);
    return { title: `Invoice ${invoice.number}` };
  } catch {
    return { title: "Invoice" };
  }
}

export default async function PublisherInvoicePrintPage({ params }: PageProps) {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  let invoice;
  try {
    invoice = await getAffiliateInvoiceForPublisher(id, session.user.id);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }

  const config = await loadAffiliateInvoicingConfig();

  return (
    <AffiliateInvoiceDocument
      invoice={invoice}
      timezone={session.user.timezone ?? undefined}
      periodTimezone={config.timezone}
    />
  );
}
