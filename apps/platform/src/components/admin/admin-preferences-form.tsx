"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Loader2, Save } from "lucide-react";
import { TimezoneSelect } from "@/components/settings/timezone-select";
import { Button } from "@/components/ui/button";

export function AdminPreferencesForm({ initialTimezone }: { initialTimezone: string }) {
  const [timezone, setTimezone] = useState(initialTimezone);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { update } = useSession();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    const res = await fetch("/api/v1/users/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone }),
    });
    const data = await res.json();

    setSaving(false);

    if (!res.ok) {
      setError(data?.error?.message ?? "Unable to update preferences");
      return;
    }

    await update?.({ timezone });
    setSuccess("Preferences saved.");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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

      <TimezoneSelect value={timezone} onChange={setTimezone} disabled={saving} />

      <Button
        type="submit"
        disabled={saving}
        className="h-10 gap-2 rounded-xl bg-[var(--theme-primary)] hover:opacity-90"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {saving ? "Saving..." : "Save preferences"}
      </Button>
    </form>
  );
}
