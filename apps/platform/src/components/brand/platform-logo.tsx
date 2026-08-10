import { cn } from "@/lib/utils";

export interface PlatformLogoProps {
  className?: string;
  markClassName?: string;
  collapsed?: boolean;
  variant?: "default" | "sidebar";
  /** Affsense admin chrome: show "Admin Panel" under the wordmark */
  adminPanel?: boolean;
}

function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius)] bg-gradient-to-br from-[var(--theme-primary)] to-[var(--theme-accent-purple,#713BFF)] text-sm font-bold text-white shadow-sm",
        className,
      )}
      aria-hidden
    >
      A
    </span>
  );
}

export function PlatformLogo({
  className,
  markClassName,
  collapsed,
  variant = "default",
  adminPanel = false,
}: PlatformLogoProps) {
  if (collapsed) {
    return (
      <span className={cn("inline-flex", className)} aria-label="Affsense">
        <LogoMark />
      </span>
    );
  }

  if (variant === "sidebar") {
    if (adminPanel) {
      return (
        <span className={cn("flex items-center gap-2.5", className)}>
          <LogoMark />
          <span className="flex flex-col leading-tight">
            <span className="text-[1.25rem] font-bold tracking-tight">
              <span className="text-white">Aff</span>
              <span className="text-[var(--theme-primary)]">sense</span>
            </span>
            <span className="text-[11px] font-medium tracking-wide text-white/50">
              Admin Panel
            </span>
          </span>
        </span>
      );
    }

    return (
      <span className={cn("inline-flex items-center gap-1.5 font-semibold text-white", className)}>
        <span className={cn("text-white", markClassName)}>✦</span>
        Affsense
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5 font-semibold", className)}>
      <span className={cn("text-[var(--theme-primary)]", markClassName)}>✦</span>
      Affsense
    </span>
  );
}
