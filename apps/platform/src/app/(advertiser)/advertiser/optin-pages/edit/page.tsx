export const dynamic = "force-dynamic";

import { ArrowLeft, ExternalLink, LayoutTemplate } from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getOptinTemplate } from "@/lib/optin-templates";
import {
  getOrCreateAdvertiserOptinPage,
  resolveTemplateParam,
  selectAdvertiserOptinTemplate,
} from "@/services/optin-page.service";
import { RoleHero } from "@/components/layout/role-hero";
import { OptinPageEditor } from "@/components/advertiser/optin-page-editor";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button-link";

async function getPublicBaseUrl() {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const proto = headerStore.get("x-forwarded-proto") ?? "http";
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

interface PageProps {
  searchParams: Promise<{ template?: string }>;
}

export default async function AdvertiserOptinEditPage({ searchParams }: PageProps) {
  const session = await getSession();
  const params = await searchParams;
  const templateParam = resolveTemplateParam(params.template);

  if (templateParam) {
    await selectAdvertiserOptinTemplate(session!.user.id, templateParam);
    redirect("/advertiser/optin-pages/edit");
  }

  const [page, publicBaseUrl] = await Promise.all([
    getOrCreateAdvertiserOptinPage(session!.user.id),
    getPublicBaseUrl(),
  ]);

  const template = getOptinTemplate(page.templateId);

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center gap-3">
        <ButtonLink href="/advertiser/optin-pages" variant="outline" size="sm">
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          All templates
        </ButtonLink>
        <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
          {template.name}
        </Badge>
      </div>

      <RoleHero
        eyebrow="Advertiser Portal"
        title="Edit Optin Page"
        description={`Customize "${page.title}" and set where visitors go after they opt in.`}
        action={{
          label: page.isPublished ? "View live page" : "Preview",
          href: page.isPublished
            ? `${publicBaseUrl}/o/${page.slug}`
            : `${publicBaseUrl}/o/${page.slug}?preview=1`,
          icon: ExternalLink,
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className={
            page.isPublished
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-200 bg-amber-50 text-amber-700"
          }
        >
          {page.isPublished ? "Published" : "Draft"}
        </Badge>
        <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
          <LayoutTemplate className="mr-1 h-3 w-3" />
          {page.title} · /o/{page.slug}
        </Badge>
      </div>

      <OptinPageEditor
        initialPage={page}
        publicBaseUrl={publicBaseUrl}
        templateName={template.name}
      />
    </div>
  );
}
