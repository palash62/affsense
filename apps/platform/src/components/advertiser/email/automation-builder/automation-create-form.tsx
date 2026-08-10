"use client";

import { useState } from "react";
import { ArrowRight, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Trigger } from "./types";

type Props = {
  onContinue: (values: { name: string; trigger: Trigger }) => void;
};

export function AutomationCreateForm({ onContinue }: Props) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Enter a name (at least 2 characters)");
      return;
    }
    setError("");
    onContinue({ name: trimmed, trigger: "LEAD_CAPTURED" });
  }

  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-gradient-to-br from-slate-50 via-white to-emerald-50/40 px-6 py-5">
          <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <Zap className="size-5" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Create automation
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Name it, then build your email sequence on the canvas. Leads enter from the
            audience list’s campaign.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4 px-6 py-5">
          <div>
            <Label htmlFor="automation-name">Name</Label>
            <Input
              id="automation-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Welcome sequence"
              autoFocus
              className="mt-1.5"
            />
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit" className="w-full gap-2">
            Continue to builder
            <ArrowRight className="size-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
