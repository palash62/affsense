import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AffiliateInvoiceDocument } from "@/components/invoices/affiliate-invoice-document";
import { AppError } from "@/lib/errors";
import { isAdminPortalRole } from "@/lib/admin-portal";
import { getSession, isAuthorizedAppSession } from "@/lib/session";
import { getAffiliateInvoiceById } from "@/services/affiliate-invoice.service";
import { loadAffiliateInvoicingConfig } from "@/services/affiliate-invoicing-settings.service";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const session = await getSession();
  if (!session?.user || !isAdminPortalRole(session.user.role)) {
    return { title: "Invoice" };
  }
  try {
    const { id } = await params;
    const invoice = await getAffiliateInvoiceById(id);
    return { title: `Invoice ${invoice.number}` };
  } catch {
    return { title: "Invoice" };
  }
}

export default async function AdminInvoicePrintPage({ params }: PageProps) {
  const session = await getSession();
  if (!session?.user || !isAdminPortalRole(session.user.role)) {
    redirect("/login");
  }
  if (!(await isAuthorizedAppSession(session))) {
    redirect("/api/auth/signout?callbackUrl=/login");
  }

  const { id } = await params;
  let invoice;
  try {
    invoice = await getAffiliateInvoiceById(id);
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
      showAdminNote
    />
  );
}
