"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, Copy, Loader2, MailPlus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function AdminCreateAdvertiserForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [industry, setIndustry] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    setTempPassword(null);
    setCopied(false);

    const res = await fetch("/api/v1/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: "ADVERTISER",
        name: name.trim(),
        email: email.trim(),
        company: company.trim(),
        industry: industry.trim() || undefined,
        status,
      }),
    });
    const data = await res.json();

    setLoading(false);

    if (!res.ok) {
      setError(data?.error?.message ?? "Unable to create advertiser");
      return;
    }

    setSuccess(
      "Advertiser account created. They will receive login credentials and a verification email.",
    );
    setTempPassword(data?.data?.tempPassword ?? null);
    router.refresh();
    setName("");
    setEmail("");
    setCompany("");
    setIndustry("");
    setStatus("ACTIVE");
  }

  async function copyPassword() {
    if (!tempPassword) return;
    await navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {success}
        </p>
      )}
      {tempPassword && (
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
      )}

      <div className="rounded-xl border border-border bg-muted/60 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Advertiser details
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="advertiser-name">Full name</Label>
            <Input
              id="advertiser-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="advertiser-email">Email</Label>
            <div className="relative">
              <MailPlus className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="advertiser-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="pl-9"
              />
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="advertiser-company">Company</Label>
            <div className="relative">
              <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="advertiser-company"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                required
                minLength={2}
                className="pl-9"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="advertiser-industry">Industry (optional)</Label>
            <Input
              id="advertiser-industry"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              placeholder="e.g. Finance, Health"
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="advertiser-status">Status</Label>
        <select
          id="advertiser-status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className={cn(
            "h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground shadow-sm outline-none",
            "focus:border-[var(--theme-primary)] focus:ring-2 focus:ring-[var(--theme-primary)]/15",
          )}
        >
          <option value="ACTIVE">Active</option>
          <option value="PENDING">Pending (awaiting email verification)</option>
        </select>
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="h-10 gap-2 rounded-xl bg-[var(--theme-primary)] hover:opacity-90"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
        {loading ? "Creating..." : "Create Advertiser"}
      </Button>
    </form>
  );
}
