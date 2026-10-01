"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function MemberIdTile({ memberId }: { memberId: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(memberId);
      setCopied(true);
      toast.success("User ID copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy User ID");
    }
  }

  return (
    <div className="rounded-xl border border-border bg-muted/60 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">User ID</p>
      <div className="mt-1 flex items-center gap-2">
        <span className="font-mono text-sm font-semibold text-foreground" data-testid="member-id">
          {memberId}
        </span>
        <button
          type="button"
          onClick={() => void copy()}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Copy User ID"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}
