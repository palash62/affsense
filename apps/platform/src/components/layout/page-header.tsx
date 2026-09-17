import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

export type PageHeaderCrumb = {
  label: string;
  href?: string;
};

export type PageHeaderProps = {
  title: string;
  description?: string;
  breadcrumbs?: PageHeaderCrumb[];
  badge?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  description,
  breadcrumbs,
  badge,
  children,
  className,
}: PageHeaderProps) {
  const crumbs = breadcrumbs && breadcrumbs.length > 0 ? breadcrumbs : undefined;

  return (
    <div className={cn("space-y-3", className)}>
      {crumbs ? (
        <Breadcrumb>
          <BreadcrumbList className="gap-1 text-xs sm:gap-1.5">
            {crumbs.map((crumb, index) => {
              const isLast = index === crumbs.length - 1;
              return (
                <Fragment key={`${crumb.label}-${index}`}>
                  {index > 0 ? <BreadcrumbSeparator className="text-muted-foreground/70" /> : null}
                  <BreadcrumbItem>
                    {crumb.href && !isLast ? (
                      <BreadcrumbLink
                        render={<Link href={crumb.href} />}
                        className="text-muted-foreground transition-colors hover:text-[var(--theme-primary)]"
                      >
                        {crumb.label}
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage
                        className={cn(
                          isLast
                            ? "font-medium text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {crumb.label}
                      </BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                </Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="premium-page-title">{title}</h1>
            {badge ? (
              typeof badge === "string" ? (
                <Badge variant="secondary" className="font-medium">
                  {badge}
                </Badge>
              ) : (
                badge
              )
            ) : null}
          </div>
          {description ? <p className="premium-page-subtitle">{description}</p> : null}
        </div>
        {children ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>
        ) : null}
      </div>
    </div>
  );
}
