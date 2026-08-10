"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ADMIN_LEGACY_NAV } from "@/components/layout/nav-config";
import { ASSIGNABLE_STAFF_MENU_HREFS } from "@/lib/admin-portal";
import { cn } from "@/lib/utils";

const MENU_OPTIONS = ADMIN_LEGACY_NAV.filter((item) =>
  (ASSIGNABLE_STAFF_MENU_HREFS as readonly string[]).includes(item.href),
).map((item) => ({ href: item.href, label: item.label }));

export function AdminCreateStaffUserForm({
  onCreated,
}: {
  onCreated?: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [menuAccess, setMenuAccess] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const allSelected = useMemo(
    () => menuAccess.length === MENU_OPTIONS.length && MENU_OPTIONS.length > 0,
    [menuAccess.length],
  );

  function toggleMenu(href: string) {
    setMenuAccess((prev) =>
      prev.includes(href) ? prev.filter((h) => h !== href) : [...prev, href],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    setTempPassword(null);
    setCopied(false);

    const res = await fetch("/api/v1/admin/staff-users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        country: country.trim() || null,
        menuAccess,
      }),
    });
    const data = await res.json().catch(() => null);
    setLoading(false);

    if (!res.ok) {
      setError(data?.error?.message ?? "Unable to create platform manager");
      return;
    }

    setSuccess(
      "Platform Manager created. Temporary password was emailed to them.",
    );
    setTempPassword(data?.data?.tempPassword ?? null);
    router.refresh();
    onCreated?.();
    setName("");
    setEmail("");
    setPhone("");
    setCountry("");
    setMenuAccess([]);
  }

  async function copyPassword() {
    if (!tempPassword) return;
    await navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {success}
        </p>
      ) : null}
      {tempPassword ? (
        <div className="rounded-lg border border-border bg-muted px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Temporary password
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-card px-3 py-1 text-sm font-semibold text-foreground shadow-sm">
              {tempPassword}
            </span>
            <Button type="button" variant="outline" size="sm" onClick={copyPassword} className="gap-1">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="staff-name">Name</Label>
          <Input
            id="staff-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            placeholder="Full name"
            disabled={loading}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="staff-email">Email</Label>
          <Input
            id="staff-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="manager@example.com"
            disabled={loading}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="staff-phone">Phone</Label>
          <Input
            id="staff-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1…"
            disabled={loading}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="staff-country">Country</Label>
          <Input
            id="staff-country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="Country"
            disabled={loading}
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label>Menu access</Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            disabled={loading}
            onClick={() =>
              setMenuAccess(
                allSelected ? [] : MENU_OPTIONS.map((m) => m.href),
              )
            }
          >
            {allSelected ? "Clear all" : "Select all"}
          </Button>
        </div>
        <div className="grid max-h-56 gap-2 overflow-y-auto rounded-xl border border-border bg-muted/60 p-3 sm:grid-cols-2">
          {MENU_OPTIONS.map((opt) => {
            const checked = menuAccess.includes(opt.href);
            return (
              <label
                key={opt.href}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm",
                  checked ? "border-emerald-300" : "border-border",
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleMenu(opt.href)}
                  disabled={loading}
                />
                <span>{opt.label}</span>
              </label>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Users menu is admin-only and cannot be granted. Managers sign in with the same login page.
        </p>
      </div>

      <Button type="submit" disabled={loading} className="w-full gap-2">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
        {loading ? "Creating…" : "Create Platform Manager"}
      </Button>
    </form>
  );
}
