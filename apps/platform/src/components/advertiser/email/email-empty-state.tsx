import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmailEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
}

export function EmailEmptyState({ icon: Icon, title, description, actionLabel }: EmailEmptyStateProps) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/50 p-12 text-center transition-colors hover:border-slate-400">
      <Icon className="mx-auto h-10 w-10 text-muted-foreground" />
      <p className="mt-3 font-medium text-foreground">{title}</p>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      {actionLabel && (
        <Button type="button" className="mt-4" variant="default">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
