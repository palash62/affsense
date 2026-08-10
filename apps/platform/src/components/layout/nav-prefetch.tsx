"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { UserRole } from "@prisma/client";
import { getNavForRole } from "./nav-config";

function safePrefetch(router: ReturnType<typeof useRouter>, href: string) {
  try {
    router.prefetch(href);
  } catch {
    // Router may not be initialized yet during hydration or Fast Refresh.
  }
}

export function NavPrefetch({
  role,
  canAccessCpaOffers = true,
  canAccessAutoresponder = true,
  staffMenuAccess,
}: {
  role: UserRole;
  canAccessCpaOffers?: boolean;
  canAccessAutoresponder?: boolean;
  staffMenuAccess?: string[];
}) {
  const router = useRouter();
  // Single stable key so adding more access flags never changes useEffect deps size.
  const accessKey = `${canAccessCpaOffers ? 1 : 0}:${canAccessAutoresponder ? 1 : 0}:${(staffMenuAccess ?? []).join(",")}`;

  useEffect(() => {
    let cancelled = false;

    const prefetchNav = () => {
      if (cancelled) return;
      const [cpa, autoresponder, menus] = accessKey.split(":");
      for (const entry of getNavForRole(role, {
        canAccessCpaOffers: cpa === "1",
        canAccessAutoresponder: autoresponder === "1",
        staffMenuAccess: menus ? menus.split(",").filter(Boolean) : [],
      })) {
        if (entry.kind !== "item") continue;
        const item = entry.item;
        safePrefetch(router, item.href);
        for (const child of item.children ?? []) {
          safePrefetch(router, child.href);
        }
      }
    };

    // Defer until after the app router action queue is initialized.
    const timeoutId = window.setTimeout(prefetchNav, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [role, accessKey, router]);

  return null;
}
