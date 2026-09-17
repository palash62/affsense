export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getSession } from "@/lib/session";
import { getLandingPageDraftPreview } from "@/modules/page-builder/server";
import { PublishedPage } from "@/modules/page-builder";
import { PageHeader } from "@/components/layout/page-header";

export default async function LandingPagePreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ slug?: string }>;
}) {
  const session = await getSession();
  const { slug } = await searchParams;

  if (!session || session.user.role !== "ADVERTISER" || !slug) {
    notFound();
  }

  const page = await getLandingPageDraftPreview(slug, session.user.id);
  if (!page) notFound();

  return (
    <div className="flex min-h-screen flex-col">
      <div className="shrink-0 border-b border-border bg-background px-4 py-2.5">
        <PageHeader
          title="Preview"
          className="space-y-1.5 [&_.premium-page-title]:text-base [&_.premium-page-title]:font-semibold"
          breadcrumbs={[
            { label: "Advertiser", href: "/advertiser" },
            { label: "Landing Pages", href: "/advertiser/landing-pages" },
            { label: "Preview" },
          ]}
        />
      </div>
      <PublishedPage
        slug={page.slug}
        craftState={page.craftState}
        theme={page.themeJson}
        formJson={page.formJson}
      />
    </div>
  );
}
