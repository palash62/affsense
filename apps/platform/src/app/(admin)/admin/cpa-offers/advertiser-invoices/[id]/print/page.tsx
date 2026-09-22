import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AdvertiserCpaInvoiceDocument } from "@/components/invoices/advertiser-cpa-invoice-document";
import { getSession } from "@/lib/session";
import { getAdvertiserCpaInvoiceForAdmin } from "@/services/advertiser-cpa-invoice.service";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const session = await getSession();
    if (!session?.user?.id) return { title: "Invoice" };
    const { id } = await params;
    const invoice = await getAdvertiserCpaInvoiceForAdmin(id);
    return { title: invoice ? `Invoice ${invoice.number}` : "Invoice" };
  } catch {
    return { title: "Invoice" };
  }
}

export default async function AdminAdvertiserCpaInvoicePrintPage({ params }: PageProps) {
  const session = await getSession();
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    redirect("/login");
  }

  const { id } = await params;
  const invoice = await getAdvertiserCpaInvoiceForAdmin(id);
  if (!invoice) notFound();

  return (
    <AdvertiserCpaInvoiceDocument
      invoice={invoice}
      timezone={session.user.timezone ?? undefined}
      showAdminNote
    />
  );
}
