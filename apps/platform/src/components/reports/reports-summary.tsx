import { PageHeader } from "@/components/layout/page-header";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ReportMetric {
  label: string;
  value: string | number;
}

export function ReportsSummary({
  title,
  description,
  metrics,
}: {
  title: string;
  description?: string;
  metrics: ReportMetric[];
}) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.label} className="premium-card p-5">
            <p className="text-sm font-medium text-muted-foreground">{m.label}</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{m.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
