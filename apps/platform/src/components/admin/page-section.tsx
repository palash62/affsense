import { LucideIcon } from "lucide-react";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const gradientMap = {
  revenue: "var(--theme-gradient-revenue)",
  leads: "var(--theme-gradient-leads)",
  approved: "var(--theme-gradient-approved)",
} as const;

export type SectionGradient = keyof typeof gradientMap;

interface PageSectionProps {
  title: string;
  description?: string;
  icon: LucideIcon;
  gradient?: SectionGradient;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export function PageSection({
  title,
  description,
  icon: Icon,
  gradient = "revenue",
  children,
  className,
  contentClassName,
}: PageSectionProps) {
  return (
    <div className={cn("premium-card overflow-hidden", className)}>
      <div className="h-1" style={{ background: gradientMap[gradient] }} />
      <CardHeader className="border-b border-border bg-[var(--theme-primary-soft)] px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-card shadow-sm">
            <Icon className="h-5 w-5 text-[var(--theme-primary)]" />
          </div>
          <div>
            <CardTitle className="text-lg text-foreground">{title}</CardTitle>
            {description && (
              <CardDescription className="mt-0.5">{description}</CardDescription>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className={cn("p-0", contentClassName)}>{children}</CardContent>
    </div>
  );
}
