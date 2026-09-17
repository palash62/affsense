import { PageHeader } from "@/components/layout/page-header";
import { ButtonLink } from "@/components/ui/button-link";
import type { LucideIcon } from "lucide-react";

interface RoleHeroProps {
  eyebrow: string;
  title: string;
  description: string;
  action?: { label: string; href: string; icon: LucideIcon };
  breadcrumbs?: Array<{ label: string; href?: string }>;
  className?: string;
}

export function RoleHero({
  eyebrow,
  title,
  description,
  action,
  breadcrumbs,
  className,
}: RoleHeroProps) {
  const ActionIcon = action?.icon;
  const crumbs =
    breadcrumbs ??
    [
      { label: eyebrow },
      { label: title },
    ];

  return (
    <PageHeader
      title={title}
      description={description}
      breadcrumbs={crumbs}
      className={className}
    >
      {action && ActionIcon ? (
        <ButtonLink
          href={action.href}
          className="h-9 rounded-lg bg-[var(--theme-primary)] px-4 text-sm text-white hover:opacity-90"
        >
          <ActionIcon className="mr-2 h-4 w-4" />
          {action.label}
        </ButtonLink>
      ) : null}
    </PageHeader>
  );
}
