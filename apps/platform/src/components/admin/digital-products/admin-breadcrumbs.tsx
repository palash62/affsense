import { PageHeader, type PageHeaderCrumb } from "@/components/layout/page-header";

/** @deprecated Prefer PageHeader with breadcrumbs. Thin alias for older form imports. */
export type BreadcrumbItem = PageHeaderCrumb;

export function AdminBreadcrumbs({
  items,
  className,
}: {
  items: BreadcrumbItem[];
  className?: string;
}) {
  const current = items[items.length - 1];
  return (
    <PageHeader
      title={current?.label ?? ""}
      breadcrumbs={items}
      className={className}
    />
  );
}
