"use client";

import { Check, Circle } from "lucide-react";
import { PASSWORD_REQUIREMENTS } from "@/lib/password-policy";
import { cn } from "@/lib/utils";

export function PasswordRequirements({ password }: { password: string }) {
  return (
    <ul className="space-y-1.5 rounded-xl border border-border bg-muted/80 px-3 py-2.5 text-xs text-muted-foreground">
      {PASSWORD_REQUIREMENTS.map((rule) => {
        const ok = rule.test(password);
        return (
          <li key={rule.id} className="flex items-center gap-2">
            {ok ? (
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
            ) : (
              <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <span className={cn(ok && "text-emerald-700")}>{rule.label}</span>
          </li>
        );
      })}
    </ul>
  );
}
