import { Info } from "lucide-react";

export function PublisherInfoBanner({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex gap-3 rounded-xl border px-4 py-3 text-sm text-foreground"
      style={{
        borderColor: "color-mix(in srgb, var(--theme-primary) 20%, transparent)",
        background: "var(--theme-primary-soft)",
      }}
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--theme-primary)]" />
      <p>{children}</p>
    </div>
  );
}
