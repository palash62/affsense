"use client";

import type { UserRole } from "@prisma/client";
import { useSession } from "next-auth/react";
import { AppShell } from "./app-shell";
import { Skeleton } from "@/components/ui/skeleton";

interface AuthenticatedShellProps {
  role: UserRole;
  children: React.ReactNode;
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-dvh items-start bg-background">
      <aside className="sticky top-0 h-dvh min-h-0 shrink-0 self-start overflow-hidden w-64 border-r border-border bg-card p-4">
        <Skeleton className="h-8 w-32" />
        <div className="mt-6 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Skeleton className="h-16 w-full shrink-0" />
        <main className="p-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="mt-4 h-64 w-full" />
        </main>
      </div>
    </div>
  );
}

export function AuthenticatedShell({ role, children }: AuthenticatedShellProps) {
  const { status } = useSession({ required: true });

  if (status === "loading") {
    return <ShellSkeleton />;
  }

  return <AppShell role={role}>{children}</AppShell>;
}
