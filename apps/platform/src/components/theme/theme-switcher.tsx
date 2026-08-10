"use client";

import { Check, Palette } from "lucide-react";
import { THEMES, type ThemeId } from "@/lib/themes";
import { useTheme } from "@/components/providers/theme-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const swatches: Record<ThemeId, string[]> = {
  "enterprise-blue": ["#1E3A8A", "#4338CA", "#2563EB", "#22C55E"],
  "marketing-saas": ["#0A0A0A", "#141414", "#FF5A1F", "#FAF8F5"],
  "performance-green": ["#0F3D2E", "#166534", "#059669", "#2563EB"],
  "marketplace-purple": ["#4C1D95", "#7C3AED", "#A855F7", "#10B981"],
  "slate-pro": ["#07162D", "#4F46F5", "#713BFF", "#12A150"],
};

interface ThemeSwitcherProps {
  variant?: "dropdown" | "bar";
  className?: string;
}

export function ThemeSwitcher({ variant = "dropdown", className }: ThemeSwitcherProps) {
  const { theme, setTheme } = useTheme();

  if (variant === "bar") {
    return (
      <div className={cn("flex flex-wrap gap-2", className)}>
        {THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTheme(t.id)}
            className={cn(
              "flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-all duration-200",
              theme === t.id
                ? "border-[var(--theme-primary)] bg-card shadow-md ring-2 ring-[var(--theme-primary)]/20"
                : "border-border bg-card/80 hover:border-border hover:shadow-sm",
            )}
          >
            <span className="flex gap-0.5">
              {swatches[t.id].slice(0, 3).map((color) => (
                <span
                  key={color}
                  className="h-4 w-4 rounded-full border border-black/5"
                  style={{ backgroundColor: color }}
                />
              ))}
            </span>
            <span className="font-medium text-foreground">{t.name}</span>
            {theme === t.id && <Check className="ml-1 h-4 w-4 text-[var(--theme-primary)]" />}
          </button>
        ))}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-10 gap-2 rounded-xl border-border bg-card shadow-sm",
              className,
            )}
          />
        }
      >
        <Palette className="h-4 w-4 text-[var(--theme-primary)]" />
        <span className="hidden sm:inline">Theme</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 rounded-xl">
        <DropdownMenuLabel>Color Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {THEMES.map((t) => (
          <DropdownMenuItem
            key={t.id}
            onClick={() => setTheme(t.id)}
            className="flex cursor-pointer items-start gap-3 py-2.5"
          >
            <span className="mt-0.5 flex shrink-0 flex-col gap-0.5">
              {swatches[t.id].map((color) => (
                <span
                  key={color}
                  className="h-2 w-8 rounded-sm"
                  style={{ backgroundColor: color }}
                />
              ))}
            </span>
            <span className="flex-1">
              <span className="flex items-center gap-1.5 font-medium">
                {t.name}
                {theme === t.id && <Check className="h-3.5 w-3.5 text-[var(--theme-primary)]" />}
              </span>
              <span className="block text-xs text-muted-foreground">{t.tagline}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
