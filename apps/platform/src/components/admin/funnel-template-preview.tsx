"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PageRenderer } from "@/modules/page-builder/components/renderer/page-renderer";
import { PreviewDeviceToolbar } from "@/modules/page-builder/components/renderer/preview-device-toolbar";
import { extractFormJson } from "@/modules/page-builder/lib/extract-form-json";
import { parseBreakpointParam } from "@/modules/page-builder/lib/editor-canvas";
import type { CraftSerializedState } from "@/modules/page-builder/types/page-document";
import type { ThemeJson } from "@/modules/page-builder/lib/theme";
import type { Breakpoint } from "@/modules/page-builder/types/block-props";

type FunnelTemplatePreviewProps = {
  templateName: string;
  craftState: CraftSerializedState;
  theme: ThemeJson;
  breakpoint?: Breakpoint;
  matchEditorCanvas?: boolean;
};

function FunnelTemplatePreviewContent({
  templateName,
  craftState,
  theme,
  breakpoint: initialBreakpoint = "desktop",
  matchEditorCanvas = false,
}: FunnelTemplatePreviewProps) {
  const searchParams = useSearchParams();
  const breakpoint = matchEditorCanvas
    ? parseBreakpointParam(searchParams.get("bp") ?? initialBreakpoint)
    : initialBreakpoint;
  const formJson = extractFormJson(craftState, "");

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
        Preview: <span className="font-semibold">{templateName}</span> — leads are not captured in template preview.
      </div>
      {matchEditorCanvas && <PreviewDeviceToolbar isGhl />}
      <PageRenderer
        craftState={craftState}
        theme={theme}
        formJson={formJson}
        fillParent={matchEditorCanvas}
        breakpoint={breakpoint}
        matchEditorCanvas={matchEditorCanvas}
        isGhl
        onLeadSubmit={async () => {
          /* preview only */
        }}
      />
    </div>
  );
}

export function FunnelTemplatePreview(props: FunnelTemplatePreviewProps) {
  if (!props.matchEditorCanvas) {
    return <FunnelTemplatePreviewContent {...props} />;
  }

  return (
    <Suspense fallback={null}>
      <FunnelTemplatePreviewContent {...props} />
    </Suspense>
  );
}
