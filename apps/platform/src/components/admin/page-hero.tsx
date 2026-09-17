import type { ReactNode } from "react";
import { PageHeader } from "@/components/layout/page-header";

interface PageHeroProps {
  eyebrow?: string;
  title: string;
  description?: string;
  badge?: ReactNode;
  className?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  children?: ReactNode;
}

export function PageHero({
  eyebrow,
  title,
  description,
  badge,
  className,
  breadcrumbs,
  children,
}: PageHeroProps) {
  const crumbs =
    breadcrumbs ??
    (eyebrow
      ? [
          { label: eyebrow },
          { label: title },
        ]
      : [{ label: title }]);

  return (
    <PageHeader
      title={title}
      description={description}
      badge={badge}
      breadcrumbs={crumbs}
      className={className}
    >
      {children}
    </PageHeader>
  );
}
