"use client";

import Link from "next/link";
import { THEMES } from "@/lib/themes";
import { useTheme } from "@/components/providers/theme-provider";
import { ThemePreviewCard } from "@/components/theme/theme-preview-card";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { PageHeader } from "@/components/layout/page-header";

export default function ThemePreviewPage() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Compare Color Themes"
        description="Pick a theme below to apply it across the entire site. Each preview shows sidebar, hero, KPI cards, and chart colors. Your choice is saved automatically."
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Themes" },
        ]}
      >
        <ThemeSwitcher variant="bar" className="max-w-full" />
      </PageHeader>

      <div className="rounded-[var(--radius-card,0.875rem)] border border-border bg-card p-4 shadow-[var(--shadow-card)]">
        <p className="mb-3 text-sm font-medium text-foreground">
          Live site theme:{" "}
          <span className="text-[var(--theme-primary)]">
            {THEMES.find((t) => t.id === theme)?.name}
          </span>
        </p>
        <p className="text-xs text-muted-foreground">
          Click any preview card or use the buttons above to switch. Your choice is saved to{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-[11px]">cpl-theme</code> in
          localStorage.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {THEMES.map((meta) => (
          <button
            key={meta.id}
            type="button"
            onClick={() => setTheme(meta.id)}
            className="text-left transition-transform duration-200 hover:scale-[1.01] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-primary)] focus-visible:ring-offset-2"
          >
            <ThemePreviewCard meta={meta} active={theme === meta.id} />
          </button>
        ))}
      </div>

      <div className="rounded-[18px] border border-dashed border-border bg-muted/80 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          After choosing, go to{" "}
          <Link href="/admin" className="font-medium text-[var(--theme-primary)] hover:underline">
            Admin Dashboard
          </Link>{" "}
          to see the full theme applied to sidebar, header, and all pages.
        </p>
      </div>
    </div>
  );
}
