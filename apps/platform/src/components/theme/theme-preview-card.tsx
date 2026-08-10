import { Building2, CheckCircle, DollarSign, FileText } from "lucide-react";
import type { ThemeMeta } from "@/lib/themes";
import { cn } from "@/lib/utils";

interface ThemePreviewCardProps {
  meta: ThemeMeta;
  active?: boolean;
}

export function ThemePreviewCard({ meta, active }: ThemePreviewCardProps) {
  const isMarketing = meta.id === "marketing-saas";

  return (
    <div
      data-theme={meta.id}
      className={cn(
        "overflow-hidden rounded-[var(--radius-card,0.875rem)] border bg-[var(--theme-bg)] shadow-[var(--shadow-card)] transition-shadow duration-300",
        active
          ? "border-[var(--theme-primary)] ring-2 ring-[var(--theme-primary)]/25 shadow-md"
          : "border-border",
      )}
    >
      <div className="border-b border-border bg-card px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-foreground">{meta.name}</h3>
            <p className="text-xs text-muted-foreground">{meta.inspiredBy}</p>
          </div>
          {active && (
            <span className="rounded-full bg-[var(--theme-primary)] px-2.5 py-0.5 text-xs font-medium text-white">
              Active
            </span>
          )}
        </div>
      </div>

      <div className="flex min-h-[320px]">
        <div
          className={cn("w-[72px] shrink-0 p-2", isMarketing && "relative")}
          style={{
            backgroundColor: isMarketing ? "var(--theme-sidebar-from)" : undefined,
            backgroundImage: isMarketing
              ? undefined
              : "linear-gradient(to bottom, var(--theme-sidebar-from), var(--theme-sidebar-to))",
          }}
        >
          <div className="mb-3 flex h-7 w-7 items-center justify-center rounded-md bg-white/15 text-[10px] font-bold text-white">
            A
          </div>
          <div className="space-y-1">
            <div
              className={cn(
                "h-6 rounded-md text-[8px] font-medium leading-6 text-center shadow-sm",
                isMarketing
                  ? "bg-[var(--theme-sidebar-active-from)] text-white"
                  : "bg-gradient-to-r from-[var(--theme-sidebar-active-from)] to-[var(--theme-sidebar-active-to)] text-[var(--theme-sidebar-active-text)]",
              )}
              style={
                isMarketing
                  ? { boxShadow: "inset 3px 0 0 var(--theme-primary)" }
                  : undefined
              }
            >
              •
            </div>
            <div className="h-6 rounded-md bg-white/10" />
            <div className="h-6 rounded-md bg-white/10" />
            <div className="h-6 rounded-md bg-white/10" />
          </div>
        </div>

        <div className="flex-1 p-3">
          <div
            className={cn(
              "mb-3 rounded-xl px-3 py-2.5 text-white shadow-sm",
              isMarketing ? "bg-[var(--theme-sidebar-from)]" : "",
            )}
            style={
              isMarketing
                ? undefined
                : {
                    backgroundImage:
                      "linear-gradient(to right, var(--theme-hero-from), var(--theme-hero-to))",
                  }
            }
          >
            <p className="text-[9px] uppercase tracking-wide opacity-80">Dashboard</p>
            <p className="text-xs font-bold">Good Morning, Admin</p>
          </div>

          <div className="mb-3 grid grid-cols-3 gap-1.5">
            <div
              className="rounded-lg p-2 text-white"
              style={{ background: "var(--theme-gradient-revenue)" }}
            >
              <DollarSign className="h-3 w-3 opacity-80" />
              <p className="mt-1 text-[8px] opacity-80">Revenue</p>
              <p className="text-[11px] font-bold">$1,240</p>
            </div>
            <div
              className={cn(
                "rounded-lg p-2",
                isMarketing ? "bg-card text-[var(--foreground)]" : "text-white",
              )}
              style={
                isMarketing ? { border: "1px solid var(--border)" } : { background: "var(--theme-gradient-leads)" }
              }
            >
              <FileText className="h-3 w-3 opacity-80" />
              <p className="mt-1 text-[8px] opacity-80">Leads</p>
              <p className="text-[11px] font-bold">48</p>
            </div>
            <div
              className="rounded-lg p-2 text-white"
              style={{ background: "var(--theme-gradient-approved)" }}
            >
              <CheckCircle className="h-3 w-3 opacity-80" />
              <p className="mt-1 text-[8px] opacity-80">Approved</p>
              <p className="text-[11px] font-bold">32</p>
            </div>
          </div>

          <div className="mb-2 rounded-md border border-border border-t-[2px] border-t-[var(--theme-primary)] bg-card p-2 shadow-sm">
            <div className="flex items-center gap-1.5">
              <div
                className="flex h-5 w-5 items-center justify-center rounded-full"
                style={{ background: "var(--theme-primary-soft)" }}
              >
                <Building2 className="h-2.5 w-2.5 text-[var(--theme-primary)]" />
              </div>
              <div>
                <p className="text-[8px] text-muted-foreground">Advertisers</p>
                <p className="text-[11px] font-bold text-foreground">12</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-2 shadow-sm">
            <div className="mb-1.5 flex items-end gap-1">
              {[40, 65, 45, 80, 55].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-sm"
                  style={{
                    height: `${h * 0.35}px`,
                    backgroundColor: i % 2 === 0 ? "var(--theme-chart-1)" : "var(--theme-chart-2)",
                  }}
                />
              ))}
            </div>
            <p className="text-[8px] text-muted-foreground">Lead trend chart</p>
          </div>
        </div>
      </div>

      <div className="flex gap-1 border-t border-border bg-card px-4 py-2">
        {[
          { label: "Sidebar", var: "--theme-sidebar-from" },
          { label: "Primary", var: "--theme-primary" },
          { label: "Hero", var: "--theme-hero-to" },
          { label: "Success", var: "--theme-success" },
        ].map((s) => (
          <div key={s.var} className="flex items-center gap-1">
            <span
              className="h-3 w-3 rounded-full border border-black/5"
              style={{ backgroundColor: `var(${s.var})` }}
            />
            <span className="text-[9px] text-muted-foreground">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
