import { ButtonLink } from "@/components/ui/button-link";
import type { LucideIcon } from "lucide-react";

interface RoleHeroProps {
  eyebrow: string;
  title: string;
  description: string;
  action?: { label: string; href: string; icon: LucideIcon };
}

export function RoleHero({ eyebrow, title, description, action }: RoleHeroProps) {
  const ActionIcon = action?.icon;

  return (
    <div
      className="relative overflow-hidden rounded-[18px] px-6 py-5 shadow-md"
      style={{
        backgroundImage: "linear-gradient(to right, var(--theme-hero-from), var(--theme-hero-to))",
      }}
    >
      <div className="pointer-events-none absolute inset-0 opacity-[0.06]">
        <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white" />
      </div>
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-white/70">{eyebrow}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">{title}</h1>
          <p className="mt-1.5 max-w-lg text-sm text-white/80">{description}</p>
        </div>
        {action && ActionIcon && (
          <ButtonLink
            href={action.href}
            className="shrink-0 rounded-xl bg-card px-4 text-[var(--theme-hero-btn-text)] shadow-sm hover:bg-card/90"
          >
            <ActionIcon className="mr-2 h-4 w-4" />
            {action.label}
          </ButtonLink>
        )}
      </div>
    </div>
  );
}
