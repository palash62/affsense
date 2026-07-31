import { create } from "zustand";
import type { Breakpoint } from "@/modules/page-builder/types/block-props";
import type { ThemeJson } from "@/modules/page-builder/lib/theme";
import { DEFAULT_THEME } from "@/modules/page-builder/lib/theme";
import type { CraftSerializedState } from "@/modules/page-builder/types/page-document";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

export type BuilderConfig = {
  apiBasePath: string;
  listPath: string;
  detailPath?: string;
  publicPathPrefix: string;
  label: string;
  chromeTheme?: "light" | "dark";
  mode?: "landing" | "funnel" | "template" | "page";
  ui?: "ghl" | "classic";
  thankYouEnabled?: boolean;
  /** Admin funnel templates only — draft vs published catalog visibility. */
  templateIsPublished?: boolean;
  customDomainId?: string | null;
  /** Absolute public base URL of a verified custom domain, e.g. https://www.example.com */
  customDomainBase?: string | null;
};

type BuilderUIState = {
  breakpoint: Breakpoint;
  styleBreakpoint: Breakpoint;
  leftTab: "components" | "layers" | "theme";
  leftPanelSection: "quick-add" | "sections" | "rows" | "elements" | "forms" | "layers" | "theme";
  leftPanelOpen: boolean;
  propertiesTab: "general" | "styles" | "animations";
  previewOpen: boolean;
  versionHistoryOpen: boolean;
  pageSettingsOpen: boolean;
  assetPickerOpen: boolean;
  assetPickerOnSelect: ((url: string) => void) | null;
  customCodeEditorNodeId: string | null;
  insertTargetNodeId: string | null;
  saveStatus: SaveStatus;
  theme: ThemeJson;
  thankYouTheme: ThemeJson;
  pageId: string | null;
  pageName: string;
  pageSlug: string;
  campaignId: string | null;
  funnelStep: "optin" | "thankYou";
  builderConfig: BuilderConfig;
  flushSave: (() => Promise<boolean>) | null;
  craftSavedListener: ((step: "optin" | "thankYou", craft: CraftSerializedState) => void) | null;
  setBreakpoint: (bp: Breakpoint) => void;
  setLeftTab: (tab: BuilderUIState["leftTab"]) => void;
  setLeftPanelSection: (section: BuilderUIState["leftPanelSection"]) => void;
  setLeftPanelOpen: (open: boolean) => void;
  setPropertiesTab: (tab: BuilderUIState["propertiesTab"]) => void;
  setPreviewOpen: (open: boolean) => void;
  setVersionHistoryOpen: (open: boolean) => void;
  setPageSettingsOpen: (open: boolean) => void;
  setAssetPickerOpen: (open: boolean) => void;
  openAssetPicker: (onSelect?: (url: string) => void) => void;
  openCustomCodeEditor: (nodeId: string) => void;
  closeCustomCodeEditor: () => void;
  setInsertTargetNodeId: (id: string | null) => void;
  setStyleBreakpoint: (bp: Breakpoint) => void;
  setSaveStatus: (status: SaveStatus) => void;
  setTheme: (theme: ThemeJson) => void;
  setThankYouTheme: (theme: ThemeJson) => void;
  setFunnelStep: (step: "optin" | "thankYou") => void;
  setBuilderConfig: (config: BuilderConfig) => void;
  setFlushSave: (fn: (() => Promise<boolean>) | null) => void;
  setCraftSavedListener: (
    listener: ((step: "optin" | "thankYou", craft: CraftSerializedState) => void) | null,
  ) => void;
  onCraftSaved: (step: "optin" | "thankYou", craft: CraftSerializedState) => void;
  setPageMeta: (meta: {
    pageId?: string;
    pageName?: string;
    pageSlug?: string;
    campaignId?: string | null;
  }) => void;
};

export const useBuilderStore = create<BuilderUIState>((set) => ({
  breakpoint: "desktop",
  styleBreakpoint: "desktop",
  leftTab: "components",
  leftPanelSection: "quick-add",
  leftPanelOpen: true,
  propertiesTab: "general",
  previewOpen: false,
  versionHistoryOpen: false,
  pageSettingsOpen: false,
  assetPickerOpen: false,
  assetPickerOnSelect: null,
  customCodeEditorNodeId: null,
  insertTargetNodeId: null,
  saveStatus: "idle",
  theme: DEFAULT_THEME,
  thankYouTheme: DEFAULT_THEME,
  pageId: null,
  pageName: "",
  pageSlug: "",
  campaignId: null,
  funnelStep: "optin",
  builderConfig: {
    apiBasePath: "/api/v1/advertiser/landing-pages",
    listPath: "/advertiser/landing-pages",
    publicPathPrefix: "/p/",
    label: "Landing Page Builder",
  },
  flushSave: null,
  craftSavedListener: null,
  setBreakpoint: (breakpoint) => set({ breakpoint }),
  setLeftTab: (leftTab) => set({ leftTab }),
  setLeftPanelSection: (leftPanelSection) => set({ leftPanelSection }),
  setLeftPanelOpen: (leftPanelOpen) => set({ leftPanelOpen }),
  setPropertiesTab: (propertiesTab) => set({ propertiesTab }),
  setPreviewOpen: (previewOpen) => set({ previewOpen }),
  setVersionHistoryOpen: (versionHistoryOpen) => set({ versionHistoryOpen }),
  setPageSettingsOpen: (pageSettingsOpen) => set({ pageSettingsOpen }),
  setAssetPickerOpen: (assetPickerOpen) =>
    set(
      assetPickerOpen
        ? { assetPickerOpen: true }
        : { assetPickerOpen: false, assetPickerOnSelect: null },
    ),
  openAssetPicker: (onSelect) => set({ assetPickerOpen: true, assetPickerOnSelect: onSelect ?? null }),
  openCustomCodeEditor: (customCodeEditorNodeId) => set({ customCodeEditorNodeId }),
  closeCustomCodeEditor: () => set({ customCodeEditorNodeId: null }),
  setInsertTargetNodeId: (insertTargetNodeId) => set({ insertTargetNodeId }),
  setStyleBreakpoint: (styleBreakpoint) => set({ styleBreakpoint }),
  setSaveStatus: (saveStatus) => set({ saveStatus }),
  setTheme: (theme) => set({ theme }),
  setThankYouTheme: (thankYouTheme) => set({ thankYouTheme }),
  setFunnelStep: (funnelStep) => set({ funnelStep }),
  setBuilderConfig: (builderConfig) => set({ builderConfig }),
  setFlushSave: (flushSave) => set({ flushSave }),
  setCraftSavedListener: (craftSavedListener) => set({ craftSavedListener }),
  onCraftSaved: (step, craft) => {
    useBuilderStore.getState().craftSavedListener?.(step, craft);
  },
  setPageMeta: (meta) => set((s) => ({ ...s, ...meta })),
}));
