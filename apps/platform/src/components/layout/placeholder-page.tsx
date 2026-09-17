import { PageHeader } from "@/components/layout/page-header";

interface PlaceholderPageProps {
  title: string;
  description?: string;
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="space-y-5">
      <PageHeader
        title={title}
        description={description ?? "This section is available in the navigation. Extend as needed."}
        breadcrumbs={[{ label: title }]}
      />
    </div>
  );
}
