import { notFound } from "next/navigation";
import { FunnelTemplatePreview } from "@/components/admin/funnel-template-preview";
import { PageHeader } from "@/components/layout/page-header";
import { getOptinFunnelTemplateByAdmin } from "@/services/optin-funnel.service";
import { DEFAULT_THEME } from "@/modules/page-builder/lib/theme";
import { parseBreakpointParam } from "@/modules/page-builder/lib/editor-canvas";
import { normalizePreviewCraft } from "@/modules/page-builder/lib/preview-craft";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminFunnelTemplatePreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ step?: string; bp?: string; frame?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const step = query.step === "thankYou" ? "thankYou" : "optin";
  const breakpoint = parseBreakpointParam(query.bp ?? "desktop");
  const matchEditorCanvas = query.frame !== "0";
  let template;
  try {
    template = await getOptinFunnelTemplateByAdmin(id);
  } catch {
    notFound();
  }

  const rawCraft =
    step === "thankYou" ? (template.thankYouCraftState ?? template.craftState) : template.craftState;
  const theme =
    step === "thankYou"
      ? (template.thankYouThemeJson ?? template.themeJson ?? DEFAULT_THEME)
      : (template.themeJson ?? DEFAULT_THEME);

  return (
    <div className="flex min-h-full flex-col">
      <div className="shrink-0 border-b border-border bg-background px-4 py-2.5">
        <PageHeader
          title={template.name || "Template preview"}
          className="space-y-1.5 [&_.premium-page-title]:text-base [&_.premium-page-title]:font-semibold"
          breadcrumbs={[
            { label: "Admin", href: "/admin" },
            { label: "Funnel Templates", href: "/admin/funnel-templates" },
            { label: "Preview" },
          ]}
        />
      </div>
      <div className="min-h-0 flex-1">
        <FunnelTemplatePreview
          templateName={template.name}
          craftState={normalizePreviewCraft(rawCraft)}
          theme={theme}
          breakpoint={breakpoint}
          matchEditorCanvas={matchEditorCanvas}
        />
      </div>
    </div>
  );
}
