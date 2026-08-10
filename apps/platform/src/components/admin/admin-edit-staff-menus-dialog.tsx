"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ADMIN_LEGACY_NAV } from "@/components/layout/nav-config";
import { ASSIGNABLE_STAFF_MENU_HREFS } from "@/lib/admin-portal";
import { cn } from "@/lib/utils";

const MENU_OPTIONS = ADMIN_LEGACY_NAV.filter((item) =>
  (ASSIGNABLE_STAFF_MENU_HREFS as readonly string[]).includes(item.href),
).map((item) => ({ href: item.href, label: item.label }));

export function AdminEditStaffMenusDialog({
  userId,
  initialMenus,
}: {
  userId: string;
  initialMenus: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [menuAccess, setMenuAccess] = useState(initialMenus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setMenuAccess(initialMenus);
  }, [open, initialMenus]);

  const allSelected = useMemo(
    () => menuAccess.length === MENU_OPTIONS.length && MENU_OPTIONS.length > 0,
    [menuAccess.length],
  );

  function toggleMenu(href: string) {
    setMenuAccess((prev) =>
      prev.includes(href) ? prev.filter((h) => h !== href) : [...prev, href],
    );
  }

  async function save() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/v1/admin/staff-users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ menuAccess }),
    });
    const data = await res.json().catch(() => null);
    setLoading(false);
    if (!res.ok) {
      setError(data?.error?.message ?? "Failed to update menus");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button size="sm" variant="outline" className="h-8 gap-1" />}
      >
        <Settings2 className="h-3.5 w-3.5" />
        Menus
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit menu access</DialogTitle>
          <DialogDescription>
            Choose which admin menus this Platform Manager can open.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              setMenuAccess(allSelected ? [] : MENU_OPTIONS.map((m) => m.href))
            }
          >
            {allSelected ? "Clear all" : "Select all"}
          </Button>
        </div>
        <div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
          {MENU_OPTIONS.map((opt) => {
            const checked = menuAccess.includes(opt.href);
            return (
              <label
                key={opt.href}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                  checked ? "border-emerald-300 bg-emerald-50/40" : "border-border",
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleMenu(opt.href)}
                  disabled={loading}
                />
                {opt.label}
              </label>
            );
          })}
        </div>
        <Button onClick={() => void save()} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save menus
        </Button>
      </DialogContent>
    </Dialog>
  );
}
